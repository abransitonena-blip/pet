#!/usr/bin/env node

import coverage from './lib/walker-session-coverage.cjs'

const { parseArgs, runVerification, safeFailure, usage } = coverage
let options = {}

async function main() {
  try {
    options = parseArgs(process.argv.slice(2))
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

  const [{ applicationDefault, getApps, initializeApp }, firestoreModule] = await Promise.all([
    import('firebase-admin/app'),
    import('firebase-admin/firestore'),
  ])
  const { FieldPath, getFirestore } = firestoreModule
  const existingApp = getApps()[0]
  if (existingApp && existingApp.options.projectId !== options.projectId) {
    throw new coverage.CoverageVerificationError('resolved-project-mismatch', 'initialization')
  }
  const app = existingApp || initializeApp({ credential: applicationDefault(), projectId: options.projectId })
  const db = getFirestore(app)

  const report = await runVerification({
    resolveProjectId: async () => app.options.projectId,
    queryPage: async ({ collectionName, status, fields, cursor, limit }) => {
      let query = db.collection(collectionName)
        .where('status', '==', status)
        .orderBy(FieldPath.documentId())
        .select(...fields)
        .limit(limit)
      if (cursor) query = query.startAfter(cursor)
      const snapshot = await query.get()
      return {
        documents: snapshot.docs.map((document) => ({ id: document.id, data: document.data() })),
        nextCursor: snapshot.size === limit ? snapshot.docs.at(-1) : null,
      }
    },
  }, options)
  console.log(JSON.stringify(report, null, 2))
}

main().catch((error) => {
  console.error(JSON.stringify(safeFailure(error, options), null, 2))
  process.exitCode = 1
})
