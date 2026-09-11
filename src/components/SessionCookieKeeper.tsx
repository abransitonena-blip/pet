'use client'

import { useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/firebase/config'
import { clearSessionCookie, setSessionCookie } from '@/lib/auth'

/**
 * Mantiene viva la marca de sesión del navegador.
 *
 * Firebase keeps the person signed in (browserLocalPersistence), but the
 * middleware gates private routes on the `__session` cookie, and that cookie
 * was written only at login. Once it expired, the app bounced a perfectly
 * signed-in person back to the login screen -- the "tengo que entrar con
 * Google a cada rato" everybody hit.
 *
 * Now every load with a signed-in user renews it, and signing out clears it.
 * The cookie is still only a presence flag: authorization comes from the ID
 * token's claims, never from this value.
 */
export default function SessionCookieKeeper() {
  useEffect(() => onAuthStateChanged(auth, (user) => {
    if (user) setSessionCookie()
    else clearSessionCookie()
  }), [])

  return null
}
