/* global module */
'use strict'

const ALLOWED_PROJECT = 'pet-1cb0b'
const DEFAULT_PAGE_SIZE = 100
const MAX_PAGE_SIZE = 250
const DEFAULT_MAX_DOCUMENTS = 10_000
const MAX_SAMPLE_IDS = 25
const LEGACY_ACTIVE_STATUSES = Object.freeze([
  'pending',
  'assigned',
  'walker_confirmed',
  'confirmed',
  'on_the_way',
  'en_camino',
  'arrived',
  'in_progress',
  'paseando',
])
const CANONICAL_ACTIVE_STATUSES = Object.freeze([
  'requested',
  'pending_assignment',
  'assigned',
  'confirmed',
  'on_the_way',
  'arrived',
  'in_progress',
])

class CoverageVerificationError extends Error {
  constructor(code, stage = 'arguments') {
    super(code)
    this.name = 'CoverageVerificationError'
    this.code = code
    this.stage = stage
  }
}

function usage() {
  return [
    'Consulta de solo lectura (requiere autorización independiente):',
    '  node scripts/verify-walker-session-coverage.mjs --project pet-1cb0b --verify-only',
    '',
    'Opciones locales: --page-size 1..250, --max-documents 1..10000.',
    'No existen modos --execute ni --repair.',
  ].join('\n')
}

function parsePositiveInteger(value, maximum, code) {
  if (!/^\d+$/.test(value || '')) throw new CoverageVerificationError(code)
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new CoverageVerificationError(code)
  }
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
    else if (value === '--execute' || value === '--repair') {
      throw new CoverageVerificationError('write-mode-not-supported')
    } else if (['--project', '--page-size', '--max-documents'].includes(value)) {
      const next = argv[index + 1]
      if (!next || next.startsWith('--')) throw new CoverageVerificationError('missing-argument-value')
      if (value === '--project') options.projectId = next.trim()
      if (value === '--page-size') options.pageSize = parsePositiveInteger(next, MAX_PAGE_SIZE, 'invalid-page-size')
      if (value === '--max-documents') options.maxDocuments = parsePositiveInteger(next, DEFAULT_MAX_DOCUMENTS, 'invalid-max-documents')
      index += 1
    } else {
      throw new CoverageVerificationError('unknown-argument')
    }
  }
  if (options.help) return options
  if (options.projectId !== ALLOWED_PROJECT) throw new CoverageVerificationError('project-not-allowed')
  return options
}

