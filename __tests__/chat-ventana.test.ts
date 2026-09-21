import { readFileSync } from 'node:fs'
import { chatWindowNotice, chatWindowState, pickChatWalk, walkStartMs } from '../src/lib/chatWindow'

const read = (path: string) => readFileSync(path, 'utf8')

/** Un paseo el 2 de octubre a las 10:00 en México son las 16:00 UTC. */
const DATE = '2026-10-02'
const START = '10:00'
const WALK = Date.UTC(2026, 9, 2, 16, 0)

describe('la ventana del chat de un paseo', () => {
  it('la hora guardada es de la Ciudad de México, no UTC', () => {
    expect(walkStartMs(DATE, START)).toBe(WALK)
  })

  it('abre dos horas antes y cierra tres después', () => {
    expect(chatWindowState(DATE, START, WALK - 2 * 60 * 60_000)).toBe('open')
    expect(chatWindowState(DATE, START, WALK)).toBe('open')
    expect(chatWindowState(DATE, START, WALK + 3 * 60 * 60_000)).toBe('open')
  })

  it('antes y después, no', () => {
    expect(chatWindowState(DATE, START, WALK - 2 * 60 * 60_000 - 60_000)).toBe('too-early')
    expect(chatWindowState(DATE, START, WALK + 3 * 60 * 60_000 + 60_000)).toBe('closed')
  })

  it('con una fecha u hora que no lo son, no inventa una ventana', () => {
    expect(chatWindowState('mañana', START, WALK)).toBe('unknown')
    expect(chatWindowState(DATE, '25:99', WALK)).toBe('unknown')
    // No ofrece un campo que las reglas van a rechazar: lo dice.
    expect(chatWindowNotice('unknown', DATE, START)).toContain('todavía no tiene una hora confirmada')
    expect(chatWindowNotice('open', DATE, START)).toBe('')
  })

  it('dice por qué no se puede escribir, y a dónde ir', () => {
    expect(chatWindowNotice('too-early', DATE, START)).toContain('dos horas antes')
    expect(chatWindowNotice('too-early', DATE, START)).toContain('administración')
    expect(chatWindowNotice('closed', DATE, START)).toContain('Puedes leer lo que se escribió')
  })

  it('a la familia no la manda con administración: ya no le escribe ahí', () => {
    for (const state of ['too-early', 'closed'] as const) {
      const notice = chatWindowNotice(state, DATE, START, 'family')
      expect(notice).not.toContain('administración')
      expect(notice).toContain('WhatsApp')
      expect(notice).toContain('+52 55 3823 1235')
    }
  })
})

