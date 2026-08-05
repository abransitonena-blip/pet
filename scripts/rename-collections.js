#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const { Command } = require('commander')
const { getFirestore, collection, getDocs, writeBatch, doc, query, where, limit, getCountFromServer } = require('firebase/firestore')
const { initializeApp, getApps, getApp } = require('firebase/app')

const program = new Command()

program
  .name('rename-collections')
  .description('Safe Firestore collection rename with dry-run, verify, resume, and idempotency')
  .requiredOption('--backups-dir <dir>', 'Directorio para guardar backups')
  .requiredOption('--renames <json>', 'JSON con array de {from, to}')
  .option('--dry-run', 'Simular sin modificar datos', false)
  .option('--project <id>', 'ID del proyecto Firebase (para logs)')
  .option('--limit <n>', 'Límite de documentos por colección (0 = sin límite)', '0')
  .option('--resume-from <collection>', 'Reanudar desde esta colección (omitir anteriores)')
  .option('--verify-only', 'Solo verificar, no migrar', false)
  .option('--yes', 'Confirmar operación destructiva sin prompt', false)
  .parse()

const options = program.opts()
const renames = JSON.parse(options.renames)
const backupsDir = options.backupsDir
const dryRun = options.dryRun
const verifyOnly = options.verifyOnly
const limit = parseInt(options.limit, 10) || 0
const resumeFrom = options.resumeFrom || null
const projectId = options.project || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'unknown'
const autoConfirm = options.yes || false

const LOG_FILE = path.join(backupsDir, 'migration-log.json')
const ERROR_LOG_FILE = path.join(backupsDir, 'errors.json')

function log(message, level = 'info') {
  const entry = { timestamp: new Date().toISOString(), level, message }
  console.log(`[${level.toUpperCase()}] ${message}`)
  const logs = JSON.parse(fs.existsSync(LOG_FILE) ? fs.readFileSync(LOG_FILE, 'utf8') : '[]')
  logs.push(entry)
  fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2))
}

function errorLog(collection, message, error) {
  const entry = { timestamp: new Date().toISOString(), collection, message, error: error?.message || String(error) }
  const errors = JSON.parse(fs.existsSync(ERROR_LOG_FILE) ? fs.readFileSync(ERROR_LOG_FILE, 'utf8') : '[]')
  errors.push(entry)
  fs.writeFileSync(ERROR_LOG_FILE, JSON.stringify(errors, null, 2))
}

function stateFile() {
  return path.join(backupsDir, 'migration-state.json')
}

function loadState() {
  if (!fs.existsSync(stateFile())) return { completed: [], failed: [], skipped: [] }
  return JSON.parse(fs.readFileSync(stateFile(), 'utf8'))
}

function saveState(state) {
  fs.writeFileSync(stateFile(), JSON.stringify(state, null, 2))
}

async function countDocuments(db, collectionName) {
  try {
    const colRef = collection(db, collectionName)
    const snapshot = await getCountFromServer(colRef)
    return snapshot.data().count
  } catch {
    return -1
  }
}

async function exportCollection(db, collectionName, backupDir) {
  log(`Exportando colección: ${collectionName}`)
  const colRef = collection(db, collectionName)
  let q = query(colRef)
  if (limit > 0) q = query(colRef, limit(limit))

  const snapshot = await getDocs(q)
  const items = []
  snapshot.forEach(d => {
    items.push({ id: d.id, ...d.data() })
  })

  const fileName = path.join(backupDir, `${collectionName}.json`)
  fs.writeFileSync(fileName, JSON.stringify(items, null, 2))
  log(`  → ${items.length} docs exportados a ${fileName}`)
  return items
}

async function collectionExists(db, collectionName) {
  try {
    const colRef = collection(db, collectionName)
    const snapshot = await getDocs(colRef)
    return !snapshot.empty || snapshot.size > 0
  } catch {
    return false
  }
}

async function getDocumentCount(db, collectionName) {
  try {
    const colRef = collection(db, collectionName)
    const snapshot = await getDocs(colRef)
    return snapshot.size
  } catch {
    return 0
  }
}

async function verifyTargetEmpty(db, targetName) {
  const exists = await collectionExists(db, targetName)
  if (exists) {
    const count = await getDocumentCount(db, targetName)
    log(`  ⚠ Destino "${targetName}" ya existe con ${count} documentos`, 'warn')
    return false
  }
  return true
}

