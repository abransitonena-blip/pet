/**
 * Qué contador de "sin leer" se mueve cuando alguien escribe o lee.
 *
 * El chat nació con dos lados -- administración y la persona --, así que sólo
 * había dos contadores: `unreadAdmin` y `unreadClient`. Cuando el chat de un
 * paseo empezó a ser entre la familia y su paseador, siguió usando los mismos
 * dos: cada mensaje de una familia o de un paseador subía `unreadAdmin`. La
 * insignia de administración contaba conversaciones de las que no era parte, y
 * nadie las atendía porque no le tocaba.
 *
 * En un hilo de paseo el contador que sube es el del OTRO lado de la
 * conversación, y administración no cuenta: puede leer cualquier hilo, pero un
 * paseo que va bien no le pide nada.
 */

export type ChatCounter = 'unreadAdmin' | 'unreadClient' | 'unreadWalker'
export type ChatSenderRole = 'admin' | 'customer' | 'walker'
export type ChatReadSide = 'admin' | 'participant' | 'walker'

/** Los contadores que suben cuando `senderRole` escribe. */
export function countersToBump(senderRole: ChatSenderRole, walkThread: boolean): ChatCounter[] {
  if (!walkThread) return [senderRole === 'admin' ? 'unreadClient' : 'unreadAdmin']
  if (senderRole === 'customer') return ['unreadWalker']
  if (senderRole === 'walker') return ['unreadClient']
  // Administración interviene en un paseo: los dos lados se enteran.
  return ['unreadClient', 'unreadWalker']
}

/** El contador que se pone en cero cuando `side` abre el hilo. */
export function counterToClear(side: ChatReadSide): ChatCounter {
  if (side === 'admin') return 'unreadAdmin'
  return side === 'walker' ? 'unreadWalker' : 'unreadClient'
}
