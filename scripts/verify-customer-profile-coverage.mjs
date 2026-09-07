#!/usr/bin/env node

import coverage from './lib/customer-profile-coverage.cjs'

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

  const [{ applicationDefault, getApps, initializeApp }, { FieldPath, getFirestore }] = await Promise.all([
    import('firebase-admin/app'),
    import('firebase-admin/firestore'),
  ])
  const existingApp = getApps()[0]
  if (existingApp && existingApp.options.projectId !== options.projectId) {
    throw new coverage.CustomerCoverageError('resolved-project-mismatch', 'initialization')
  }
  const app = existingApp || initializeApp({ credential: applicationDefault(), projectId: options.projectId })
  const db = getFirestore(app)

  const report = await runVerification({
    resolveProjectId: async () => app.options.projectId,
    listLegacyPage: async ({ cursor, limit }) => {
      let query = db.collection('clients')
        .orderBy(FieldPath.documentId())
        .select()
        .limit(limit)
      if (cursor) query = query.startAfter(cursor)
      const snapshot = await query.get()
      return {
        ids: snapshot.docs.map((document) => document.id),
        nextCursor: snapshot.size === limit ? snapshot.docs.at(-1) : null,
      }
    },
    listCanonicalIds: async (ids) => {
      const existing = []
      for (let index = 0; index < ids.length; index += 30) {
        const chunk = ids.slice(index, index + 30)
        const snapshot = await db.collection('customerProfiles')
          .where(FieldPath.documentId(), 'in', chunk)
          .select()
          .get()
        existing.push(...snapshot.docs.map((document) => document.id))
      }
      return existing
    },
  }, options)
  console.log(JSON.stringify(report, null, 2))
}

main().catch((error) => {
  console.error(JSON.stringify(safeFailure(error, options), null, 2))
  process.exitCode = 1
})
