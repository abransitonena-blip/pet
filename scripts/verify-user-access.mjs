#!/usr/bin/env node

import diagnostics from './lib/user-access-diagnostics.cjs'

const {
  buildSafeUserAccessReport,
  buildUserAccessReport,
  classifySafeDiagnosticError,
  parseVerifyUserAccessArgs,
  usage,
} = diagnostics

let diagnosticContext = {
  stage: 'arguments',
  service: 'local',
  requestedProject: null,
  identifierType: 'unknown',
}

async function resolveProjectContext(requestedProject) {
  const fallback = {
    resourceProjectId: requestedProject || null,
    requestedProjectNumber: null,
    quotaProjectId: null,
  }
  if (!requestedProject) return fallback
  try {
    const { GoogleAuth } = await import('google-auth-library')
    const googleAuth = new GoogleAuth({
      projectId: requestedProject,
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    })
    const client = await googleAuth.getClient()
    const quotaProjectId = typeof client.quotaProjectId === 'string' ? client.quotaProjectId : null
    try {
      const response = await client.request({
        url: `https://cloudresourcemanager.googleapis.com/v1/projects/${encodeURIComponent(requestedProject)}`,
        method: 'GET',
      })
      const data = response?.data && typeof response.data === 'object' ? response.data : {}
      return {
        resourceProjectId: typeof data.projectId === 'string' ? data.projectId : requestedProject,
        requestedProjectNumber: typeof data.projectNumber === 'string' ? data.projectNumber : null,
        quotaProjectId,
      }
    } catch {
      return { ...fallback, quotaProjectId }
    }
  } catch {
    return fallback
  }
}

async function runStage(stage, service, operation) {
  diagnosticContext = { ...diagnosticContext, stage, service }
  return operation()
}

async function main() {
  let options
  try {
    options = parseVerifyUserAccessArgs(process.argv.slice(2))
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'No se pudieron validar los argumentos.')
    console.error(usage())
    process.exitCode = 2
    return
  }

  if (options.help) {
    console.log(usage())
    return
  }

  diagnosticContext = {
    stage: 'admin-initialization',
    service: 'firebase-admin',
    requestedProject: options.projectId,
    identifierType: options.email ? 'email' : 'uid',
  }

  // ADC must be configured outside the repository. No credential file is read
  // by this script and no token or private key is included in its output.
  const [{ applicationDefault, getApps, initializeApp }, { getAuth }, { getFirestore }] = await runStage('admin-initialization', 'firebase-admin', () => Promise.all([
    import('firebase-admin/app'),
    import('firebase-admin/auth'),
    import('firebase-admin/firestore'),
  ]))

  const app = await runStage('admin-initialization', 'firebase-admin', async () => getApps()[0] || initializeApp({
    credential: applicationDefault(),
    ...(options.projectId ? { projectId: options.projectId } : {}),
  }))
  const adminAuth = getAuth(app)
  const firestore = getFirestore(app)
  const authUser = await runStage('auth-lookup', 'firebase-auth', () => options.email
    ? adminAuth.getUserByEmail(options.email)
    : adminAuth.getUser(options.uid))

  const userMirrorSnapshot = await runStage(
    'firestore-user',
    'firestore',
    () => firestore.doc(`users/${authUser.uid}`).get()
  )
  const walkerProfileSnapshot = await runStage(
    'firestore-walker-profile',
    'firestore',
    () => firestore.doc(`walkerProfiles/${authUser.uid}`).get()
  )

  const report = buildUserAccessReport({
    authUser,
    userMirror: userMirrorSnapshot.exists ? userMirrorSnapshot.data() : null,
    walkerProfile: walkerProfileSnapshot.exists ? walkerProfileSnapshot.data() : null,
    projectId: app.options.projectId || options.projectId,
    lookup: options.email ? { by: 'email', value: options.email } : { by: 'uid', value: options.uid },
  })
  console.log(JSON.stringify(options.debugSafe ? buildSafeUserAccessReport(report) : report, null, 2))
}

main().catch(async (error) => {
  if (process.argv.includes('--debug-safe')) {
    const projectContext = await resolveProjectContext(diagnosticContext.requestedProject)
    console.error(JSON.stringify(classifySafeDiagnosticError(error, { ...diagnosticContext, ...projectContext }), null, 2))
  } else {
    console.error('No fue posible completar la verificación local. Confirma ADC, permisos de solo lectura y el proyecto seleccionado.')
  }
  process.exitCode = 1
})
