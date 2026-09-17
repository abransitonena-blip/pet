import { readFileSync } from 'node:fs'

describe('M1 private media: signed authenticated uploads, fail-closed, ownership-checked', () => {
  const route = readFileSync('src/app/api/media/private/signature/route.ts', 'utf8')
  const signer = readFileSync('src/lib/media/privateMediaAdmin.server.ts', 'utf8')

  test('signs an authenticated (not public) Cloudinary delivery type', () => {
    expect(signer).toContain("type = 'authenticated' as const")
    expect(signer).toContain('type=${type}')
  })

  test('the public_id is an opaque random UUID, never the session/report id or any identifying data', () => {
    expect(signer).toContain('randomUUID()')
    expect(signer).not.toContain('sessionId')
  })

  test('fails closed behind PRIVATE_MEDIA_UPLOADS_ENABLED', () => {
    expect(route).toContain('FEATURE_FLAGS.PRIVATE_MEDIA_UPLOADS_ENABLED')
    expect(route).toContain('status: 503')
  })

  test('a Walker can only sign for a session verified server-side as assigned to them', () => {
    expect(route).toContain('verifyTokenRole(token)')
    expect(route).toContain("caller.role === 'walker'")
    expect(route).toContain("collection('walkSessions')")
    expect(route).toContain('isAssignedToWalker(')
    expect(route).toContain("status: 403")
  })

  test('only allows a fixed set of private folders, no caller-controlled path', () => {
    expect(route).toContain('ALLOWED_FOLDERS')
    expect(route).toContain("'pet-ap-private/walk-reports'")
    expect(route).not.toMatch(/folder:\s*body\.folder\}\)\s*$/m)
  })

  test('strips profile metadata just like the public gallery signer', () => {
    expect(signer).toContain("transformation = 'fl_strip_profile' as const")
  })
})
