// eslint-disable-next-line @typescript-eslint/no-require-imports
const coverage = require('../scripts/lib/walker-session-coverage.cjs') as {
  parseArgs: (argv: string[]) => Record<string, unknown>
  abbreviateIdentifier: (value: string) => string | null
  compareCoverage: (legacy: Array<Record<string, unknown>>, canonical: Array<Record<string, unknown>>) => Record<string, unknown>
  readStatusPages: (input: Record<string, unknown>) => Promise<{ documents: unknown[]; truncated: boolean }>
  runVerification: (adapter: Record<string, unknown>, options: Record<string, unknown>) => Promise<Record<string, unknown>>
  safeFailure: (error: unknown, options?: Record<string, unknown>) => Record<string, unknown>
  CoverageVerificationError: new (code: string, stage?: string) => Error
}

const options = coverage.parseArgs(['--project', 'pet-1cb0b', '--verify-only'])

function fixtureDocument(id: string, data: Record<string, unknown>) {
  return { id, data }
}

describe('cobertura walker legacy/canónica — seguridad de argumentos', () => {
  test('es estrictamente verify-only y exige el proyecto autorizado', () => {
    expect(options).toMatchObject({ projectId: 'pet-1cb0b', verifyOnly: true, pageSize: 100 })
    expect(() => coverage.parseArgs(['--project', 'otro-proyecto', '--verify-only'])).toThrow('project-not-allowed')
    expect(() => coverage.parseArgs(['--project', 'pet-1cb0b', '--execute'])).toThrow('write-mode-not-supported')
    expect(() => coverage.parseArgs(['--project', 'pet-1cb0b', '--repair'])).toThrow('write-mode-not-supported')
    expect(() => coverage.parseArgs(['--verify-only'])).toThrow('project-not-allowed')
  })

  test('limita tamaño de página y máximo de documentos', () => {
    expect(coverage.parseArgs([
      '--project', 'pet-1cb0b', '--page-size', '25', '--max-documents', '500',
    ])).toMatchObject({ pageSize: 25, maxDocuments: 500 })
    expect(() => coverage.parseArgs(['--project', 'pet-1cb0b', '--page-size', '251'])).toThrow('invalid-page-size')
    expect(() => coverage.parseArgs(['--project', 'pet-1cb0b', '--max-documents', '10001'])).toThrow('invalid-max-documents')
  })

  test('abrevia identificadores y la salida de error no refleja mensajes', () => {
    expect(coverage.abbreviateIdentifier('identifier-sensitive-1234')).toBe('identi…1234')
    const report = coverage.safeFailure(new Error('token=secret /private/adc.json'), options)
    expect(report).toEqual({
      schemaVersion: 1,
      mode: 'verify-only',
      projectId: 'pet-1cb0b',
      status: 'blocked',
      stage: 'unknown',
      code: 'read-failed',
    })
    expect(JSON.stringify(report)).not.toMatch(/secret|adc\.json|token/i)
  })
})

