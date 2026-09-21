import { readFileSync } from 'node:fs'

// chat.ts arrastra la configuración de Firebase, que no arranca en jest.
jest.mock('@/firebase/config', () => ({ db: {}, auth: {} }))
jest.mock('@/firebase/db', () => ({ db: {} }))

import { CHAT_MESSAGE_MAX_LENGTH } from '@/lib/chat'

const read = (path: string) => readFileSync(path, 'utf8')
const rules = read('firestore.rules')
const messagesBlock = rules.slice(rules.indexOf('match /messages/{msgId}'), rules.indexOf('function isParticipantOfConversation'))

/**
 * El chat no funcionaba para nadie más que administración, y la causa estaba en
 * una sola palabra: dentro de `messages`, `resource` es el mensaje, no la
 * conversación. Los mensajes no tienen `participants`, así que preguntarles por
 * ese campo denegaba leer y escribir. Una familia no podía ver su propio hilo.
 */
describe('quién puede leer y escribir en un hilo', () => {
  test('el permiso se busca en la conversación de arriba, no en el mensaje', () => {
    // Leer y escribir preguntan por la conversación de arriba, con su id.
    expect(messagesBlock).toContain('get(/databases/$(database)/documents/conversations/$(convId)).data')
    expect(messagesBlock).toContain('isParticipantOfConversation(convId)')
    // Nunca por `resource`, que dentro de `messages` es el mensaje.
    expect(messagesBlock).not.toContain('resource.data.participants')
  })

  test('esa comprobación lee la conversación por su id', () => {
    const helper = rules.slice(rules.indexOf('function isParticipantOfConversation'))
    expect(helper.slice(0, 400)).toContain('/documents/conversations/$(convId)')
    expect(helper.slice(0, 400)).toContain('request.auth.uid in get(')
  })

  test('la conversación sigue resolviéndose con su propio resource', () => {
    const conversation = rules.slice(rules.indexOf('match /conversations/{convId}'), rules.indexOf('match /messages/{msgId}'))
    // En un hilo de paseo, quien es parte lo dice la sesión (threadParty); en los
    // demás, la lista de participantes del propio hilo.
    expect(conversation).toContain('(isAdmin() || threadParty(convId, resource.data))')
    const party = rules.slice(rules.indexOf('function threadParty'))
    expect(party.slice(0, 700)).toContain('request.auth.uid in conversation.participants')
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

/**
 * La familia ya no escribe a administración: escribe a quien lleva a su perro.
 * Administración lo sigue viendo -- eso no es espiar, es lo que le permite
 * responder cuando un paseo sale mal.
 */
describe('el hilo de un paseo', () => {
  const familia = read('src/app/familia/mensajes/FamiliaMensajesPanel.tsx')

  test('la familia escribe al paseador, no a administración', () => {
    expect(familia).toContain('openWalkConversation')
    expect(familia).toContain('Mensajes con tu paseador')
    expect(familia).not.toContain('Mensajes con PET Ap')
    expect(familia).not.toContain('desde administración')
  })

  test('sin paseo asignado se dice, en vez de abrir un hilo que nadie lee', () => {
    expect(familia).toContain('Todavía no hay con quién escribir')
  })

  test('el hilo se identifica con el paseo, así que no mezcla días', () => {
    const chat = read('src/lib/chat.ts')
    const fn = chat.slice(chat.indexOf('export async function openWalkConversation'))
    expect(fn.slice(0, 900)).toContain("doc(db, 'conversations', walk.sessionId)")
    expect(fn.slice(0, 900)).toContain('participants: [walk.customerId, walk.walkerId]')
  })

  test('el paseador conserva su hilo con administración y gana el de cada paseo', () => {
    const walker = read('src/app/walker/chat/WalkerChatPanel.tsx')
    expect(walker).toContain('Mensajes con administración')
    expect(walker).toContain('openWalkConversation')
  })

  test('un mensaje es mío por quién lo escribió, no por su rol', () => {
    const thread = read('src/components/chat/ConversationThread.tsx')
    expect(thread).toContain('const mine = message.senderId === identity.uid')
    expect(thread).not.toContain("const mine = message.senderRole !== 'admin'")
  })

  test('la bandeja distingue las tres clases de hilo', () => {
    expect(read('src/components/AdminChat.tsx')).toContain("'Paseo'")
  })
})
