#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')

function log(message, level = 'info') {
  console.log(`[${level.toUpperCase()}] ${message}`)
}

function parseArgs() {
  const args = process.argv.slice(2)
  const result = {
    verifyOnly: false,
    fixturesDir: null,
    renames: null,
    reportPath: null,
    projectId: null
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    switch (arg) {
      case '--verify-only':
        result.verifyOnly = true
        break
      case '--fixtures-dir':
        if (i + 1 < args.length) result.fixturesDir = args[++i]
        break
      case '--renames':
        if (i + 1 < args.length) result.renames = args[++i]
        break
      case '--report':
        if (i + 1 < args.length) result.reportPath = args[++i]
        break
      case '--project':
        if (i + 1 < args.length) result.projectId = args[++i]
        break
      case '--yes':
      case '--production':
        result.yes = true
        break
      default:
        console.error(`ERROR: Unknown argument '${arg}'`)
        console.log('Usage: node scripts/migrate-collections.js --verify-only --fixtures-dir <dir> --renames <json> [--report <path>] [--project <id>]')
        process.exit(2)
    }
  }

  return result
}

function validatePath(dir) {
  if (!dir) return true

  const resolved = path.resolve(dir)
  const fixturesPath = path.resolve(__dirname, 'fixtures')

  const isRelative = resolved.startsWith(fixturesPath) ||
    resolved.startsWith(fixturesPath + path.sep)

  if (!isRelative) {
    console.error('ERROR: --fixtures-dir must be within fixtures directory')
    process.exit(2)
  }

  return true
}

function getCollectionCount(collectionName, fixturesDir) {
  const dataPath = path.join(fixturesDir, `${collectionName}.json`)

  if (!fs.existsSync(dataPath)) {
    return 0
  }

  try {
    const content = fs.readFileSync(dataPath, 'utf8')
    const json = JSON.parse(content)
    if (!Array.isArray(json)) return 0

    return json.reduce((count, item) => {
      if (!item || typeof item !== 'object') return count
      if (!('id' in item) && !('_id' in item)) return count
      return count + 1
    }, 0)
  } catch {
    return 0
  }
}
function validateFixtures(fixturesDir, renames) {
  const errors = []

  for (const rename of renames) {
    const sourcePath = path.join(fixturesDir, `${rename.from}.json`)
    const targetPath = path.join(fixturesDir, `${rename.to}.json`)

    if (!fs.existsSync(sourcePath)) {
      errors.push(`Source collection '${rename.from}' not found in fixtures directory`)
    }

    try {
      const sourceContent = fs.readFileSync(sourcePath, 'utf8')
      JSON.parse(sourceContent)
    } catch {
      errors.push(`Invalid JSON in source collection '${rename.from}'`)   }

    try {
      const targetContent = fs.readFileSync(targetPath, 'utf8')
      JSON.parse(targetContent)
    } catch {
      errors.push(`Invalid JSON in target collection '${rename.to}'`)   }
  }

  if (errors.length > 0) {
    console.error('ERROR: Invalid fixtures detected:')
    errors.forEach(err => console.error('  -', err))
    process.exit(2)
  }
}

