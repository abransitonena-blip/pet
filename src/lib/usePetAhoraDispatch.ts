'use client'

import { useState, useCallback } from 'react'
import { collection, addDoc, doc, updateDoc, Timestamp } from 'firebase/firestore'
import { auth } from '@/firebase/config'
import { db } from '@/firebase/db'
import type { Address } from '@/types'
import { FEATURE_FLAGS } from '@/lib/featureFlags'

/**
 * PET Ahora desde el navegador: crear la solicitud y pedir el despacho.
 *
 * Everything except creating the request now goes through /api/pet-ahora/*.
 * This module used to do the whole dispatch client-side, which could never
 * have worked: the Firestore rules let a customer create their own request and
 * nothing more -- not move it to `searching`, and certainly not mint an offer
 * addressed to a walker, since `petAhoraOffers` create requires
 * `walkerId == request.auth.uid`. Every request would have been created and
 * then stranded until it expired. Confirmed against the emulator before this
 * was rewritten.
 */

const REQUEST_TIMEOUT_SECONDS = 120

export interface PetAhoraRequestInput {
  clientId: string
  clientName: string
  clientPhone: string
  petId: string
  petName: string
  petType: string
  addressId: string
  address: Address
  zoneId: string
  zoneName: string
}

async function authorizedFetch(path: string, payload: unknown): Promise<{ ok: boolean; code: string }> {
  const token = await auth.currentUser?.getIdToken()
  if (!token) return { ok: false, code: 'auth-required' }
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  })
  const result = await response.json().catch(() => ({})) as { code?: string }
  return { ok: response.ok, code: result.code ?? 'unknown-error' }
}

function messageForDispatchCode(code: string): string {
  if (code === 'no-walkers-available') return 'No hay paseadores disponibles en tu zona en este momento.'
  if (code === 'pet-ahora-not-enabled') return 'PET Ahora está temporalmente desactivado.'
  if (code === 'privileged-identity-not-configured') return 'El servicio de despacho no está configurado en este entorno.'
  if (code === 'rate-limited') return 'Has hecho varias solicitudes seguidas. Espera un momento antes de intentar otra vez.'
  if (code === 'request-not-dispatchable') return 'Esta solicitud ya no puede asignarse.'
  return 'No pudimos buscar un paseador. Revisa tu conexión e inténtalo de nuevo.'
}

export function usePetAhoraDispatch() {
  const [dispatching, setDispatching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createRequest = useCallback(async (params: PetAhoraRequestInput): Promise<string | null> => {
    if (!FEATURE_FLAGS.PET_AHORA_ENABLED) {
      setError('PET Ahora está temporalmente en preparación')
      return null
    }
    setDispatching(true)
    setError(null)

    try {
      const now = Timestamp.now()
      // The customer writes their own request -- the one PET Ahora document the
      // rules let a browser create. Matching happens on the server.
      const requestRef = await addDoc(collection(db, 'petAhoraRequests'), {
        ...params,
        status: 'pending',
        requestedAt: now,
        expiresAt: new Timestamp(now.seconds + REQUEST_TIMEOUT_SECONDS, 0),
      })

      const result = await authorizedFetch('/api/pet-ahora/dispatch', { requestId: requestRef.id })
      if (!result.ok) {
        setError(messageForDispatchCode(result.code))
        setDispatching(false)
        // The request document stays: the customer can retry, and an admin can
        // see that somebody asked and nobody was available.
        return result.code === 'no-walkers-available' ? requestRef.id : null
      }

      setDispatching(false)
      return requestRef.id
    } catch {
      setError('No pudimos crear tu solicitud. Revisa tu conexión e inténtalo de nuevo.')
      setDispatching(false)
      return null
    }
  }, [])

  const retryDispatch = useCallback(async (requestId: string): Promise<boolean> => {
    if (!FEATURE_FLAGS.PET_AHORA_ENABLED) return false
    const result = await authorizedFetch('/api/pet-ahora/dispatch', { requestId })
    if (!result.ok) setError(messageForDispatchCode(result.code))
    return result.ok
  }, [])

  const acceptOffer = useCallback(async (offerId: string): Promise<boolean> => {
    if (!FEATURE_FLAGS.PET_AHORA_ENABLED) return false
    const result = await authorizedFetch('/api/pet-ahora/respond', { offerId, accept: true })
    if (!result.ok) setError('No pudimos aceptar la oferta. Puede que ya la haya tomado alguien más.')
    return result.ok
  }, [])

  const declineOffer = useCallback(async (offerId: string): Promise<boolean> => {
    if (!FEATURE_FLAGS.PET_AHORA_ENABLED) return false
    const result = await authorizedFetch('/api/pet-ahora/respond', { offerId, accept: false })
    if (!result.ok) setError('No pudimos registrar tu respuesta.')
    return result.ok
  }, [])

  /**
   * Progreso del paseo en curso. Lo escribe el paseador, a quien las reglas
   * sí autorizan sobre una solicitud ya asignada a su UID.
   */
  const updateRequestStatus = useCallback(async (requestId: string, status: string, extra?: Record<string, unknown>): Promise<boolean> => {
    if (!FEATURE_FLAGS.PET_AHORA_ENABLED) return false
    try {
      await updateDoc(doc(db, 'petAhoraRequests', requestId), { status, ...extra })
      return true
    } catch {
      return false
    }
  }, [])

  return { createRequest, acceptOffer, declineOffer, updateRequestStatus, retryDispatch, dispatching, error }
}
