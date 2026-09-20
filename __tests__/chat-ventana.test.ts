import { readFileSync } from 'node:fs'
import { chatWindowNotice, chatWindowState, walkStartMs } from '../src/lib/chatWindow'

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
    expect(chatWindowNotice('unknown', DATE, START)).toBe('')
  })

  it('dice por qué no se puede escribir, y a dónde ir', () => {
    expect(chatWindowNotice('too-early', DATE, START)).toContain('dos horas antes')
    expect(chatWindowNotice('too-early', DATE, START)).toContain('administración')
    expect(chatWindowNotice('closed', DATE, START)).toContain('Puedes leer lo que se escribió')
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

  it('la conversación guarda la hora del paseo, que es de donde sale la ventana', () => {
    expect(read('src/lib/chat.ts')).toContain('scheduledStart: walk.scheduledStart,')
    expect(read('firestore.rules')).toContain('function walkChatOpen(conversation)')
  })

  it('el hilo con administración no tiene ventana: es a donde se va cuando el otro está cerrado', () => {
    const rules = read('firestore.rules')
    expect(rules).toContain("conversation.get('kind', '') != 'walk'")
    expect(rules).toContain('|| isAdmin()')
  })
})