describe('las dos pantallas la respetan', () => {
  it('familia y paseador pasan el aviso al hilo', () => {
    expect(read('src/app/familia/mensajes/FamiliaMensajesPanel.tsx')).toContain('closedNotice={chatWindowNotice(')
    expect(read('src/app/walker/chat/WalkerChatPanel.tsx')).toContain('closedNotice={chatWindowNotice(')
  })

  it('cerrado se lee pero no se escribe', () => {
    const thread = read('src/components/chat/ConversationThread.tsx')
    expect(thread).toContain('{closedNotice ? (')
    expect(thread).toContain('role="status"')
  })

  it('la ventana sale de la sesión del paseo, no del hilo que cualquiera de los dos edita', () => {
    const rules = read('firestore.rules')
    expect(rules).toContain('function walkThreadWritable(convId, conversation)')
    expect(rules).toContain('get(/databases/$(database)/documents/walkSessions/$(convId)).data')
    // La versión con el hueco leía la hora del hilo.
    expect(rules).not.toContain('function walkChatOpen(')
    expect(rules).not.toContain('conversation.scheduledStart')
  })

  it('una familia no escribe a administración: sólo en el hilo de su paseo', () => {
    const rules = read('firestore.rules')
    expect(rules).toContain('function chatThreadWritable(convId, conversation)')
    expect(rules).toContain(': !isCustomer();')
    expect(rules).toContain('(isAdmin() || !isCustomer() || customerOwnsWalkThread(convId, request.resource.data))')
    // Nadie que no sea administración le cambia el tipo a un hilo para sacarlo de su ventana.
    expect(rules).toContain("request.resource.data.get('kind', '') == resource.data.get('kind', '')")
  })

  it('quién es parte de un hilo de paseo lo dice la sesión, no la lista que el hilo guardó', () => {
    const rules = read('firestore.rules')
    expect(rules).toContain('function threadParty(convId, conversation)')
    // Leer, escribir el hilo y leer sus mensajes pasan por la misma pregunta.
    expect(rules).toContain('(isAdmin() || threadParty(convId, resource.data))')
    expect(rules).toContain('threadParty(convId, get(/databases/$(database)/documents/conversations/$(convId)).data)')
    // La lista vieja ya no decide.
    expect(rules).not.toContain('function isConversationParticipant()')
  })

  it('el paseador conserva su hilo con administración, sin ventana', () => {
    expect(read('src/app/walker/chat/WalkerChatPanel.tsx')).toContain('title="Mensajes con administración"')
  })

  it('la familia recibe el aviso hecho para ella, no el del paseador', () => {
    expect(read('src/app/familia/mensajes/FamiliaMensajesPanel.tsx')).toContain("walk.scheduledStart, 'family')")
  })
})

/**
 * El chat de la familia elegía el primer paseo abierto de una lista que viene de
 * la fecha más antigua a la más nueva: con un paseo de hace dos semanas que
 * nunca se cerró, enseñaba ese en lugar del de hoy.
 */
describe('qué paseo enseña el chat', () => {
  const OPEN = new Set(['assigned', 'confirmed', 'in_progress'])
  const NOW = Date.UTC(2026, 9, 2, 16, 0) // 2 de octubre, 10:00 en México
  const walk = (id: string, date: string, start: string, status = 'assigned', walkerId = 'w1') =>
    ({ id, status, walkerId, scheduledDate: date, scheduledStart: start })

  it('el de hoy gana al viejo sin cerrar, aunque el viejo venga primero', () => {
    const picked = pickChatWalk([
      walk('viejo', '2026-09-18', '10:00'),
      walk('hoy', '2026-10-02', '10:30'),
    ], OPEN, NOW)
    expect(picked?.id).toBe('hoy')
  })

  it('con dos abiertos, el más cercano a su hora', () => {
    const picked = pickChatWalk([
      walk('lejos', '2026-10-02', '12:00'),
      walk('cerca', '2026-10-02', '10:10'),
    ], OPEN, NOW)
    expect(picked?.id).toBe('cerca')
  })

  it('sin ninguno abierto, el que se abrirá primero', () => {
    const picked = pickChatWalk([
      walk('pasado', '2026-10-05', '10:00'),
      walk('manana', '2026-10-03', '10:00'),
    ], OPEN, NOW)
    expect(picked?.id).toBe('manana')
  })

  it('si todos ya pasaron, el más reciente: es el que se puede releer', () => {
    const picked = pickChatWalk([
      walk('hace-mes', '2026-09-02', '10:00'),
      walk('hace-dias', '2026-09-28', '10:00'),
    ], OPEN, NOW)
    expect(picked?.id).toBe('hace-dias')
  })

  it('ignora lo que no tiene paseador o ya no está en pie, y deja al final lo que no tiene hora', () => {
    expect(pickChatWalk([
      walk('sin-paseador', '2026-10-02', '10:00', 'assigned', ''),
      walk('terminado', '2026-10-02', '10:00', 'completed'),
    ], OPEN, NOW)).toBeNull()
    const picked = pickChatWalk([
      walk('sin-hora', '2026-10-02', ''),
      walk('con-hora', '2026-10-09', '10:00'),
    ], OPEN, NOW)
    expect(picked?.id).toBe('con-hora')
  })
})
