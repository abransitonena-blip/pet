'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, authPersistenceReady, db } from '@/firebase/config'
import { roleClaimFromToken, hasRole, isTeamRole, type Role } from '@/lib/roles'

export const SESSION_LOADING_TIMEOUT_MS = 12_000

export type SessionStatus =
  | 'loading'
  | 'ready'
  | 'no-session'
  | 'denied'
  | 'missing-claim'
  | 'profile-missing'
  | 'suspended'
  | 'invited'
  | 'inactive'
  | 'error'

export type SessionError = 'permission-denied' | 'network-error' | 'unavailable'

export interface SessionRoleState {
  status: SessionStatus
  role: Role
  uid: string | null
  error: SessionError | null
  refresh: () => Promise<void>
}

/**
 * Client-side authorization gate used by protected layouts.
 *
 * Source of authority: custom claims in the ID token. If the claims are stale
 * (e.g. an admin just assigned a role), the token is force-refreshed exactly
 * once and re-checked. If still not allowed, or the account is suspended /
 * invited (walker profiles), the layout must deny access.
 *
 * This is one layer only — Firestore Rules remain the data-access authority.
 */
export function useSessionRole(allowedRoles: readonly Role[]): SessionRoleState {
  const [status, setStatus] = useState<SessionStatus>('loading')
  const [role, setRole] = useState<Role>('customer')
  const [uid, setUid] = useState<string | null>(null)
  const [error, setError] = useState<SessionError | null>(null)
  const refreshedUidRef = useRef<string | null>(null)
  const allowedKey = [...allowedRoles].sort().join('|')

  const fail = useCallback((cause: unknown) => {
    const code = typeof cause === 'object' && cause && 'code' in cause ? String(cause.code) : ''
    setError(code.includes('permission-denied') ? 'permission-denied' : code.includes('network') || code.includes('unavailable') ? 'network-error' : 'unavailable')
    setStatus('error')
  }, [])

  const check = useCallback(async () => {
    try {
      const user = auth.currentUser
      if (!user) {
        setStatus('no-session')
        setRole('customer')
        setUid(null)
        setError(null)
        refreshedUidRef.current = null
        return
      }
      setUid(user.uid)
      setError(null)

      const allowed = allowedKey.split('|') as Role[]
      const token = await user.getIdTokenResult()
      let roleResolution = roleClaimFromToken(token)
      let currentRole = roleResolution.role

      const requiresTeamClaim = allowed.some((allowedRole) => isTeamRole(allowedRole))
      const explicitTeamClaimMissing = requiresTeamClaim
        && (roleResolution.claimStatus === 'missing' || roleResolution.claimStatus === 'unsupported')

      if ((!hasRole(currentRole, ...allowed) || explicitTeamClaimMissing) && refreshedUidRef.current !== user.uid) {
        refreshedUidRef.current = user.uid
        await user.getIdToken(true)
        roleResolution = roleClaimFromToken(await user.getIdTokenResult())
        currentRole = roleResolution.role
      }

      if (requiresTeamClaim && roleResolution.claimStatus === 'missing') {
        setStatus('missing-claim')
        setRole(currentRole)
        return
      }

      if (requiresTeamClaim && roleResolution.claimStatus === 'unsupported') {
        setStatus('denied')
        setRole(currentRole)
        return
      }

      if (!hasRole(currentRole, ...allowed)) {
        setStatus('denied')
        setRole(currentRole)
        return
      }
      setRole(currentRole)

      if (currentRole === 'walker' || currentRole === 'supervisor') {
        const profileSnap = await getDoc(doc(db, 'walkerProfiles', user.uid))
        if (currentRole === 'walker' && !profileSnap.exists()) {
          setStatus('profile-missing')
          return
        }
        if (profileSnap.exists()) {
          const profileStatus = profileSnap.data().status
          if (profileStatus === 'suspended') {
            setStatus('suspended')
            return
          }
          if (profileStatus === 'invited') {
            setStatus('invited')
            return
          }
          if (profileStatus && profileStatus !== 'active') {
            setStatus('inactive')
            return
          }
        }
      }

      setStatus('ready')
    } catch (cause) {
      fail(cause)
    }
  }, [allowedKey, fail])

  useEffect(() => {
    let cancelled = false
    const timeoutId = window.setTimeout(() => {
      if (!cancelled) fail({ code: 'auth/session-timeout' })
    }, SESSION_LOADING_TIMEOUT_MS)
    const run = async () => {
      if (cancelled) return
      try {
        await check()
      } finally {
        window.clearTimeout(timeoutId)
      }
    }
    const unsub = onAuthStateChanged(auth, () => {
      authPersistenceReady.then(run).catch(fail)
    })
    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
      unsub()
    }
  }, [check, fail])

  const refresh = useCallback(async () => {
    refreshedUidRef.current = null
    setStatus('loading')
    await check()
  }, [check])

  return { status, role, uid, error, refresh }
}
