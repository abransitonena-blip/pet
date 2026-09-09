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

export async function sendChatMessage(
  conversationId: string,
  message: { text: string; senderId: string; senderRole: ChatSenderRole },
): Promise<void> {
  const text = message.text.trim()
  if (!text) return

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