async function detectAlreadyMigrated(db, sourceName, targetName) {
  const sourceCount = await getDocumentCount(db, sourceName)
  const targetCount = await getDocumentCount(db, targetName)
  if (sourceCount === 0 && targetCount > 0) {
    log(`  ✓ Ya migrado: ${sourceName} vacío, ${targetName} tiene ${targetCount} docs`, 'info')
    return true
  }
  if (sourceCount > 0 && targetCount > 0) {
    log(`  � Ambas colecciones existen: ${sourceName}(${sourceCount}) + ${targetName}(${targetCount})`, 'warn')
    return false
  }
  return false
}

async function detectDuplicateIds(db, sourceName, targetName) {
  const sourceRef = collection(db, sourceName)
  const targetRef = collection(db, targetName)

  const sourceSnap = await getDocs(query(sourceRef, limit(limit || 1000)))
  const targetSnap = await getDocs(query(targetRef, limit(limit || 1000)))

  const sourceIds = new Set(sourceSnap.docs.map(d => d.id))
  const targetIds = new Set(targetSnap.docs.map(d => d.id))

  const duplicates = [...sourceIds].filter(id => targetIds.has(id))
  if (duplicates.length > 0) {
    log(`  � ${duplicates.length} IDs duplicados detectados entre ${sourceName} y ${targetName}`, 'warn')
    return duplicates
  }
  return []
}

async function detectBrokenReferences(db, sourceName, targetName, renames) {
  const renamesMap = {}
  renames.forEach(r => { renamesMap[r.from] = r.to })

  const sourceRef = collection(db, sourceName)
  const snapshot = await getDocs(query(sourceRef, limit(limit || 500)))

  const brokenRefs = []
  snapshot.forEach(d => {
    const data = d.data()
    Object.keys(data).forEach(key => {
      const value = data[key]
      if (typeof value === 'string' && value.startsWith('collection:')) {
        const refCollection = value.replace('collection:', '')
        if (renamesMap[refCollection] && !renamesMap[sourceName]) {
          brokenRefs.push({ docId: d.id, field: key, refCollection })
        }
      }
    })
  })

  if (brokenRefs.length > 0) {
    log(`  � ${brokenRefs.length} referencias potencialmente rotas detectadas`, 'warn')
  }
  return brokenRefs
}

async function generateImpactReport(db, renames) {
  log('\n📊 INFORME DE IMPACTO')
  log('=' .repeat(50))

  let totalDocs = 0
  for (const r of renames) {
    const sourceCount = await countDocuments(db, r.from)
    const targetExists = await collectionExists(db, r.to)
    const targetCount = targetExists ? await getDocumentCount(db, r.to) : 0
    totalDocs += sourceCount

    log(`  ${r.from} → ${r.to}`)
    log(`    Documentos fuente: ${sourceCount}`)
    log(`    Destino existe: ${targetExists ? `sí (${targetCount} docs)` : 'no'}`)
    log(`    Ya migrado: ${sourceCount === 0 && targetCount > 0 ? 'sí' : 'no'}`)
  }

  log(`\n  Total documentos a migrar: ${totalDocs}`)
  log(`  Modo: ${dryRun ? 'DRY RUN' : verifyOnly ? 'VERIFY ONLY' : 'MIGRATE'}`)
  log('=' .repeat(50))
}

async function migrateCollection(db, sourceName, targetName, backupDir) {
  const state = loadState()

  if (state.completed.includes(sourceName)) {
    log(`  ↩ Ya completado: ${sourceName} → ${targetName}`, 'info')
    return { skipped: true, reason: 'already_completed' }
  }

  if (resumeFrom && !state.completed.includes(resumeFrom) && sourceName !== resumeFrom) {
    log(`  ↩ Saltando (resume-from): ${sourceName}`, 'info')
    return { skipped: true, reason: 'resume_from' }
  }

  const alreadyMigrated = await detectAlreadyMigrated(db, sourceName, targetName)
  if (alreadyMigrated) {
    state.completed.push(sourceName)
    saveState(state)
    return { skipped: true, reason: 'already_migrated' }
  }

  if (verifyOnly) {
    log(`  [VERIFY] ${sourceName} → ${targetName}`, 'info')
    await detectDuplicateIds(db, sourceName, targetName)
    await detectBrokenReferences(db, sourceName, targetName, renames)
    state.skipped.push(sourceName)
    saveState(state)
    return { verified: true }
  }

  if (dryRun) {
    log(`  [DRY RUN] ${sourceName} → ${targetName}`, 'info')
    const sourceCount = await getDocumentCount(db, sourceName)
    log(`    Afectaría ${sourceCount} documentos`, 'info')
    state.skipped.push(sourceName)
    saveState(state)
    return { dryRun: true, docCount: sourceCount }
  }

  log(`  Migrando: ${sourceName} → ${targetName}`)

  const backup = await exportCollection(db, sourceName, backupDir)

  if (!(await verifyTargetEmpty(db, targetName))) {
    log(`  ⛔ Destino no vacío, saltando ${sourceName}`, 'error')
    state.failed.push(sourceName)
    saveState(state)
    return { failed: true, reason: 'target_not_empty' }
  }

  const duplicates = await detectDuplicateIds(db, sourceName, targetName)
  if (duplicates.length > 0) {
    log(`  ⛔ ${duplicates.length} IDs duplicados, saltando ${sourceName}`, 'error')
    state.failed.push(sourceName)
    saveState(state)
    return { failed: true, reason: 'duplicate_ids', duplicates }
  }

  const targetRef = collection(db, targetName)
  const batch = writeBatch(db)
  let imported = 0

  for (const item of backup) {
    const docRef = doc(targetRef, item.id)
    batch.set(docRef, item, { merge: true })
    imported++
  }

  await batch.commit()
  log(`  ✓ Importados ${imported} documentos a ${targetName}`, 'success')

  const sourceCount = await getDocumentCount(db, sourceName)
  if (sourceCount > 0) {
    log(`  ℹ Fuente ${sourceName} aún tiene ${sourceCount} docs (no eliminados)`, 'info')
  }

  state.completed.push(sourceName)
  saveState(state)
  return { success: true, imported }
}

