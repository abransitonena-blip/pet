// scripts/rename-collections.js
const fs = require('fs')
const { Command } = require('commander')
const { getFirestore, collection, getDocs, writeBatch, doc } = require('firebase/firestore')
const { initializeApp, getApps } = require('firebase/app')

// Configuración simple
const FIREBASE_CONFIG = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

// Comandos CLI
const program = new Command()
program
  .name('rename-collections')
  .description('Renombrar colecciones de Firestore con backups y rollback')
  .requiredOption('--backups-dir <dir>', 'Directorio para guardar backups')
  .requiredOption('--renames <json>', 'JSON con array de {from, to}')
  .parse()

const options = program.opts()
const renames = JSON.parse(options.renames)
const backupsDir = options.backupsDir

console.log('🚀 Renombre de colecciones de Firestore iniciado')
console.log('   Backups en:', backupsDir)
console.log('   Reanames:', renames.map(r => r.from + ' → ' + r.to).join(', '))

// Inicializar Firebase
let db
if (!getApps().length) {
  const app = initializeApp(FIREBASE_CONFIG)
  db = getFirestore(app)
} else {
  db = getFirestore()
}

// Verificar conexión
console.log('\n🔍 Verificando conexión con Firestore...')
try {
  const testCol = collection(db, '__test__')
  console.log('   ✓ Firestore accesible')
} catch (e) {
  console.error('   ✗ Error al conectar con Firestore:', e.message)
  process.exit(1)
}

// Crear directorio de backups
fs.mkdirSync(backupsDir, { recursive: true })

// Función para exportar colección como JSON
async function exportCollection(collectionName) {
  console.log('\n📤 Exportando colección: ' + collectionName)
  const colRef = collection(db, collectionName)
  const snapshot = await getDocs(colRef)
  const items = []

  snapshot.forEach(d => {
    const data = d.data()
    items.push({ id: d.id, ...data })
  })

  const fileName = backupsDir + '/' + collectionName + '.json'
  fs.writeFileSync(fileName, JSON.stringify(items, null, 2))
  console.log('   → ' + items.length + ' docs guardados en ' + fileName)
  return items
}

// Función para importar items a una nueva colección
async function importItemsToCollection(collectionName, items) {
  console.log('\n📥 Importando ' + items.length + ' docs a ' + collectionName)
  const colRef = collection(db, collectionName)
  const batch = writeBatch(db)

  items.forEach(item => {
    const docRef = doc(colRef, item.id)
    batch.set(docRef, item, { merge: true })
  })

  await batch.commit()
  console.log('   ✓ Importación completada para ' + collectionName)
}

// Función para eliminar colección original
async function deleteCollection(collectionName) {
  console.log('\n🗑️ Eliminando colección original: ' + collectionName)
  const colRef = collection(db, collectionName)
  const snapshot = await getDocs(colRef)

  const batch = writeBatch(db)
  snapshot.forEach(d => {
    batch.delete(d.ref)
  })

  await batch.commit()
  console.log('   ✓ ' + snapshot.size + ' docs eliminados de ' + collectionName)
}

// Función para asegurar que la nueva colección no existe (opcional)
async function ensureCollectionNotExists(collectionName) {
  const colRef = collection(db, collectionName)
  const snapshot = await getDocs(colRef)
  if (!snapshot.empty) {
    console.warn('⚠️  La colección ' + collectionName + ' ya existe con ' + snapshot.size + ' docs. Saltando creación.')
    return false
  }
  return true
}

// Función para rollback en caso de error
async function rollback(backupsDir, renames) {
  console.log('\n⚠️  Ejecutando rollback...')
  for (const r of renames.reverse()) {
    console.log('\n↩️  Restaurando: ' + r.to + ' → ' + r.from)
    const backupFile = backupsDir + '/' + r.to + '.json'
    if (!fs.existsSync(backupFile)) {
      console.warn('   ⚠ Backup no encontrado: ' + backupFile)
      continue
    }

    try {
      const items = JSON.parse(fs.readFileSync(backupFile, 'utf8'))
      await importItemsToCollection(r.from, items)
      await deleteCollection(r.to)
      console.log('   ✅ Rollback completado para ' + r.to + ' → ' + r.from)
    } catch (e) {
      console.error('   ✗ Error en rollback de ' + r.to + ' → ' + r.from + ':', e.message)
    }
  }

  console.log('\n✅ Rollback finalizado')
}

(async () => {
  const errors = []
  let completed = false

  try {
    for (const r of renames) {
      const source = r.from
      const target = r.to

      console.log('\n🔄 Procesando: ' + source + ' → ' + target)

      // 1. Exportar la colección original a backup
      const items = await exportCollection(source)

      // 2. Asegurar que el destino no existe (opcional)
      const canCreate = await ensureCollectionNotExists(target)
      if (!canCreate) continue

      // 3. Mover docs: primero crear destino, luego eliminar fuente
      await importItemsToCollection(target, items)
      await deleteCollection(source)

      console.log('   ✅ Completado: ' + source + ' → ' + target)
    }

    completed = true
    console.log('\n✅ Todas las reanames completadas exitosamente')
    console.log('\n📋 Próximos pasos:')
    console.log('   1. Actualizar clientes → customerProfiles (si lo necesitas)')
    console.log('   2. Actualizar mascotas → dogs (si lo necesitas)')
    console.log('   3. Actualizar cliente → customer (si lo necesitas)')
    console.log('   4. Regresar a escribir las reglas de seguridad / índices')
  } catch (e) {
    console.error('\n❌ Error durante el rename:', e.message)
    errors.push(e)

    // Intentar rollback
    await rollback(backupsDir, renames)
    process.exit(1)
  } finally {
    if (completed) {
      console.log('\n📁 Backups guardados en:', backupsDir)
      console.log('   Puedes restaurar con scripts/restore-collections.js')
    } else {
      console.error('\n🚫 El rename falló')
    }
  }
})()
