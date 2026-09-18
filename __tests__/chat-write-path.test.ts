import { readFileSync } from 'fs'
import { join } from 'path'

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8')

/**
 * The admin inbox at /admin/chat has read `conversations` since it was built,
 * but for a long time nothing in the app ever created one, so the chat was
 * permanently empty and unusable. These assertions pin the write side that
 * closes the loop.
 */
describe('conversaciones con administración', () => {
  test('existe un camino de escritura que crea la conversación', () => {
    const chat = read('src/lib/chat.ts')
    expect(chat).toContain("doc(db, 'conversations', identity.uid)")
    expect(chat).toContain('export async function openConversation')
    expect(chat).toContain('export async function sendChatMessage')
  })

  test('participants lleva el UID porque es lo único que autoriza a un no-admin', () => {
    const chat = read('src/lib/chat.ts')
    const rules = read('firestore.rules')
    expect(chat).toContain('participants: [identity.uid]')
    expect(rules).toContain('request.auth.uid in request.resource.data.participants')
  })

  test('el contador de no leídos sube del lado contrario al que escribe', () => {
    const chat = read('src/lib/chat.ts')
    expect(chat).toContain("message.senderRole === 'admin' ? { unreadClient: increment(1) } : { unreadAdmin: increment(1) }")
  })

  test('paseadores y familias tienen entrada al hilo', () => {
    expect(read('src/app/walker/chat/WalkerChatPanel.tsx')).toContain('ConversationThread')
    expect(read('src/app/familia/mensajes/FamiliaMensajesPanel.tsx')).toContain('ConversationThread')
    expect(read('src/app/walker/WalkerLayoutClient.tsx')).toContain("href: '/walker/chat'")
    expect(read('src/app/familia/FamilyLayoutClient.tsx')).toContain("href: '/familia/mensajes'")
  })

  test('la bandeja del administrador distingue paseador de familia', () => {
    const inbox = read('src/components/AdminChat.tsx')
    // Tres clases desde que la familia habla con su paseador: el hilo de un
    // paseador, el de una familia, y el de un paseo.
    for (const label of ["'Paseador'", "'Familia'", "'Paseo'"]) {
      expect(inbox).toContain(label)
    }
  })
})
