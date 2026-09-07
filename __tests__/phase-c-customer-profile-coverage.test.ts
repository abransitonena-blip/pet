/* eslint-disable @typescript-eslint/no-require-imports */

export {}

const coverage = require('../scripts/lib/customer-profile-coverage.cjs')

describe('verify-customer-profile-coverage', () => {
  test('requires the exact project and rejects write modes', () => {
    expect(() => coverage.parseArgs(['--project', 'other', '--verify-only'])).toThrow('project-not-allowed')
    expect(() => coverage.parseArgs(['--project', 'pet-1cb0b', '--execute'])).toThrow('write-mode-not-supported')
    expect(() => coverage.parseArgs(['--project', 'pet-1cb0b', '--repair'])).toThrow('write-mode-not-supported')
  })

  test('reports only counts for legacy IDs without a canonical profile', async () => {
    const report = await coverage.runVerification({
      resolveProjectId: async () => 'pet-1cb0b',
      listLegacyPage: jest.fn()
        .mockResolvedValueOnce({ ids: ['legacy-a', 'legacy-b'], nextCursor: 'cursor' })
        .mockResolvedValueOnce({ ids: ['legacy-c'], nextCursor: null }),
      listCanonicalIds: jest.fn()
        .mockResolvedValueOnce(['legacy-a'])
        .mockResolvedValueOnce(['legacy-c']),
    }, coverage.parseArgs(['--project', 'pet-1cb0b', '--verify-only']))

    expect(report).toEqual(expect.objectContaining({
      legacyCount: 3,
      canonicalWithSameIdCount: 2,
      legacyWithoutCanonicalCount: 1,
      containsIdentifiers: false,
      writesPerformed: 0,
    }))
    expect(JSON.stringify(report)).not.toMatch(/legacy-[abc]/)
  })

  test('stops at the configured bound and marks truncated output', async () => {
    const report = await coverage.runVerification({
      resolveProjectId: async () => 'pet-1cb0b',
      listLegacyPage: async () => ({ ids: ['one', 'two'], nextCursor: 'more' }),
      listCanonicalIds: async () => [],
    }, coverage.parseArgs(['--project', 'pet-1cb0b', '--verify-only', '--max-documents', '2']))
    expect(report).toMatchObject({ legacyCount: 2, legacyWithoutCanonicalCount: 2, truncated: true })
  })

  test('sanitizes failures without identifiers or provider messages', () => {
    const failure = coverage.safeFailure(new Error('token /private/path project 123'), { projectId: 'pet-1cb0b' })
    expect(failure).toEqual(expect.objectContaining({ code: 'unknown-error', containsIdentifiers: false, writesPerformed: 0 }))
    expect(JSON.stringify(failure)).not.toMatch(/token|private|123/)
  })
})