function generateVerificationReport(renames, collectionCounts) {
  const extendedRenames = renames.map(r => ({
    from: r.from,
    to: r.to,
    sourceCount: collectionCounts[r.from] || 0,
    targetCount: collectionCounts[r.to] || 0
  }))

  const totalSourceDocs = extendedRenames.reduce((sum, r) => sum + r.sourceCount, 0)
  const totalTargetDocs = extendedRenames.reduce((sum, r) => sum + r.targetCount, 0)

  const report = {
    mode: 'verify-only',
    readyForNewSchemaOnly: extendedRenames.every(r => r.sourceCount === 0 && r.targetCount === 0),
    collections: extendedRenames.reduce((acc, r) => {
      acc[`${r.from} → ${r.to}`] = {
        sourceCount: r.sourceCount,
        targetCount: r.targetCount,
        status: r.sourceCount === 0 && r.targetCount > 0 ? 'already_migrated' :
               r.sourceCount > 0 && r.targetCount > 0 ? 'conflict' : 'ready'
      }
      return acc
    }, {}),
    collisions: extendedRenames.filter(r => r.sourceCount > 0 && r.targetCount > 0).map(r => ({
      from: r.from,
      to: r.to,
      sourceCount: r.sourceCount,
      targetCount: r.targetCount
    })),
    orphanReferences: [],
    legacyDocuments: extendedRenames.filter(r => r.sourceCount > 0 && r.targetCount === 0).map(r => ({
      collection: r.from,
      count: r.sourceCount
    })),
    invalidDocuments: [],
    summary: {
      totalRenames: extendedRenames.length,
      totalSourceDocs,
      totalTargetDocs,
      alreadyMigrated: extendedRenames.filter(r => r.sourceCount === 0 && r.targetCount > 0).length,
      conflicts: extendedRenames.filter(r => r.sourceCount > 0 && r.targetCount > 0).length,
      ready: extendedRenames.filter(r => !(r.sourceCount === 0 && r.targetCount > 0) && !(r.sourceCount > 0 && r.targetCount > 0)).length,
      verifyOnly: true,
      fixtureBased: true
    }
  }

  return report
}

function saveReport(reportPath, report) {
  const dir = path.dirname(reportPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
}

async function main() {
  const options = parseArgs()

  if (!options.verifyOnly) {
    console.error('ERROR: migration writes are disabled; use --verify-only')
    process.exit(2)
  }

  validatePath(options.fixturesDir)

  const effectiveProjectId = options.projectId || 'test-project'

  if (['pet-1cb0b', 'production', 'prod', 'staging'].includes(effectiveProjectId.toLowerCase())) {
    console.error('ABORTED: verify-only requires Firebase Emulator and cannot run in production projects')
    console.error('Detected project ID:', effectiveProjectId)
    process.exit(1)
  }

  if (!options.fixturesDir) {
    console.error('ERROR: --fixtures-dir is required')
    process.exit(2)
  }

  if (!options.renames) {
    console.error('ERROR: --renames is required')
    process.exit(2)
  }

  log('🚀 Verify-only migration check started')
  log('   projectId: ' + effectiveProjectId)
  log('   fixturesDir: ' + options.fixturesDir)
  log('   renames: ' + options.renames)

  let renames
  try {
    renames = JSON.parse(options.renames)
  } catch {
    console.error('ERROR: --renames must be valid JSON')
    process.exit(2)
  }

  validateFixtures(options.fixturesDir, renames)

  const collectionCounts = {}
  for (const r of renames) {
    collectionCounts[r.from] = getCollectionCount(r.from, options.fixturesDir)
    collectionCounts[r.to] = getCollectionCount(r.to, options.fixturesDir)
  }

  const report = generateVerificationReport(renames, collectionCounts)

  const reportPath = options.reportPath || './artifacts/verify-report.json'
  saveReport(reportPath, report)

  log('\n📊 Verification results:')
  for (const [key, value] of Object.entries(report.collections)) {
    console.log(`  ${key}: ${value.status} (source: ${value.sourceCount}, target: ${value.targetCount})`)
  }

  log('\n📋 Summary:')
  console.log(`  Total renamings: ${report.summary.totalRenames}`)
  console.log(`  Already migrated: ${report.summary.alreadyMigrated}`)
  console.log(`  Conflicts: ${report.summary.conflicts}`)
  console.log(`  Ready for migration: ${report.summary.ready}`)

  if (report.summary.conflicts > 0) {
    log('\n🚨 Migration blocked: conflicts detected')
    process.exit(1)
  }

  log('\n✅ Verification completed successfully')
  process.exit(0)
}

main().catch(e => {
  console.error('Fatal:', e)
  process.exit(2)
})
