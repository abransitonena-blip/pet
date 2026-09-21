import { readFileSync } from 'node:fs'
import { counterToClear, countersToBump } from '../src/lib/chatCounters'

const read = (path: string) => readFileSync(path, 'utf8')

/**
 * Administración podía abrirle a una familia un chat que la familia no tenía
 * dónde leer ni contestar, y cada mensaje de un paseo subía el "sin leer" de
 * administración aunque no le tocara.
 */
describe('a quién le toca el "sin leer"', () => {
  it('en el hilo con administración, el otro lado de siempre', () => {
    expect(countersToBump('customer', false)).toEqual(['unreadAdmin'])
    expect(countersToBump('walker', false)).toEqual(['unreadAdmin'])
    expect(countersToBump('admin', false)).toEqual(['unreadClient'])
  })

  it('en un paseo, el otro lado de la conversación -- y administración no cuenta', () => {
    expect(countersToBump('customer', true)).toEqual(['unreadWalker'])
    expect(countersToBump('walker', true)).toEqual(['unreadClient'])
    expect(countersToBump('customer', true)).not.toContain('unreadAdmin')
    expect(countersToBump('walker', true)).not.toContain('unreadAdmin')
  })

  it('si administración interviene en un paseo, los dos lados se enteran', () => {
    expect(countersToBump('admin', true).sort()).toEqual(['unreadClient', 'unreadWalker'])
  })

  it('cada quien apaga el suyo', () => {
    expect(counterToClear('admin')).toBe('unreadAdmin')
    expect(counterToClear('participant')).toBe('unreadClient')
    expect(counterToClear('walker')).toBe('unreadWalker')
  })

  it('el envío y la lectura usan esas cuentas, no un contador fijo', () => {
    const chat = read('src/lib/chat.ts')
    expect(chat).toContain('countersToBump(message.senderRole, options.walkThread === true)')
    expect(chat).toContain('[counterToClear(side)]: 0')
    expect(chat).not.toContain('{ unreadAdmin: increment(1) }')
  })

  it('el hilo distingue el de un paseo por su `open`, y el paseador limpia el suyo', () => {
    const thread = read('src/components/chat/ConversationThread.tsx')
    expect(thread).toContain('{ walkThread: Boolean(open) }')
    expect(thread).toContain("open && identity.role === 'walker' ? 'walker' : 'participant'")
  })

  it('cuando administración contesta en un paseo, lo dice al enviar', () => {
    expect(read('src/components/AdminChat.tsx')).toContain("{ walkThread: selectedConv?.participantRole === 'walk' }")
  })
})

describe('el botón de chat en la ficha de una familia', () => {
  it('ya no está: creaba un hilo que la familia no puede leer', () => {
    const clients = read('src/app/admin/clientes/AdminClientesPanel.tsx')
    expect(clients).not.toContain('StartChatButton')
    // WhatsApp, que sí le llega, sigue ahí.
    expect(clients).toContain('Escribir por WhatsApp')
  })

  it('el botón es sólo de paseadores, para que nadie lo vuelva a poner a una familia', () => {
    expect(read('src/components/admin/StartChatButton.tsx')).toContain("role: 'walker'\n")
    expect(read('src/app/admin/paseadores/AdminPaseadoresPanel.tsx')).toContain('role="walker"')
  })

  it('el hilo viejo de una familia se deja de consulta, con WhatsApp', () => {
    const inbox = read('src/components/AdminChat.tsx')
    expect(inbox).toContain("selectedConv.participantRole === 'customer' ? (")
    expect(inbox).toContain('Este hilo es de consulta')
    expect(inbox).toContain('confirmWhatsAppShare(selectedConv.customerPhone')
  })
})

describe('lo que administración ya le había escrito a una familia', () => {
  const legacy = read('src/components/chat/LegacyAdminMessages.tsx')
  const panel = read('src/app/familia/mensajes/FamiliaMensajesPanel.tsx')

  it('se conserva, sólo para leer, y sólo si el hilo tiene algo', () => {
    expect(legacy).toContain('if (messages.length === 0) return null')
    expect(legacy).toContain('limit(MAX_MESSAGES)')
    expect(legacy).not.toContain('sendChatMessage')
  })

  it('abrirlo apaga la insignia que lo anunciaba', () => {
    expect(legacy).toContain("markConversationRead(uid, 'participant')")
  })

  it('sale con o sin paseo asignado', () => {
    expect((panel.match(/<LegacyAdminMessages uid=\{identity\.uid\} \/>/g) ?? []).length).toBe(2)
  })
})
