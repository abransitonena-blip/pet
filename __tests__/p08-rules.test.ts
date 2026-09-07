import { RULES, getClaimRole, isActiveAccount, noRoleField } from '../src/lib/rules'

const customer = { uid: 'cust-1', claims: { role: 'customer' } }
const walker = { uid: 'walker-1', claims: { role: 'walker' }, walkerProfileStatus: 'active' }
const supervisor = { uid: 'sup-1', claims: { role: 'supervisor' } }
const admin = { uid: 'admin-1', claims: { role: 'admin' } }
const noClaims = { uid: 'anon-1', claims: {} }

const ownRes = {
  customer: { uid: 'cust-1' },
  assignment: { walkerId: 'walker-1' },
  status: 'assigned',
}
const otherRes = { customer: { uid: 'cust-2' }, assignment: { walkerId: 'walker-2' }, status: 'assigned' }

describe('P0.8 — reglas de autorización (mirror firestore.rules)', () => {
  // 1) customer → /familia: permitido
  it('customer lee/crea sus propios recursos', () => {
    expect(RULES.canReadCustomerProfile(customer, 'cust-1')).toBe(true)
    expect(RULES.canCreateReservation(customer, ownRes)).toBe(true)
    expect(RULES.canCreateDog(customer, { ownerId: 'cust-1' })).toBe(true)
  })

  // 2) customer → /walker: denegado
  it('customer no accede a sesiones/paseos ajenos', () => {
    expect(RULES.isAssignedWalker(customer, ownRes)).toBe(false)
    expect(RULES.canReadReservation(customer, otherRes)).toBe(false)
    expect(RULES.canReadSession(customer, { clientId: 'cust-2', walkerId: 'walker-2' })).toBe(false)
  })

  // 3) customer → /admin: denegado
  it('customer no toca finanzas, roles ni auditoría', () => {
    expect(RULES.canAssignRole(customer)).toBe(false)
    expect(RULES.canReadWallet(customer, 'wallet-admin')).toBe(false)
    expect(RULES.canReadAuditLogs(customer)).toBe(false)
    expect(RULES.canWriteUsers()).toBe(false)
  })

  // 4) walker → sesión asignada: permitido
  it('walker asignado lee y actualiza su sesión', () => {
    expect(RULES.canReadReservation(walker, ownRes)).toBe(true)
    expect(RULES.canReadSession(walker, { clientId: 'cust-1', walkerId: 'walker-1' })).toBe(true)
    expect(RULES.canUpdateReservation(walker, ownRes, { status: 'in_progress' })).toBe(true)
  })

  // 5) walker → otra sesión: denegado
  it('walker no lee sesiones que no le fueron asignadas', () => {
    expect(RULES.canReadReservation(walker, otherRes)).toBe(false)
    expect(RULES.canReadSession(walker, { clientId: 'cust-2', walkerId: 'walker-2' })).toBe(false)
  })

  // 6) walker → finanzas: denegado
  it('walker no accede a wallets/auditoría', () => {
    expect(RULES.canReadWallet(walker, 'wallet-admin')).toBe(false)
    expect(RULES.canReadAuditLogs(walker)).toBe(false)
  })

  // 7) supervisor → operación autorizada: permitido
  it('supervisor lee operación e incidencias', () => {
    expect(RULES.canReadReservation(supervisor, ownRes)).toBe(true)
    expect(RULES.canReadSession(supervisor, { clientId: 'cust-2', walkerId: 'walker-2' })).toBe(true)
    expect(getClaimRole(supervisor)).toBe('supervisor')
  })

  // 8) supervisor → cambiar roles: denegado
  it('supervisor no asigna roles ni edita walkerProfiles', () => {
    expect(RULES.canAssignRole(supervisor)).toBe(false)
    expect(RULES.canWriteUsers()).toBe(false)
    expect(RULES.canUpdateWalkerProfile(supervisor, 'walker-1', {})).toBe(false)
  })

  // 9) admin → administración: permitido
  it('admin administra roles, finanzas y auditoría', () => {
    expect(RULES.canAssignRole(admin)).toBe(true)
    expect(RULES.canReadWallet(admin, 'wallet-admin')).toBe(true)
    expect(RULES.canReadAuditLogs(admin)).toBe(true)
    expect(RULES.canReadReservation(admin, otherRes)).toBe(true)
  })

  // 10) sin claims privilegiados → panel interno denegado
  it('usuario sin claims se resuelve a customer y queda fuera', () => {
    expect(getClaimRole(noClaims)).toBe('customer')
    expect(RULES.canAssignRole(noClaims)).toBe(false)
    expect(RULES.canReadAuditLogs(noClaims)).toBe(false)
    expect(RULES.canReadReservation(noClaims, otherRes)).toBe(false)
  })

  // 11) cuenta suspendida → denegada
  it('walker suspendido pierde acceso aunque esté asignado', () => {
    const suspended = { ...walker, walkerProfileStatus: 'suspended' }
    expect(isActiveAccount(suspended)).toBe(false)
    expect(RULES.canReadReservation(suspended, ownRes)).toBe(false)
    expect(RULES.canUpdateReservation(suspended, ownRes, { status: 'in_progress' })).toBe(false)
  })

  // 12) usuario escribe su propio rol → denegado
  it('nadie escribe su propio rol/claims por Firestore', () => {
    expect(RULES.canWriteUsers()).toBe(false)
    expect(RULES.canWriteOwnRole()).toBe(false)
    expect(noRoleField({ role: 'admin', claims: {} })).toBe(false)
    expect(RULES.canCreateCustomerProfile(customer, 'cust-1', { role: 'admin' })).toBe(false)
    expect(RULES.canCreateDog(customer, { ownerId: 'cust-1', role: 'walker' })).toBe(false)
    expect(RULES.canUpdateWalkerProfile(walker, 'walker-1', { role: 'admin' })).toBe(false)
  })

  // 13) claims antiguos → renovación correcta (ver p08-roles.test.ts)
  // 14) redirect malicioso/externo → rechazado (ver p08-roles.test.ts)

  // 15) sesión cerrada → no conserva acceso (ver p08-session.test.tsx / middleware)
  it('usuario sin sesión (uid vacío) no pasa ninguna regla', () => {
    const signedOut = { uid: '', claims: { role: 'admin' } }
    expect(RULES.canReadReservation(signedOut, ownRes)).toBe(false)
    expect(RULES.canReadWallet(signedOut, 'wallet-admin')).toBe(false)
  })
})