describe('cobertura walker legacy/canónica — comparación sin PII', () => {
  test('relaciona por referencia directa y por UID/fecha/hora', () => {
    const legacy = [
      fixtureDocument('legacy-direct-sensitive', {
        status: 'assigned', assignment: { walkerId: 'walker-1' },
        walkSessionId: 'session-direct-sensitive', date: '2026-08-14', time: '09:00',
      }),
      fixtureDocument('legacy-fingerprint-sensitive', {
        status: 'confirmed', assignment: { walkerId: 'walker-2' },
        date: '2026-08-15', time: '10:00',
      }),
    ]
    const canonical = [
      fixtureDocument('session-direct-sensitive', {
        status: 'assigned', walkerId: 'walker-1', scheduledDate: '2026-08-14', scheduledStart: '09:00',
      }),
      fixtureDocument('session-fingerprint-sensitive', {
        status: 'confirmed', walkerId: 'walker-2', scheduledDate: '2026-08-15', scheduledStart: '10:00',
      }),
    ]
    expect(coverage.compareCoverage(legacy, canonical)).toMatchObject({
      assignedLegacyCount: 2,
      assignedCanonicalCount: 2,
      matchedLegacyCount: 2,
      legacyWithoutCanonicalCount: 0,
      orphanCanonicalCount: 0,
    })
  })

  test('reporta huérfanos y duplicados solo con IDs abreviados', () => {
    const legacy = [
      fixtureDocument('legacy-unmatched-sensitive', {
        assignment: { walkerId: 'walker-private-1' }, date: '2026-08-15', time: '10:00',
        customer: { name: 'NO MOSTRAR', phone: '5555555555' },
      }),
      fixtureDocument('legacy-duplicate-one', { assignment: { walkerId: 'walker-private-2' }, date: '2026-08-16', time: '11:00' }),
      fixtureDocument('legacy-duplicate-two', { assignment: { walkerId: 'walker-private-2' }, date: '2026-08-16', time: '11:00' }),
    ]
    const canonical = [
      fixtureDocument('canonical-orphan-sensitive', { walkerId: 'walker-private-3', scheduledDate: '2026-08-17', scheduledStart: '12:00' }),
    ]
    const report = coverage.compareCoverage(legacy, canonical)
    expect(report).toMatchObject({
      legacyWithoutCanonicalCount: 3,
      orphanCanonicalCount: 1,
      possibleDuplicateGroupCount: 1,
    })
    const serialized = JSON.stringify(report)
    expect(serialized).not.toMatch(/NO MOSTRAR|5555555555|walker-private|legacy-unmatched-sensitive|canonical-orphan-sensitive/)
  })

  test('señala estados asignados sin UID sin leer el nombre legacy', () => {
    const report = coverage.compareCoverage([
      fixtureDocument('legacy-name-only-sensitive', { status: 'assigned' }),
      fixtureDocument('legacy-pending-sensitive', { status: 'pending' }),
    ], [
      fixtureDocument('canonical-assigned-sensitive', { status: 'assigned' }),
      fixtureDocument('canonical-pending-sensitive', { status: 'pending_assignment' }),
    ])
    expect(report).toMatchObject({
      assignedLegacyCount: 0,
      assignedCanonicalCount: 0,
      legacyActiveWithoutWalkerUidCount: 1,
      canonicalActiveWithoutWalkerUidCount: 1,
    })
    expect(JSON.stringify(report)).not.toMatch(/name-only-sensitive|assigned-sensitive/)
  })
})

describe('cobertura walker legacy/canónica — lectura paginada', () => {
  test('pagina con cursor, proyección y límites sin invocar escrituras', async () => {
    const queryPage = jest.fn()
      .mockResolvedValueOnce({ documents: [fixtureDocument('one', {})], nextCursor: 'cursor-1' })
      .mockResolvedValueOnce({ documents: [fixtureDocument('two', {})], nextCursor: null })
    const result = await coverage.readStatusPages({
      collectionName: 'reservations', statuses: ['assigned'], fields: ['status', 'assignment.walkerId'],
      pageSize: 1, maxDocuments: 10, queryPage,
    })
    expect(result).toEqual({ documents: [fixtureDocument('one', {}), fixtureDocument('two', {})], truncated: false })
    expect(queryPage).toHaveBeenNthCalledWith(1, expect.objectContaining({ cursor: null, limit: 1 }))
    expect(queryPage).toHaveBeenNthCalledWith(2, expect.objectContaining({ cursor: 'cursor-1', limit: 1 }))
  })

  test('preflight valida proyecto resuelto antes de consultar', async () => {
    const queryPage = jest.fn()
    await expect(coverage.runVerification({
      resolveProjectId: jest.fn(async () => 'otro-proyecto'), queryPage,
    }, options)).rejects.toMatchObject({ code: 'resolved-project-mismatch' })
    expect(queryPage).not.toHaveBeenCalled()
  })

  test('runVerification solo entrega conteos e identificadores abreviados', async () => {
    const adapter = {
      resolveProjectId: jest.fn(async () => 'pet-1cb0b'),
      queryPage: jest.fn(async ({ collectionName, status }: { collectionName: string; status: string }) => {
        if (collectionName === 'reservations' && status === 'assigned') {
          return { documents: [fixtureDocument('legacy-sensitive-id', {
            status, assignment: { walkerId: 'walker-sensitive' }, walkSessionId: 'canonical-sensitive-id',
          })], nextCursor: null }
        }
        if (collectionName === 'walkSessions' && status === 'assigned') {
          return { documents: [fixtureDocument('canonical-sensitive-id', { status, walkerId: 'walker-sensitive' })], nextCursor: null }
        }
        return { documents: [], nextCursor: null }
      }),
    }
    const report = await coverage.runVerification(adapter, options)
    expect(report).toMatchObject({
      mode: 'verify-only', projectId: 'pet-1cb0b', complete: true,
      coverage: { matchedLegacyCount: 1, legacyWithoutCanonicalCount: 0, orphanCanonicalCount: 0 },
    })
    expect(JSON.stringify(report)).not.toMatch(/walker-sensitive|legacy-sensitive-id|canonical-sensitive-id/)
  })
})
