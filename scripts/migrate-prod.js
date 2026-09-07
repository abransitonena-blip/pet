#!/usr/bin/env node
'use strict'

/**
 * Real Firestore migration for the P15 renames against a production project.
 *
 *   clients                    → customerProfiles
 *   pets                       → dogs
 *   reservations field `client` → `customer`
 *
 * Connects with firebase-admin using the OAuth refresh token already stored by
 * the Firebase CLI (~/.config/configstore/firebase-tools.json), so it runs with
 * admin privileges (bypasses security rules) and needs no service account.
 *
 * Safety:
 *   - Always backs up every legacy document to --backups-dir before any write.
 *   - Defaults to dry-run (reads + backups only). Writes require BOTH
 *     --execute and --yes against the exact prod project id.
 *   - Idempotent + resumable via migration-state.json in the backups dir.
 *   - Source collections are never deleted (locked by the new rules instead).
 *
 * Usage:
 *   node scripts/migrate-prod.js --project pet-1cb0b --backups-dir ./backups/renames/<ts>            # dry-run + backup
 *   node scripts/migrate-prod.js --project pet-1cb0b --backups-dir ./backups/renames/<ts> --execute --yes
 */

const fs = require('fs')
const path = require('path')
const os = require('os')

const COLLECTION_RENAMES = [
  { from: 'clients', to: 'customerProfiles' },
  { from: 'pets', to: 'dogs' },
]
const FIELD_RENAMES = [
  { collection: 'reservations', fromField: 'client', toField: 'customer' },
]
const ALLOWED_EXECUTE_PROJECTS = ['pet-1cb0b']

const BATCH_SIZE = 400
const PAGE_SIZE = 500

function log(message, level = 'info') {
  console.log(`[${level.toUpperCase()}] ${message}`)
}

function usage() {
  console.log(`Usage: node scripts/migrate-prod.js --project <id> --backups-dir <dir> [--execute] [--yes] [--limit <n>] [--report <path>]`)
  console.log(`  --project       Firebase project id (required; execute only allowed on: ${ALLOWED_EXECUTE_PROJECTS.join(', ')})`)
  console.log(`  --backups-dir   Directory for backups + state (required)`)
  console.log(`  --execute       Perform the writes (default: dry-run, reads + backup only)`)
  console.log(`  --yes           Confirm destructive confirmation is implied by --execute + --project`)
  console.log(`  --limit <n>     Max documents per collection (0 = all)`)
  console.log(`  --report <path> Report JSON path (default ./artifacts/migrate-prod-report.json)`)
}

function parseArgs() {
  const args = process.argv.slice(2)
  const result = { project: null, backupsDir: null, execute: false, yes: false, limit: 0, report: './artifacts/migrate-prod-report.json' }
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    switch (arg) {
      case '--project':
        if (i + 1 < args.length) result.project = args[++i]
        break
      case '--backups-dir':
        if (i + 1 < args.length) result.backupsDir = args[++i]
        break
      case '--execute':
        result.execute = true
        break
      case '--yes':
        result.yes = true
        break
      case '--limit':
        if (i + 1 < args.length) result.limit = parseInt(args[++i], 10) || 0
        break
      case '--report':
        if (i + 1 < args.length) result.report = args[++i]
        break
      case '--help':
      case '-h':
        usage()
        process.exit(0)
        break
      default:
        console.error(`ERROR: Unknown argument '${arg}'`)
        usage()
        process.exit(2)
    }
  }
  return result
}

function loadRefreshToken(file) {
  const resolved = path.resolve(file)
  if (!fs.existsSync(resolved)) {
    console.error(`ERROR: refresh-token file not found: ${resolved}`)
    process.exit(2)
  }
  const json = JSON.parse(fs.readFileSync(resolved, 'utf8'))
  const token = json?.tokens?.refresh_token
  if (!token) {
    console.error('ERROR: no refresh_token in', resolved)
    process.exit(2)
  }
  return token
}

function initAdmin(refreshToken, backupsDir, projectId) {
  // firebase-admin's Firestore client rejects refreshToken credentials, so we
  // materialize an Application Default Credentials file (authorized_user) from
  // the Firebase CLI refresh token and use applicationDefault().
  const admin = require('firebase-admin')
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS || !fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
    const adc = {
      type: 'authorized_user',
      client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
      client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
      refresh_token: refreshToken,
    }
    const adcPath = path.join(backupsDir, 'firebase-adc.json')
    fs.writeFileSync(adcPath, JSON.stringify(adc, null, 2))
    process.env.GOOGLE_APPLICATION_CREDENTIALS = adcPath
  }
  const app = admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId,
  })
  return admin.firestore(app)
}

