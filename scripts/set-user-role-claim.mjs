#!/usr/bin/env node

import claimAdmin from './lib/user-role-claim-admin.cjs'

const { parseRoleClaimArgs, runRoleClaimOperation, safeFailure, usage } = claimAdmin
let options = {}

async function main() {
  try {
    options = parseRoleClaimArgs(process.argv.slice(2))
  } catch (error) {
    console.error(JSON.stringify(safeFailure(error, options), null, 2))
    console.error(usage())
    process.exitCode = 2
    return
  }
  if (options.help) {
    console.log(usage())
    return
  }

  const [{ applicationDefault, getApps, initializeApp }, { getAuth }] = await Promise.all([
    import('firebase-admin/app'),
    import('firebase-admin/auth'),
  ])
  const existingApp = getApps()[0]
  if (existingApp && existingApp.options.projectId !== options.projectId) {
    throw new claimAdmin.RoleClaimOperationError('firebase-project-mismatch', 'initialization')
  }
  const app = existingApp || initializeApp({
    credential: applicationDefault(),
    projectId: options.projectId,
  })
  const adminAuth = getAuth(app)
  const report = await runRoleClaimOperation({
    getUserByEmail: (email) => adminAuth.getUserByEmail(email),
    setCustomUserClaims: (uid, claims) => adminAuth.setCustomUserClaims(uid, claims),
    getUser: (uid) => adminAuth.getUser(uid),
  }, options)
  console.log(JSON.stringify(report, null, 2))
}

main().catch((error) => {
  console.error(JSON.stringify(safeFailure(error, options), null, 2))
  process.exitCode = 1
})
