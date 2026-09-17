import { readFileSync } from 'node:fs'

describe('admin audit log is server-only', () => {
  const route = readFileSync('src/app/api/admin/audit-log/route.ts', 'utf8')
  const auditLog = readFileSync('src/lib/auditLog.ts', 'utf8')

  test('requires an admin token before writing anything', () => {
    expect(route).toContain('verifyAdminToken')
    const authIndex = route.indexOf("status: 401")
    const adminIndex = route.indexOf("status: 403")
    const writeIndex = route.indexOf("collection('audit-logs').doc()")
    expect(authIndex).toBeLessThan(writeIndex)
    expect(adminIndex).toBeLessThan(writeIndex)
  })

  test('the actor uid comes from the verified token, never from the request body', () => {
    expect(route).toContain('actor: { uid: adminUid }')
    expect(route).not.toContain('body.actor')
    expect(route).not.toContain('body.uid')
  })

  test('fails closed behind T3 identity availability', () => {
    expect(route).toContain('getPrivilegedFirestore()')
    expect(route).toContain('privileged-identity-not-configured')
  })

  test('rejects an entry outside the known action/entity sets', () => {
    expect(route).toContain('VALID_ACTIONS')
    expect(route).toContain('VALID_ENTITIES')
    expect(route).toContain("code: 'invalid-entry'")
  })

  test('the client helper posts through the endpoint instead of writing Firestore directly', () => {
    expect(auditLog).toContain("fetch('/api/admin/audit-log'")
    expect(auditLog).not.toContain('addDoc(')
    expect(auditLog).not.toContain("collection(db, 'audit-logs')")
  })
})
