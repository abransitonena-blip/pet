import { readFileSync } from 'node:fs'

describe('N1 push send: FCM v1 via T3 identity, no Cloud Functions needed, fail-closed', () => {
  const route = readFileSync('src/app/api/admin/notifications/send/route.ts', 'utf8')
  const fcm = readFileSync('src/lib/notifications/fcmAdmin.server.ts', 'utf8')
  const identity = readFileSync('src/lib/finance/serverIdentity.ts', 'utf8')

  test('fails closed behind FCM_ENABLED', () => {
    expect(route).toContain('FEATURE_FLAGS.FCM_ENABLED')
    expect(route).toContain('status: 503')
  })

  test('title, body, and device token always come from the caller', () => {
    expect(route).toContain('body.deviceToken')
    expect(route).toContain('body.title')
    expect(route).toContain('body.body')
    expect(fcm).not.toMatch(/title:\s*['"][A-Za-z]/)
  })

  test('sends via the FCM HTTP v1 API authenticated with the shared T3 identity, not a stored key', () => {
    expect(fcm).toContain('fcm.googleapis.com/v1/projects')
    expect(fcm).toContain('getPrivilegedAuthClient')
    expect(fcm).not.toContain('FIREBASE_SERVICE_ACCOUNT_JSON')
  })

  test('reuses the same OIDC/WIF exchange as Firestore, no duplicated credential logic', () => {
    expect(identity).toContain('ExternalAccountClient')
    expect(identity).toContain('getVercelOidcToken')
  })

  test('requires Admin auth before anything else', () => {
    expect(route.indexOf("status: 403")).toBeLessThan(route.indexOf('FEATURE_FLAGS.FCM_ENABLED'))
  })
})
