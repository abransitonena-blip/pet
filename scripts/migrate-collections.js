#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const { Command } = require('commander')
const { getFirestore, collection, getDocs, writeBatch, doc, query, where, limit, getCountFromServer, DocumentSnapshot } = require('firebase/firestore')
const { initializeApp, getApps, getApp } = require('firebase/app')

const program = new Command()

program
  .name('migrate-collections')
  .description('Safe Firestore collection migration with audit, backup, dry-run, verify, and gradual migration')
  .requiredOption('--backups-dir <dir>', 'Directorio para guardar backups')
  .requiredOption('--renames <json>', 'JSON con array de {from, to}')
  .option('--dry-run', 'Simular sin modificar datos', false)
  .option('--project <id>', 'ID del proyecto Firebase (para logs)', process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'unknown')
  .option('--limit <n>', 'Límite de documentos por colección (0 = sin límite)', '0')
  .option('--resume-from <collection>', 'Reanudar desde esta colección (omitir anteriores)')
  .option('--verify-only', 'Solo verificar, no migrar', false)
  .option('--yes', 'Confirmar operación destructiva sin prompt', false)
  .option('--dual-read', 'Habilitar lectura dual durante migración', false)
  .option('--feature-flag <name>', 'Nombre del feature flag para modelo nuevo', 'newDataModel')
  .parse()

const options = program.opts()
const renames = JSON.parse(options.renames)
const backupsDir = options.backupsDir
const dryRun = options.dryRun
const verifyOnly = options.verifyOnly
const limit = parseInt(options.limit, 10) || 0
const resumeFrom = options.resumeFrom || null
const projectId = options.project
const autoConfirm = options.yes || false
const dualRead = options.dualRead || false
const featureFlag = options.featureFlag || 'newDataModel'

const LOG_FILE = path.join(backupsDir, 'migration-log.json')
const ERROR_LOG_FILE = path.join(backupsDir, 'errors.json')
const AUDIT_REPORT_FILE = path.join(backupsDir, 'audit-report.json')
const STATE_FILE = path.join(backupsDir, 'migration-state.json')

function timestamp() {
  return new Date().toISOString()
}

function log(message, level = 'info') {
  const entry = { timestamp: timestamp(), level, message }
  console.log(`[${level.toUpperCase()}] ${message}`)
  const logs = JSON.parse(fs.existsSync(LOG_FILE) ? fs.readFileSync(LOG_FILE, 'utf8') : '[]')
  logs.push(entry)
  fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2))
}

function errorLog(collection, message, error) {
  const entry = { timestamp: timestamp(), collection, message, error: error?.message || String(error) }
  const errors = JSON.parse(fs.existsSync(ERROR_LOG_FILE) ? fs.readFileSync(ERROR_LOG_FILE, 'utf8') : '[]')
  errors.push(entry)
  fs.writeFileSync(ERROR_LOG_FILE, JSON.stringify(errors, null, 2))
}

