import { readFileSync } from 'node:fs'

// chat.ts arrastra la configuración de Firebase, que no arranca en jest.
jest.mock('@/firebase/config', () => ({ db: {}, auth: {} }))

import { CHAT_MESSAGE_MAX_LENGTH } from '@/lib/chat'

const read = (path: string) => readFileSync(path, 'utf8')
const rules = read('firestore.rules')
const messagesBlock = rules.slice(rules.indexOf('match /messages/{msgId}'), rules.indexOf('function isConversationParticipant'))

/**
 * El chat no funcionaba para nadie más que administración, y la causa estaba en
 * una sola palabra: dentro de `messages`, `resource` es el mensaje, no la
 * conversación. Los mensajes no tienen `participants`, así que preguntarles por
 * ese campo denegaba leer y escribir. Una familia no podía ver su propio hilo.
 */
describe('quién puede leer y escribir en un hilo', () => {
  test('el permiso se busca en la conversación de arriba, no en el mensaje', () => {
    expect(messagesBlock).toContain('isParticipantOfConversation(convId)')
    expect(messagesBlock).not.toContain('isConversationParticipant()')
  })

  test('esa comprobación lee la conversación por su id', () => {
    const helper = rules.slice(rules.indexOf('function isParticipantOfConversation'))
    expect(helper.slice(0, 400)).toContain('/documents/conversations/$(convId)')
    expect(helper.slice(0, 400)).toContain('request.auth.uid in get(')
  })

  test('la conversación sigue resolviéndose con su propio resource', () => {
    const conversation = rules.slice(rules.indexOf('match /conversations/{convId}'), rules.indexOf('match /messages/{msgId}'))
    expect(conversation).toContain('isConversationParticipant() || isAdmin()')
  })
})

/**
 * Un mensaje lo firma quien lo manda. Sin esto, cualquiera con acceso a su
 * propio hilo podía escribir a nombre de administración.
 */
describe('firma del mensaje', () => {
  test('las reglas exigen que el autor sea quien escribe', () => {
    expect(messagesBlock).toContain('validChatMessage(request.resource.data)')
    const validator = rules.slice(rules.indexOf('function validChatMessage'))
    expect(validator.slice(0, 700)).toContain('data.senderId == request.auth.uid')
    expect(validator.slice(0, 700)).toContain("data.senderRole != 'admin' || isAdmin()")
  })

  test('administración firma con su uid real, no con la palabra admin', () => {
    const inbox = read('src/components/AdminChat.tsx')
    expect(inbox).toContain("senderId: uid, senderRole: 'admin'")
    expect(inbox).not.toContain("senderId: 'admin'")
  })

  test('los dos paneles mandan por el mismo camino', () => {
    expect(read('src/components/AdminChat.tsx')).toContain('sendChatMessage(')
    expect(read('src/components/chat/ConversationThread.tsx')).toContain('sendChatMessage(')
  })

  test('el tope de largo es uno solo, en el código y en las reglas', () => {
    const validator = rules.slice(rules.indexOf('function validChatMessage'))
    expect(validator.slice(0, 700)).toContain(`data.text.size() <= ${CHAT_MESSAGE_MAX_LENGTH}`)
    expect(read('src/lib/chat.ts')).toContain("throw new Error('chat-message-too-long')")
    expect(read('src/components/chat/ConversationThread.tsx')).toContain('CHAT_MESSAGE_MAX_LENGTH')
    expect(read('src/components/AdminChat.tsx')).toContain('maxLength={CHAT_MESSAGE_MAX_LENGTH}')
  })
})

describe('la bandeja con muchos hilos', () => {
  test('se puede buscar y se ve cuánto falta por leer', () => {
    const inbox = read('src/components/AdminChat.tsx')
    expect(inbox).toContain('Buscar por nombre o teléfono')
    expect(inbox).toContain('unreadTotal')
  })

  test('un mensaje que no sale avisa, en vez de perderse en la consola', () => {
    const inbox = read('src/components/AdminChat.tsx')
    expect(inbox).toContain('setSendError(')
    expect(inbox).toContain('setInput(text)')
  })
})
