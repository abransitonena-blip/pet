'use client'

import { useEffect } from 'react'
import { reportError } from '@/lib/reportError'

/**
 * Captura los errores de consola para que aparezcan en "Errores de aplicación".
 *
 * Until now only React's error boundary reported anything, so every uncaught
 * exception and rejected promise that did not unmount a tree stayed in the
 * browser console where nobody sees it. This listens for both and forwards
 * them through the same reporting path.
 *
 * Two guards keep this from becoming a write-spam source: identical messages
 * are reported once per session, and the whole component reports at most
 * MAX_PER_SESSION errors (the endpoint also rate-limits per user). Errors
 * raised before login are dropped by reportError itself, which needs a token.
 */

const MAX_PER_SESSION = 10

export default function GlobalErrorReporter() {
  useEffect(() => {
    const seen = new Set<string>()
    let sent = 0

    const send = (error: Error, context: string) => {
      const key = `${context}:${error.message}`
      if (sent >= MAX_PER_SESSION || seen.has(key)) return
      seen.add(key)
      sent += 1
      reportError(error, context)
    }

    const onError = (event: ErrorEvent) => {
      // A cross-origin script error arrives with an empty message and no
      // stack; reporting "Script error." repeatedly tells an admin nothing.
      if (!event.message || event.message === 'Script error.') return
      const error = event.error instanceof Error
        ? event.error
        : new Error(event.message)
      send(error, 'window/error')
    }

    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      const error = reason instanceof Error
        ? reason
        : new Error(typeof reason === 'string' ? reason : 'Promesa rechazada sin motivo')
      send(error, 'window/unhandledrejection')
    }

    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  return null
}