function loadState() {
  if (!fs.existsSync(STATE_FILE)) return { completed: [], failed: [], skipped: [], startedAt: null }
  return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
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

async function collectionExists(db, collectionName) {
  try {
    const colRef = collection(db, collectionName)
    const snapshot = await getDocs(colRef)
    return snapshot.size > 0
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

async function exportCollection(db, collectionName, backupDir, limitCount) {
  log(`Exportando colección: ${collectionName}`)
  const colRef = collection(db, collectionName)
  let q = query(colRef)
  if (limitCount > 0) q = query(colRef, limit(limitCount))

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

async function detectAlreadyMigrated(db, sourceName, targetName) {
  const sourceCount = await getDocumentCount(db, sourceName)
  const targetCount = await getDocumentCount(db, targetName)
  if (sourceCount === 0 && targetCount > 0) {
    log(`  ✓ Ya migrado: ${sourceName} vacío, ${targetName} tiene ${targetCount} docs`, 'info')
    return true
  }
  if (sourceCount > 0 && targetCount > 0) {
    log(`  ⚠ Ambas colecciones existen: ${sourceName}(${sourceCount}) + ${targetName}(${targetCount})`, 'warn')
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
    log(`  ⚠ ${duplicates.length} IDs duplicados detectados entre ${sourceName} y ${targetName}`, 'warn')
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
    log(`  ⚠ ${brokenRefs.length} referencias potencialmente rotas detectadas`, 'warn')
  }
  return brokenRefs
}

async function detectIncompatibleFields(db, sourceName, targetName) {
  const sourceRef = collection(db, sourceName)
  const snapshot = await getDocs(query(sourceRef, limit(limit || 100)))

  const incompatibleFields = []
  snapshot.forEach(d => {
    const data = d.data()
    Object.keys(data).forEach(key => {
      const value = data[key]
      if (value && typeof value === 'object' && value._seconds !== undefined) {
        // Firestore Timestamp - compatible
      } else if (value && typeof value === 'object' && value._firestore) {
        // Firestore DocumentReference - may be broken after rename
        incompatibleFields.push({ docId: d.id, field: key, type: 'DocumentReference' })
      }
    })
  })

  if (incompatibleFields.length > 0) {
    log(`  ⚠ ${incompatibleFields.length} campos con referencias de documento detectados`, 'warn')
  }
  return incompatibleFields
}

async function generateImpactReport(db, renames) {
  log('\n📊 INFORME DE IMPACTO')
  log('=' .repeat(60))

  let totalSourceDocs = 0
  let totalTargetDocs = 0
  const report = { projectId, timestamp: timestamp(), renames: [], summary: {} }

  for (const r of renames) {
    const sourceCount = await countDocuments(db, r.from)
    const targetExists = await collectionExists(db, r.to)
    const targetCount = targetExists ? await getDocumentCount(db, r.to) : 0
    totalSourceDocs += sourceCount > 0 ? sourceCount : 0
    totalTargetDocs += targetCount

    const alreadyMigrated = sourceCount === 0 && targetCount > 0
    const hasDuplicates = targetCount > 0 && sourceCount > 0

    report.renames.push({
      from: r.from,
      to: r.to,
      sourceCount,
      targetCount,
      targetExists,
      alreadyMigrated,
      hasDuplicates,
      status: alreadyMigrated ? 'already_migrated' : hasDuplicates ? 'conflict' : 'ready',
    })

    log(`  ${r.from} → ${r.to}`)
    log(`    Documentos fuente: ${sourceCount > 0 ? sourceCount : '(no existe)'}`)
    log(`    Destino existe: ${targetExists ? `sí (${targetCount} docs)` : 'no'}`)
    log(`    Estado: ${alreadyMigrated ? 'YA MIGRADO' : hasDuplicates ? 'CONFLICTO' : 'LISTO'}`)
  }

  report.summary = {
    totalRenames: renames.length,
    totalSourceDocs,
    totalTargetDocs,
    alreadyMigrated: report.renames.filter(r => r.alreadyMigrated).length,
    conflicts: report.renames.filter(r => r.hasDuplicates).length,
    ready: report.renames.filter(r => !r.alreadyMigrated && !r.hasDuplicates).length,
    dryRun,
    verifyOnly,
    dualRead,
    featureFlag,
  }

  log(`\n  Total docs fuente: ${totalSourceDocs}`)
  log(`  Total docs destino: ${totalTargetDocs}`)
  log(`  Ya migrados: ${report.summary.alreadyMigrated}`)
  log(`  Conflictos (duplicados): ${report.summary.conflicts}`)
  log(`  Listos para migrar: ${report.summary.ready}`)
  log(`  Modo: ${dryRun ? 'DRY RUN' : verifyOnly ? 'VERIFY ONLY' : 'MIGRATE'}`)
  log(`  Dual-read: ${dualRead}`)
  log(`  Feature flag: ${featureFlag}`)
  log('=' .repeat(60))

  fs.writeFileSync(AUDIT_REPORT_FILE, JSON.stringify(report, null, 2))
  log(`\n📄 Informe guardado en: ${AUDIT_REPORT_FILE}`)

  return report
}

async function createBackup(db, backupsDir, renames) {
  log('\n📦 Creando respaldo administrado...')
  const backupDir = path.join(backupsDir, `backup-${timestamp().replace(/[:.]/g, '-')}`)
  fs.mkdirSync(backupDir, { recursive: true })

  const manifest = {
    createdAt: timestamp(),
    projectId,
    renames,
    backups: [],
  }

  for (const r of renames) {
    const sourceExists = await collectionExists(db, r.from)
    if (sourceExists) {
      log(`  Respaldo: ${r.from}`)
      const items = await exportCollection(db, r.from, backupDir, 0)
      manifest.backups.push({
        collection: r.from,
        backupFile: `${r.from}.json`,
        docCount: items.length,
      })
    }
  }

  fs.writeFileSync(path.join(backupDir, 'manifest.json'), JSON.stringify(manifest, null, 2))
  log(`  ✓ Respaldo completo en: ${backupDir}`)
  return backupDir
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
    await detectIncompatibleFields(db, sourceName, targetName)
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

  const backup = await exportCollection(db, sourceName, backupDir, limit)

  const targetCount = await getDocumentCount(db, targetName)
  if (targetCount > 0) {
    log(`  ⛔ Destino no vacío (${targetCount} docs), saltando ${sourceName}`, 'error')
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

  if (dualRead) {
    log(`  ℹ Dual-read habilitado: ${sourceName} aún disponible como lectura`, 'info')
  }

  const sourceCount = await getDocumentCount(db, sourceName)
  if (sourceCount > 0) {
    log(`  ℹ Fuente ${sourceName} aún tiene ${sourceCount} docs (no eliminados)`, 'info')
    log(`  ℹ Las colecciones fuente se mantienen archivadas hasta verificación en producción`, 'info')
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
  log(`   Dual-read: ${dualRead}`)
  log(`   Feature flag: ${featureFlag}`)

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

  const report = await generateImpactReport(db, renames)

  if (verifyOnly) {
    log('\n🔍 Modo VERIFY ONLY — sin modificaciones')
    log('   Ejecución completada. Revisa el informe para detalles.')
    process.exit(0)
  }

  if (dryRun) {
    log('\n🔍 Modo DRY RUN — sin modificaciones')
    log('   Ejecución completada. Revisa el informe para detalles.')
    process.exit(0)
  }

  if (!autoConfirm) {
    log('\n⚠ Esta operación modificará datos en Firestore.', 'warn')
    log('   Usa --yes para confirmar automáticamente o --dry-run para simular.', 'warn')
    log('   Presiona Ctrl+C para cancelar.')
  }

  const state = loadState()
  state.startedAt = timestamp()
  saveState(state)

  let backupDir = null
  if (!dryRun && !verifyOnly) {
    backupDir = await createBackup(db, backupsDir, renames)
  }

  let results = { completed: 0, failed: 0, skipped: 0, errors: [] }

  for (const r of renames) {
    if (resumeFrom && !state.completed.includes(resumeFrom) && r.from !== resumeFrom) {
      log(`  ↩ Saltando (resume-from): ${r.from}`, 'info')
      state.skipped.push(r.from)
      continue
    }

    try {
      const result = await migrateCollection(db, r.from, r.to, backupDir || backupsDir)
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

  log('\n📌 Próximos pasos:', 'info')
  log('   1. Verifica la migración en staging/pruebas', 'info')
  log('   2. Ejecuta las pruebas de integración', 'info')
  log('   3. Si todo está correcto, elimina las colecciones fuente manualmente', 'info')
  log('   4. Actualiza las reglas de Firestore y los índices', 'info')
  log('   5. Mantén las colecciones fuente archivadas por un periodo prudente', 'info')

  if (dryRun) {
    log('\n✅ DRY RUN completado — sin datos modificados', 'success')
  } else if (verifyOnly) {
    log('\n✅ VERIFY completado — sin datos modificados', 'success')
  } else {
    log('\n✅ Migración completada', 'success')
  }
}

main().catch((e) => {
  console.error('Fatal:', e)
  process.exit(1)
})