function stringField(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function abbreviateIdentifier(value) {
  const safe = stringField(value)
  if (!safe) return null
  if (safe.length <= 10) return `${safe.slice(0, 3)}…${safe.slice(-2)}`
  return `${safe.slice(0, 6)}…${safe.slice(-4)}`
}

function legacyWalkerId(data) {
  return stringField(data?.assignment?.walkerId) || stringField(data?.walkerId)
}

function normalizedDate(data) {
  return stringField(data?.scheduledDate) || stringField(data?.date)
}

function normalizedTime(data) {
  return stringField(data?.scheduledStart) || stringField(data?.startTime) || stringField(data?.time)
}

function fingerprint(data, walkerId) {
  const date = normalizedDate(data)
  const time = normalizedTime(data)
  return walkerId && date && time ? `${walkerId}\u0000${date}\u0000${time}` : null
}

function uniqueStrings(values) {
  return [...new Set(values.map(stringField).filter(Boolean))]
}

function normalizeLegacyDocument(document) {
  const data = document.data || {}
  const walkerId = legacyWalkerId(data)
  return {
    id: String(document.id),
    status: stringField(data.status),
    walkerId,
    fingerprint: fingerprint(data, walkerId),
    directSessionIds: uniqueStrings([
      data.walkSessionId,
      data.sessionId,
      data.canonicalSessionId,
    ]),
  }
}

function normalizeCanonicalDocument(document) {
  const data = document.data || {}
  const walkerId = stringField(data.walkerId)
  return {
    id: String(document.id),
    status: stringField(data.status),
    walkerId,
    fingerprint: fingerprint(data, walkerId),
    legacyReservationIds: uniqueStrings([
      data.legacyReservationId,
      data.reservationId,
      data.sourceReservationId,
    ]),
  }
}

function groupBy(items, keySelector) {
  const groups = new Map()
  for (const item of items) {
    const key = keySelector(item)
    if (!key) continue
    const group = groups.get(key) || []
    group.push(item)
    groups.set(key, group)
  }
  return groups
}

function sampleIds(items) {
  return items
    .map((item) => abbreviateIdentifier(typeof item === 'string' ? item : item.id))
    .filter(Boolean)
    .sort()
    .slice(0, MAX_SAMPLE_IDS)
}

function compareCoverage(legacyDocuments, canonicalDocuments) {
  const allLegacy = legacyDocuments.map(normalizeLegacyDocument)
  const allCanonical = canonicalDocuments.map(normalizeCanonicalDocument)
  const legacy = allLegacy.filter((document) => document.walkerId)
  const canonical = allCanonical.filter((document) => document.walkerId)
  const legacyWithoutWalkerUid = allLegacy.filter((document) => (
    !document.walkerId && document.status !== 'pending'
  ))
  const canonicalWithoutWalkerUid = allCanonical.filter((document) => (
    !document.walkerId && !['requested', 'pending_assignment'].includes(document.status)
  ))
  const canonicalById = new Map(canonical.map((document) => [document.id, document]))
  const canonicalByLegacyId = groupBy(canonical.flatMap((document) => (
    document.legacyReservationIds.map((legacyId) => ({ ...document, legacyId }))
  )), (document) => document.legacyId)
  const canonicalByFingerprint = groupBy(canonical, (document) => document.fingerprint)
  const matchedLegacyIds = new Set()
  const matchedCanonicalIds = new Set()
  const ambiguousLegacyIds = new Set()

  for (const legacyDocument of legacy) {
    const directMatches = new Map()
    const sameId = canonicalById.get(legacyDocument.id)
    if (sameId) directMatches.set(sameId.id, sameId)
    for (const id of legacyDocument.directSessionIds) {
      const direct = canonicalById.get(id)
      if (direct) directMatches.set(direct.id, direct)
    }
    for (const direct of canonicalByLegacyId.get(legacyDocument.id) || []) {
      directMatches.set(direct.id, direct)
    }
    const candidates = directMatches.size
      ? [...directMatches.values()]
      : (legacyDocument.fingerprint ? canonicalByFingerprint.get(legacyDocument.fingerprint) || [] : [])
    if (candidates.length === 1) {
      matchedLegacyIds.add(legacyDocument.id)
      matchedCanonicalIds.add(candidates[0].id)
    } else if (candidates.length > 1) {
      ambiguousLegacyIds.add(legacyDocument.id)
      for (const candidate of candidates) matchedCanonicalIds.add(candidate.id)
    }
  }

  const legacyWithoutCanonical = legacy.filter((document) => !matchedLegacyIds.has(document.id) && !ambiguousLegacyIds.has(document.id))
  const orphanCanonical = canonical.filter((document) => !matchedCanonicalIds.has(document.id))
  const duplicateLegacyGroups = [...groupBy(legacy, (document) => document.fingerprint).values()].filter((group) => group.length > 1)
  const duplicateCanonicalGroups = [...groupBy(canonical, (document) => document.fingerprint).values()].filter((group) => group.length > 1)

  return {
    assignedLegacyCount: legacy.length,
    assignedCanonicalCount: canonical.length,
    legacyActiveWithoutWalkerUidCount: legacyWithoutWalkerUid.length,
    canonicalActiveWithoutWalkerUidCount: canonicalWithoutWalkerUid.length,
    matchedLegacyCount: matchedLegacyIds.size,
    legacyWithoutCanonicalCount: legacyWithoutCanonical.length,
    orphanCanonicalCount: orphanCanonical.length,
    possibleDuplicateGroupCount: duplicateLegacyGroups.length + duplicateCanonicalGroups.length + ambiguousLegacyIds.size,
    samples: {
      legacyWithoutCanonical: sampleIds(legacyWithoutCanonical),
      orphanCanonical: sampleIds(orphanCanonical),
      legacyWithoutWalkerUid: sampleIds(legacyWithoutWalkerUid),
      canonicalWithoutWalkerUid: sampleIds(canonicalWithoutWalkerUid),
      ambiguousLegacy: sampleIds([...ambiguousLegacyIds]),
      duplicateLegacy: duplicateLegacyGroups.slice(0, MAX_SAMPLE_IDS).map(sampleIds),
      duplicateCanonical: duplicateCanonicalGroups.slice(0, MAX_SAMPLE_IDS).map(sampleIds),
    },
  }
}

async function readStatusPages({ collectionName, statuses, fields, pageSize, maxDocuments, queryPage }) {
  const documents = []
  let truncated = false
  for (const status of statuses) {
    let cursor = null
    while (documents.length < maxDocuments) {
      const remaining = maxDocuments - documents.length
      const result = await queryPage({
        collectionName,
        status,
        fields,
        cursor,
        limit: Math.min(pageSize, remaining),
      })
      documents.push(...result.documents)
      if (!result.nextCursor || result.documents.length === 0) break
      cursor = result.nextCursor
    }
    if (documents.length >= maxDocuments) {
      truncated = true
      break
    }
  }
  return { documents, truncated }
}

async function runVerification(adapter, options) {
  if (!options.verifyOnly || options.projectId !== ALLOWED_PROJECT) {
    throw new CoverageVerificationError('verify-only-required', 'preflight')
  }
  const resolvedProject = await adapter.resolveProjectId()
  if (resolvedProject !== ALLOWED_PROJECT) throw new CoverageVerificationError('resolved-project-mismatch', 'initialization')

  const legacyRead = await readStatusPages({
    collectionName: 'reservations',
    statuses: LEGACY_ACTIVE_STATUSES,
    fields: [
      'status', 'assignment.walkerId', 'walkerId', 'date', 'time', 'startTime',
      'scheduledDate', 'scheduledStart', 'walkSessionId', 'sessionId',
      'canonicalSessionId', 'orderId',
    ],
    pageSize: options.pageSize,
    maxDocuments: options.maxDocuments,
    queryPage: adapter.queryPage,
  })
  const canonicalRead = await readStatusPages({
    collectionName: 'walkSessions',
    statuses: CANONICAL_ACTIVE_STATUSES,
    fields: [
      'status', 'walkerId', 'date', 'time', 'startTime', 'scheduledDate',
      'scheduledStart', 'legacyReservationId', 'reservationId',
      'sourceReservationId', 'orderId',
    ],
    pageSize: options.pageSize,
    maxDocuments: options.maxDocuments,
    queryPage: adapter.queryPage,
  })
  return {
    schemaVersion: 1,
    mode: 'verify-only',
    projectId: ALLOWED_PROJECT,
    complete: !legacyRead.truncated && !canonicalRead.truncated,
    pagination: {
      pageSize: options.pageSize,
      maxDocumentsPerCollection: options.maxDocuments,
      legacyTruncated: legacyRead.truncated,
      canonicalTruncated: canonicalRead.truncated,
    },
    coverage: compareCoverage(legacyRead.documents, canonicalRead.documents),
  }
}

function safeFailure(error, options = {}) {
  const known = error instanceof CoverageVerificationError
  return {
    schemaVersion: 1,
    mode: 'verify-only',
    projectId: options.projectId === ALLOWED_PROJECT ? ALLOWED_PROJECT : null,
    status: 'blocked',
    stage: known ? error.stage : 'unknown',
    code: known ? error.code : 'read-failed',
  }
}

module.exports = {
  ALLOWED_PROJECT,
  CANONICAL_ACTIVE_STATUSES,
  CoverageVerificationError,
  LEGACY_ACTIVE_STATUSES,
  abbreviateIdentifier,
  compareCoverage,
  normalizeCanonicalDocument,
  normalizeLegacyDocument,
  parseArgs,
  readStatusPages,
  runVerification,
  safeFailure,
  usage,
}