function stateFile(backupsDir) {
  return path.join(backupsDir, 'migration-state.json')
}

function loadState(backupsDir) {
  const file = stateFile(backupsDir)
  if (!fs.existsSync(file)) return { completed: [], skipped: [], conflicts: [], errors: [] }
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function saveState(backupsDir, state) {
  fs.writeFileSync(stateFile(backupsDir), JSON.stringify(state, null, 2))
}

async function listAll(db, collectionName, limitDocs) {
  const col = db.collection(collectionName)
  const out = []
  let last = null
  while (true) {
    const pageSize = limitDocs > 0 ? Math.min(limitDocs - out.length, PAGE_SIZE) : PAGE_SIZE
    if (pageSize <= 0) break
    let q = col.orderBy('__name__').limit(pageSize)
    if (last) q = q.startAfter(last)
    const snap = await q.get()
    if (snap.empty) break
    snap.forEach((d) => out.push({ id: d.id, data: d.data() }))
    last = snap.docs[snap.docs.length - 1].id
    if (limitDocs > 0 && out.length >= limitDocs) break
    if (snap.size < pageSize) break
  }
  return out
}

async function backupCollection(db, backupsDir, name, limitDocs) {
  const file = path.join(backupsDir, `${name}.json`)
  if (fs.existsSync(file)) {
    const existing = JSON.parse(fs.readFileSync(file, 'utf8'))
    log(`  ⇢ backup ya existe ${name}.json (${existing.length} docs) — reutilizando`)
    return existing
  }
  const docs = await listAll(db, name, limitDocs)
  fs.writeFileSync(file, JSON.stringify(docs, null, 2))
  log(`  ✓ backup ${name}.json (${docs.length} docs)`)
  return docs
}

async function chunkedSet(db, collectionName, entries) {
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const chunk = entries.slice(i, i + BATCH_SIZE)
    const batch = db.batch()
    chunk.forEach(({ id, data }) => batch.set(db.collection(collectionName).doc(id), data))
    await batch.commit()
  }
}

function transformCollectionDoc(from, docId, data) {
  if (from === 'clients') {
    return { ...data, userId: docId }
  }
  // pets → dogs: verbatim copy (ownerId/name/breed preserved)
  return { ...data }
}

async function migrateCollection(db, backupsDir, state, r, limitDocs, execute) {
  const phase = `${r.from}→${r.to}`
  if (state.completed.includes(phase)) {
    log(`  ↩ ${phase}: ya completado`)
    return { phase, status: 'already_completed', migrated: 0, skipped: 0, conflicts: 0 }
  }

  const sourceDocs = await backupCollection(db, backupsDir, r.from, limitDocs)

  if (sourceDocs.length === 0) {
    state.completed.push(phase)
    saveState(backupsDir, state)
    log(`  ✓ ${phase}: fuente vacía (nada que migrar)`)
    return { phase, status: 'already_migrated', migrated: 0, skipped: 0, conflicts: 0 }
  }

  const targetCount = (await db.collection(r.to).get()).size
  const migrated = []
  const conflicts = []
  const skipped = []

  for (const { id, data } of sourceDocs) {
    const targetRef = db.collection(r.to).doc(id)
    const targetSnap = await targetRef.get()
    if (targetSnap.exists) {
      conflicts.push(id)
      continue
    }
    migrated.push({ id, data: transformCollectionDoc(r.from, id, data) })
  }

  log(`  ${r.from} → ${r.to}: fuente=${sourceDocs.length} target_exists=${targetCount} a_migrar=${migrated.length} conflictos=${conflicts.length}`)

  if (execute && migrated.length > 0) {
    await chunkedSet(db, r.to, migrated)
    log(`  ✎ escritos ${migrated.length} docs en ${r.to}`)
  }

  state.conflicts.push(...conflicts)
  state.skipped.push(...skipped)
  if (execute) {
    state.completed.push(phase)
  }
  saveState(backupsDir, state)

  return { phase, status: execute ? 'migrated' : 'would_migrate', migrated: migrated.length, skipped: skipped.length, conflicts: conflicts.length }
}

