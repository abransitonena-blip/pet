import { auth } from '@/firebase/config'

/**
 * Fire-and-forget crash report. Never throws, never blocks the UI the error
 * boundary is already showing — a failed report is strictly worse than a
 * silent one, never worse than the original crash.
 */
export function reportError(error: Error, context: string): void {
  void (async () => {
    try {
      const token = await auth.currentUser?.getIdToken()
      if (!token) return
      await fetch('/api/errors/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          message: error.message,
          stack: error.stack,
          context,
          url: typeof window !== 'undefined' ? window.location.pathname : null,
        }),
      })
    } catch {
      // Reporting the error must never itself surface a second error.
    }
  })()
}
