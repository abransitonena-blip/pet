'use client'

import { useState, useCallback } from 'react'
import { collection, addDoc, query, where, getDocs, doc, updateDoc, getDoc, Timestamp } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { selectBestWalker } from './dispatch'
import type { Walker, PetAhoraRequest } from '@/types'

const OFFER_TIMEOUT_SECONDS = 30
const REQUEST_TIMEOUT_SECONDS = 120

function nowStr() {
  return `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`
}

function dayOfWeek() {
  const dayMap = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
  return dayMap[new Date().getDay()]
}

async function sendOffer(
  requestId: string,
  walkerId: string,
  walkerName: string,
): Promise<boolean> {
  try {
    const now = Timestamp.now()
    await addDoc(collection(db, 'petAhoraOffers'), {
      requestId,
      walkerId,
      walkerName,
      status: 'pending',
      sentAt: now,
      expiresAt: new Timestamp(now.seconds + OFFER_TIMEOUT_SECONDS, 0),
    })
    await updateDoc(doc(db, 'petAhoraRequests', requestId), {
      status: 'offer_sent',
      walkerId,
      walkerName,
    })
    return true
  } catch {
    return false
  }
}

export function usePetAhoraDispatch() {
  const [dispatching, setDispatching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createRequest = useCallback(async (params: {
    clientId: string
    clientName: string
    clientPhone: string
    petId: string
    petName: string
    petType: string
    addressId: string
    address: any
    zoneId: string
    zoneName: string
    price: number
  }): Promise<string | null> => {
    setDispatching(true)
    setError(null)

    try {
      const now = Timestamp.now()
      const requestRef = await addDoc(collection(db, 'petAhoraRequests'), {
        ...params,
        status: 'pending',
        requestedAt: now,
        expiresAt: new Timestamp(now.seconds + REQUEST_TIMEOUT_SECONDS, 0),
      })

      await updateDoc(requestRef, { status: 'searching' })

      const walkersSnap = await getDocs(query(collection(db, 'walkers'), where('status', '==', 'active'), where('zones', 'array-contains', params.zoneId)))
      const walkers = walkersSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Walker))

      const best = selectBestWalker(walkers, params.zoneId, dayOfWeek(), nowStr())
      if (!best) {
        await updateDoc(requestRef, { status: 'expired' })
        setError('No hay paseadores disponibles ahora')
        setDispatching(false)
        return null
      }

      await sendOffer(requestRef.id, best.walker.id, best.walker.name)
      setDispatching(false)
      return requestRef.id
    } catch {
      setError('Error al crear solicitud')
      setDispatching(false)
      return null
    }
  }, [])

  const retryDispatch = useCallback(async (requestId: string): Promise<boolean> => {
    try {
      const reqSnap = await getDoc(doc(db, 'petAhoraRequests', requestId))
      if (!reqSnap.exists()) return false
      const req = { id: reqSnap.id, ...reqSnap.data() } as PetAhoraRequest
      if (req.status !== 'offer_sent') return false

      const walkersSnap = await getDocs(query(collection(db, 'walkers'), where('status', '==', 'active'), where('zones', 'array-contains', req.zoneId)))
      const walkers = walkersSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Walker))

      const best = selectBestWalker(walkers, req.zoneId, dayOfWeek(), nowStr())
      if (!best) {
        await updateDoc(doc(db, 'petAhoraRequests', requestId), { status: 'expired' })
        return false
      }

      return await sendOffer(requestId, best.walker.id, best.walker.name)
    } catch {
      return false
    }
  }, [])

  const acceptOffer = useCallback(async (offerId: string, requestId: string, walkerId: string): Promise<boolean> => {
    try {
      const now = Timestamp.now()

      await updateDoc(doc(db, 'petAhoraOffers', offerId), {
        status: 'accepted',
        respondedAt: now,
      })

      await updateDoc(doc(db, 'petAhoraRequests', requestId), {
        status: 'accepted',
        acceptedAt: now,
        walkerId,
      })

      await addDoc(collection(db, 'petAhoraLeases'), {
        requestId,
        offerId,
        walkerId,
        status: 'active',
        lockedAt: now,
      })

      return true
    } catch {
      return false
    }
  }, [])

  const declineOffer = useCallback(async (offerId: string, requestId: string): Promise<boolean> => {
    try {
      const now = Timestamp.now()
      await updateDoc(doc(db, 'petAhoraOffers', offerId), { status: 'declined', respondedAt: now })
      retryDispatch(requestId)
      return true
    } catch {
      return false
    }
  }, [retryDispatch])

  const updateRequestStatus = useCallback(async (requestId: string, status: string, extra?: Record<string, any>): Promise<boolean> => {
    try {
      await updateDoc(doc(db, 'petAhoraRequests', requestId), { status, ...extra })
      return true
    } catch {
      return false
    }
  }, [])

  return { createRequest, acceptOffer, declineOffer, updateRequestStatus, retryDispatch, dispatching, error }
}