async function migrateField(db, backupsDir, state, f, limitDocs, execute) {
  const phase = `${f.collection}.${f.fromField}→${f.toField}`
  if (state.completed.includes(phase)) {
    log(`  ↩ ${phase}: ya completado`)
    return { phase, status: 'already_completed', migrated: 0, conflicts: 0 }
  }

  const docs = await backupCollection(db, backupsDir, f.collection, limitDocs)

  const migrated = []
  const conflicts = []
  for (const { id, data } of docs) {
    const hasFrom = Object.prototype.hasOwnProperty.call(data, f.fromField)
    const hasTo = Object.prototype.hasOwnProperty.call(data, f.toField)
    if (hasFrom && !hasTo) {
      const next = { ...data }
      next[f.toField] = next[f.fromField]
      delete next[f.fromField]
      migrated.push({ id, data: next })
    } else if (hasFrom && hasTo) {
      conflicts.push(id)
    }
  }

  log(`  ${f.collection}: docs=${docs.length} a_renombrar=${migrated.length} ya_tienen_ambos=${conflicts.length}`)

  if (execute && migrated.length > 0) {
    let batch = db.batch()
    let count = 0
    for (const { id, data } of migrated) {
      batch.set(db.collection(f.collection).doc(id), data)
      count++
      if (count % BATCH_SIZE === 0) {
        await batch.commit()
        batch = db.batch()
      }
    }
    if (count % BATCH_SIZE !== 0) await batch.commit()
    log(`  ✎ reescritos ${migrated.length} docs en ${f.collection}`)
  }

  state.conflicts.push(...conflicts)
  if (execute) {
    state.completed.push(phase)
  }
  saveState(backupsDir, state)

  return { phase, status: execute ? 'migrated' : 'would_migrate', migrated: migrated.length, conflicts: conflicts.length }
}

async function main() {
  const opts = parseArgs()

  if (!opts.project || !opts.backupsDir) {
    console.error('ERROR: --project and --backups-dir are required')
    usage()
    process.exit(2)
  }

  if (opts.execute) {
    if (!ALLOWED_EXECUTE_PROJECTS.includes(opts.project)) {
      console.error(`ABORTED: --execute only allowed for projects: ${ALLOWED_EXECUTE_PROJECTS.join(', ')} (got '${opts.project}')`)
      process.exit(2)
    }
    if (!opts.yes) {
      console.error('ABORTED: --execute requires --yes (destructive write to ' + opts.project + ')')
      process.exit(2)
    }
  }

  const backupsDir = path.resolve(opts.backupsDir)
  fs.mkdirSync(backupsDir, { recursive: true })

  const refreshTokenFile = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json')
  const refreshToken = loadRefreshToken(refreshTokenFile)

  log(`🚀 Migración real iniciada — proyecto: ${opts.project}`)
  log(`   Modo: ${opts.execute ? 'EXECUTE' : 'DRY-RUN (solo lecturas + backup)'}`)
  log(`   Backups: ${backupsDir}`)
  log(`   Colecciones: ${COLLECTION_RENAMES.map((r) => r.from + ' → ' + r.to).join(', ')}`)
  log(`   Campo: ${FIELD_RENAMES.map((f) => f.collection + '.' + f.fromField + ' → ' + f.toField).join(', ')}`)

  const db = initAdmin(refreshToken, backupsDir, opts.project)
  const state = loadState(backupsDir)
  const results = []

  for (const r of COLLECTION_RENAMES) {
    results.push(await migrateCollection(db, backupsDir, state, r, opts.limit, opts.execute))
  }
  for (const f of FIELD_RENAMES) {
    results.push(await migrateField(db, backupsDir, state, f, opts.limit, opts.execute))
  }

  const report = {
    project: opts.project,
    mode: opts.execute ? 'execute' : 'dry-run',
    backupsDir,
    renames: COLLECTION_RENAMES.map((r) => `${r.from}→${r.to}`),
    fieldRenames: FIELD_RENAMES.map((f) => `${f.collection}.${f.fromField}→${f.toField}`),
    results,
    conflicts: state.conflicts,
    completed: state.completed,
  }
  fs.mkdirSync(path.dirname(opts.report), { recursive: true })
  fs.writeFileSync(opts.report, JSON.stringify(report, null, 2))

  log('\n📋 Resumen:')
  for (const r of results) {
    console.log(`   ${r.phase}: ${r.status} (migrados=${r.migrated} conflictos=${r.conflicts || 0})`)
  }
  if (state.conflicts.length > 0) {
    log(`⚠ ${state.conflicts.length} IDs ya existen en el destino (omitidos, no sobreescritos)`)
  }

  if (!opts.execute) {
    log('\n✅ DRY-RUN completado — sin escrituras. Revisa los backups antes de --execute --yes.')
  } else {
    log('\n✅ Migración ejecutada. Las colecciones fuente NO fueron eliminadas (bloqueadas por las nuevas reglas).')
  }
  process.exit(0)
}

main().catch((e) => {
  console.error('Fatal:', e)
  process.exit(1)
})
