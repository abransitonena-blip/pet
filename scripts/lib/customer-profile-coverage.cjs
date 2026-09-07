/* global module */
'use strict'

const ALLOWED_PROJECT = 'pet-1cb0b'
const DEFAULT_PAGE_SIZE = 100
const MAX_PAGE_SIZE = 250
const DEFAULT_MAX_DOCUMENTS = 10000

class CustomerCoverageError extends Error {
  constructor(code, stage = 'arguments') {
    super(code)
    this.name = 'CustomerCoverageError'
    this.code = code
    this.stage = stage
  }
}

function usage() {
  return [
    'Consulta administrativa de solo lectura:',
    '  node scripts/verify-customer-profile-coverage.mjs --project pet-1cb0b --verify-only',
    '',
    'Solo devuelve conteos. No existen modos --execute ni --repair.',
  ].join('\n')
}

function positiveInteger(value, maximum, code) {
  if (!/^\d+$/.test(value || '')) throw new CustomerCoverageError(code)
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) throw new CustomerCoverageError(code)
  return parsed
}

function parseArgs(argv) {
  const options = {
    projectId: null,
    verifyOnly: true,
    pageSize: DEFAULT_PAGE_SIZE,
    maxDocuments: DEFAULT_MAX_DOCUMENTS,
    help: false,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === '--help' || value === '-h') options.help = true
    else if (value === '--verify-only') options.verifyOnly = true
    else if (value === '--execute' || value === '--repair') throw new CustomerCoverageError('write-mode-not-supported')
    else if (['--project', '--page-size', '--max-documents'].includes(value)) {
      const next = argv[index + 1]
      if (!next || next.startsWith('--')) throw new CustomerCoverageError('missing-argument-value')
      if (value === '--project') options.projectId = next.trim()
      if (value === '--page-size') options.pageSize = positiveInteger(next, MAX_PAGE_SIZE, 'invalid-page-size')
      if (value === '--max-documents') options.maxDocuments = positiveInteger(next, DEFAULT_MAX_DOCUMENTS, 'invalid-max-documents')
      index += 1
    } else throw new CustomerCoverageError('unknown-argument')
  }
  if (options.help) return options
  if (options.projectId !== ALLOWED_PROJECT) throw new CustomerCoverageError('project-not-allowed')
  return options
}

async function runVerification(dependencies, options) {
  const resolvedProject = await dependencies.resolveProjectId()
  if (resolvedProject !== options.projectId) throw new CustomerCoverageError('resolved-project-mismatch', 'initialization')

  let cursor = null
  let legacyCount = 0
  let canonicalCount = 0
  let missingCanonicalCount = 0
  let pages = 0
  let truncated = false

  while (legacyCount < options.maxDocuments) {
    const remaining = options.maxDocuments - legacyCount
    const page = await dependencies.listLegacyPage({ cursor, limit: Math.min(options.pageSize, remaining) })
    const ids = page.ids.map(String)
    pages += 1
    legacyCount += ids.length
    if (ids.length) {
      const existingIds = new Set(await dependencies.listCanonicalIds(ids))
      canonicalCount += existingIds.size
      missingCanonicalCount += ids.filter((id) => !existingIds.has(id)).length
    }
    if (!page.nextCursor || ids.length === 0) break
    cursor = page.nextCursor
    if (legacyCount >= options.maxDocuments) truncated = true
  }

  return {
    mode: 'verify-only',
    project: options.projectId,
    collections: { legacy: 'clients', canonical: 'customerProfiles' },
    legacyCount,
    canonicalWithSameIdCount: canonicalCount,
    legacyWithoutCanonicalCount: missingCanonicalCount,
    pages,
    truncated,
    containsIdentifiers: false,
    writesPerformed: 0,
  }
}

function safeFailure(error, options = {}) {
  return {
    ok: false,
    mode: 'verify-only',
    project: options.projectId === ALLOWED_PROJECT ? ALLOWED_PROJECT : null,
    stage: error instanceof CustomerCoverageError ? error.stage : 'verification',
    code: error instanceof CustomerCoverageError ? error.code : 'unknown-error',
    containsIdentifiers: false,
    writesPerformed: 0,
  }
}

module.exports = {
  ALLOWED_PROJECT,
  CustomerCoverageError,
  parseArgs,
  runVerification,
  safeFailure,
  usage,
}
