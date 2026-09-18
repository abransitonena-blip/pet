import { readFileSync } from 'node:fs'
import { buildGuardReport, guardMarker, type GuardSession } from '../src/lib/guardia'

const read = (path: string) => readFileSync(path, 'utf8')

const walk = (over: Partial<GuardSession> & { id: string }): GuardSession => ({
  status: 'requested', scheduledDate: '2026-10-02', walkerId: '', ...over,
})

describe('la guardia de la mañana', () => {
  const today = '2026-10-02'

  it('cuenta los paseos de hoy que nadie ha tomado', () => {
    const report = buildGuardReport([
      walk({ id: 'a' }),
      walk({ id: 'b', status: 'pending_assignment' }),
      walk({ id: 'c', status: 'assigned', walkerId: 'walker-1' }),
    ], today)
    expect(report.unassignedToday).toBe(2)
    expect(report.message).toContain('2 paseos de hoy sin paseador')
  })

  it('cuenta lo que quedó abierto de días pasados', () => {
    const report = buildGuardReport([
      walk({ id: 'viejo', scheduledDate: '2026-09-28', status: 'confirmed', walkerId: 'walker-1' }),
      walk({ id: 'cerrado', scheduledDate: '2026-09-28', status: 'completed' }),
      walk({ id: 'cancelado', scheduledDate: '2026-09-29', status: 'cancelled' }),
    ], today)
    expect(report.staleOpen).toBe(1)
    expect(report.message).toContain('1 paseo de días pasados sin cerrar')
  })

  it('si no hay nada que decir, no dice nada', () => {
    const report = buildGuardReport([
      walk({ id: 'ok', status: 'assigned', walkerId: 'walker-1' }),
      walk({ id: 'listo', scheduledDate: '2026-09-30', status: 'completed' }),
    ], today)
    expect(report).toEqual({ unassignedToday: 0, staleOpen: 0, message: '' })
  })

  it('un aviso al día, con su marca', () => {
    expect(guardMarker(today)).toBe('guardia_2026-10-02')
  })
})

describe('la tarea de guardia', () => {
  const route = read('src/app/api/cron/guardia/route.ts')

  it('sin secreto no hace nada', () => {
    expect(route).toContain('authorization !== `Bearer ${secret}`')
  })

  it('manda un solo aviso, no uno por paseo, y sólo a quien opera', () => {
    expect(route).toContain('staffUidsAmong(devices.docs.map((item) => item.id))')
    expect(route).toContain("title: 'Revisa la operación de hoy'")
  })

  it('el rol sale de los claims, que es de donde lo leen las reglas', () => {
    const auth = read('src/lib/serverAuth.ts')
    expect(auth).toContain('export async function staffUidsAmong')
    expect(auth).toContain('(user.customClaims ?? {}).role')
  })

  it('no repite el aviso si la tarea corre dos veces', () => {
    expect(route).toContain('collection(\'pushEvents\').doc(guardMarker(today)).create(')
    expect(route).toContain("code: 'already-sent'")
  })

  it('las dos tareas están programadas una vez al día', () => {
    const vercel = JSON.parse(read('vercel.json')) as { crons?: { path: string; schedule: string }[] }
    expect(vercel.crons).toEqual([
      { path: '/api/cron/reminders', schedule: '0 1 * * *' },
      { path: '/api/cron/guardia', schedule: '0 14 * * *' },
    ])
  })
})
