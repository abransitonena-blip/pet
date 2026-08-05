#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const { Command } = require('commander')
const { getFirestore, collection, getDocs, writeBatch, doc } = require('firebase/firestore')
const { initializeApp, getApps } = require('firebase/app')

const program = new Command()

program
  .name('rollback-collections')
  .description('Rollback Firestore collection renames using backups')
  .requiredOption('--backups-dir <dir>', 'Directorio de backups')
  .requiredOption('--renames <json>', 'JSON con array de {from, to}')
  .option('--project <id>', 'ID del proyecto Firebase', process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'unknown')
  .option('--yes', 'Confirmar operación destructiva sin prompt', false)
  .parse()

const options = program.opts()
const renames = JSON.parse(options.renames)
const backupsDir = options.backupsDir
const projectId = options.project
const autoConfirm = options.yes || false

const LOG_FILE = path.join(backupsDir, 'rollback-log.json')

function log(message, level = 'info') {
  const entry = { timestamp: new Date().toISOString(), level, message }
  console.log(`[${level.toUpperCase()}] ${message}`)
  const logs = JSON.parse(fs.existsSync(LOG_FILE) ? fs.readFileSync(LOG_FILE, 'utf8') : '[]')
  logs.push(entry)
  fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2))
}

async function countDocuments(db, collectionName) {
  try {
    const colRef = collection(db, collectionName)
    const snapshot = await getDocs(colRef)
    return snapshot.size
  } catch {
    return 0
  }
}

async function restoreCollection(db, targetName, sourceName, backupDir) {
  const backupFile = path.join(backupDir, `${sourceName}.json`)
  if (!fs.existsSync(backupFile)) {
    log(`  ⚠ Backup no encontrado: ${backupFile}`, 'warn')
    return { failed: true, reason: 'backup_not_found' }
  }

  const items = JSON.parse(fs.readFileSync(backupFile, 'utf8'))
  log(`  Restaurando ${items.length} docs a ${sourceName}`)

  const targetRef = collection(db, targetName)
  const batch = writeBatch(db)

  for (const item of items) {
    const docRef = doc(targetRef, item.id)
    batch.set(docRef, item, { merge: true })
  }

  await batch.commit()
  log(`  ✓ Restaurados ${items.length} documentos a ${sourceName}`, 'success')
  return { success: true, restored: items.length }
}

async function deleteCollection(db, collectionName) {
  log(`  Eliminando colección: ${collectionName}`)
  const colRef = collection(db, collectionName)
  const snapshot = await getDocs(colRef)

  if (snapshot.size === 0) {
    log(`  ✓ Colección ${collectionName} ya vacía`, 'info')
    return { deleted: 0 }
  }

  const batch = writeBatch(db)
  snapshot.forEach(d => {
    batch.delete(d.ref)
  })

  await batch.commit()
  log(`  ✓ Eliminados ${snapshot.size} documentos de ${collectionName}`, 'success')
  return { deleted: snapshot.size }
}

async function main() {
  log(`🔄 Rollback iniciado — proyecto: ${projectId}`)
  log(`   Renombres (inverso): ${renames.map(r => r.to + ' → ' + r.from).join(', ')}`)

  if (!autoConfirm) {
    log('\n⚠ Esta operación eliminará datos del modelo nuevo y restaurará el modelo anterior.', 'warn')
    log('   Usa --yes para confirmar automáticamente.', 'warn')
    log('   Presiona Ctrl+C para cancelar.')
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

  const results = { completed: 0, failed: 0, errors: [] }

  for (const r of renames.reverse()) {
    log(`\n↩ Restaurando: ${r.to} → ${r.from}`)

    try {
      const restoreResult = await restoreCollection(db, r.from, r.to, backupsDir)
      if (restoreResult.success) {
        await deleteCollection(db, r.to)
        results.completed++
      } else {
        results.failed++
        results.errors.push({ collection: r.to, reason: restoreResult.reason })
      }
    } catch (e) {
      log(`  ✗ Error restaurando ${r.to} → ${r.from}: ${e.message}`, 'error')
      results.failed++
      results.errors.push({ collection: r.to, error: e.message })
    }
  }

  log('\n📋 Resumen de rollback')
  log(`   Completados: ${results.completed}`)
  log(`   Fallidos: ${results.failed}`)
  log(`   Errores: ${results.errors.length}`)

  if (results.errors.length > 0) {
    log('\n❌ Errores:', 'error')
    results.errors.forEach(e => log(`   - ${e.collection}: ${e.reason || e.error}`, 'error'))
  }

  log('\n⚠ IMPORTANTE: Revisa las reglas de Firestore y los índices después del rollback.', 'warn')
  log('   Las reglas de seguridad pueden necesitar revertirse también.', 'warn')
}

main().catch((e) => {
  console.error('Fatal:', e)
  process.exit(1)
})