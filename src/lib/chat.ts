'use client'

import {
  addDoc,
  collection,
  doc,
  increment,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { db } from '@/firebase/config'

/**
 * Conversaciones con administración.
 *
 * The admin inbox at /admin/chat has always read `conversations`, but nothing
 * in the app ever created one, so it was permanently empty -- the chat could
 * not be used by anyone. These helpers are the missing write side.
 *
 * One thread per person, keyed by their UID, so reopening the screen continues
 * the same conversation instead of starting a new one. `participants` holds
 * that UID because the Firestore rules authorise a non-admin exactly on
 * `request.auth.uid in participants`; an admin is authorised separately by
 * their role claim and is therefore not listed.
 */

export type ChatSenderRole = 'admin' | 'customer' | 'walker'

/** El mismo tope que comprueban las reglas. */
export const CHAT_MESSAGE_MAX_LENGTH = 2000

export interface ConversationIdentity {
  uid: string
  name: string
  role: Exclude<ChatSenderRole, 'admin'>
  phone?: string
}

export async function openConversation(identity: ConversationIdentity): Promise<string> {
  const conversationRef = doc(db, 'conversations', identity.uid)
  await setDoc(conversationRef, {
    participants: [identity.uid],
    customerId: identity.uid,
    customerName: identity.name,
    customerPhone: identity.phone ?? '',
    participantRole: identity.role,
    updatedAt: serverTimestamp(),
  }, { merge: true })
  return conversationRef.id
}

/**
 * Administración abre la conversación primero.
 *
 * Hasta ahora el hilo sólo nacía cuando la familia o el paseador entraban a su
 * pantalla de mensajes: administración no tenía a dónde escribir si el otro lado
 * nunca había escrito. Además de crear el hilo, deja `lastTimestamp`, porque la
 * bandeja ordena por ese campo y un hilo sin él no aparecería en la lista.
 */
/**
 * El hilo de un paseo: la familia y el paseador de ese paseo.
 *
 * La familia ya no escribe a administración -- escribe a quien lleva a su perro,
 * que es quien puede contestar lo que de verdad pregunta durante el paseo. El
 * hilo se identifica con el id del paseo, así que cada paseo tiene el suyo y no
 * se mezclan conversaciones de días distintos.
 *
 * Administración lo sigue viendo en su bandeja: puede leer cualquier hilo por su
 * rol. Eso no es espiar a escondidas, es lo que permite responder cuando algo
 * sale mal en un paseo.
 */
export async function openWalkConversation(walk: {
  sessionId: string
  customerId: string
  customerName: string
  walkerId: string
  walkerName: string
  scheduledDate: string
}): Promise<string> {
  if (!walk.sessionId || !walk.customerId || !walk.walkerId) throw new Error('walk-conversation-incomplete')
  const conversationRef = doc(db, 'conversations', walk.sessionId)
  await setDoc(conversationRef, {
    participants: [walk.customerId, walk.walkerId],
    kind: 'walk',
    sessionId: walk.sessionId,
    customerId: walk.customerId,
    customerName: walk.customerName,
    walkerId: walk.walkerId,
    walkerName: walk.walkerName,
    scheduledDate: walk.scheduledDate,
    participantRole: 'walk',
    updatedAt: serverTimestamp(),
  }, { merge: true })
  return conversationRef.id
}

export async function startConversationAsAdmin(identity: ConversationIdentity): Promise<string> {
  const conversationRef = doc(db, 'conversations', identity.uid)
  await setDoc(conversationRef, {
    participants: [identity.uid],
    customerId: identity.uid,
    customerName: identity.name,
    customerPhone: identity.phone ?? '',
    participantRole: identity.role,
    updatedAt: serverTimestamp(),
    lastTimestamp: serverTimestamp(),
  }, { merge: true })
  return conversationRef.id
}

/**
 * Manda un mensaje y sube el contador del otro lado.
 *
 * El mensaje lo firma quien lo manda -- las reglas comprueban que `senderId`
 * sea su propio uid, así que nadie puede escribir a nombre de otro ni hacerse
 * pasar por administración. Los dos paneles pasan por aquí para que el mensaje
 * tenga la misma forma se mande de donde se mande.
 */
export async function sendChatMessage(
  conversationId: string,
  message: { text: string; senderId: string; senderRole: ChatSenderRole },
): Promise<void> {
  const text = message.text.trim()
  if (!text) return
  if (text.length > CHAT_MESSAGE_MAX_LENGTH) throw new Error('chat-message-too-long')
  if (!message.senderId) throw new Error('chat-sender-required')

  await addDoc(collection(db, 'conversations', conversationId, 'messages'), {
    text,
    senderId: message.senderId,
    senderRole: message.senderRole,
    timestamp: serverTimestamp(),
  })

  // The unread counter for the *other* side goes up. A failure here must not
  // lose an already-delivered message, so it is reported separately.
  await updateDoc(doc(db, 'conversations', conversationId), {
    lastMessage: text,
    lastTimestamp: serverTimestamp(),
    ...(message.senderRole === 'admin' ? { unreadClient: increment(1) } : { unreadAdmin: increment(1) }),
  })
}

export async function markConversationRead(conversationId: string, side: 'admin' | 'participant'): Promise<void> {
  await updateDoc(doc(db, 'conversations', conversationId), side === 'admin' ? { unreadAdmin: 0 } : { unreadClient: 0 })
}