async function main() {
  log(`🚀 Migración iniciada — proyecto: ${projectId}`)
  log(`   Modo: ${dryRun ? 'DRY RUN' : verifyOnly ? 'VERIFY ONLY' : 'MIGRATE'}`)
  log(`   Renombres: ${renames.map(r => r.from + ' → ' + r.to).join(', ')}`)
  log(`   Backups: ${backupsDir}`)
  log(`   Límite: ${limit || 'sin límite'}`)
  log(`   Resume-from: ${resumeFrom || 'ninguno'}`)

  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true })
  }

  let db
  if (!getApps().length) {
    const app = initializeApp({
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    })
    db = getFirestore(app)
  } else {
    db = getFirestore()
  }

  await generateImpactReport(db, renames)

  if (verifyOnly) {
    log('\n🔍 Modo VERIFY ONLY — sin modificaciones')
  } else if (dryRun) {
    log('\n🔍 Modo DRY RUN — sin modificaciones')
  }

  if (!dryRun && !verifyOnly && !autoConfirm) {
    log('\n⚠ Esta operación modificará datos en Firestore.', 'warn')
    log('   Usa --yes para confirmar automáticamente o --dry-run para simular.', 'warn')
    log('   Presiona Ctrl+C para cancelar.')
  }

  const state = loadState()
  let results = { completed: 0, failed: 0, skipped: 0, errors: [] }

  for (const r of renames) {
    if (resumeFrom && !state.completed.includes(resumeFrom) && r.from !== resumeFrom) {
      log(`  ↩ Saltando (resume-from): ${r.from}`, 'info')
      state.skipped.push(r.from)
      continue
    }

    try {
      const result = await migrateCollection(db, r.from, r.to, backupsDir)
      if (result.success) results.completed++
      else if (result.failed) results.failed++
      else results.skipped++

      if (result.failed && result.reason) {
        results.errors.push({ collection: r.from, reason: result.reason })
      }
    } catch (e) {
      log(`  ✗ Error en ${r.from} → ${r.to}: ${e.message}`, 'error')
      errorLog(r.from, e.message, e)
      state.failed.push(r.from)
      results.failed++
      results.errors.push({ collection: r.from, error: e.message })
    }

    saveState(state)
  }

  log('\n📋 Resumen final')
  log(`   Completados: ${results.completed}`)
  log(`   Fallidos: ${results.failed}`)
  log(`   Saltados: ${results.skipped}`)
  log(`   Errores: ${results.errors.length}`)

  if (results.errors.length > 0) {
    log('\n❌ Errores:', 'error')
    results.errors.forEach(e => log(`   - ${e.collection}: ${e.reason || e.error}`, 'error'))
  }

  if (dryRun) {
    log('\n✅ DRY RUN completado — sin datos modificados', 'success')
  } else if (verifyOnly) {
    log('\n✅ VERIFY completado — sin datos modificados', 'success')
  } else {
    log('\n✅ Migración completada', 'success')
    log('   Las colecciones fuente NO fueron eliminadas.', 'info')
    log('   Revisa los backups antes de eliminarlas manualmente.', 'info')
  }
}

main().catch((e) => {
  console.error('Fatal:', e)
  process.exit(1)
})