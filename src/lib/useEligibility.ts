'use client'

import { useState, useEffect } from 'react'
import { auth, db } from '@/firebase/config'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, query, where, getDocs, limit } from 'firebase/firestore'

export interface EligibilityResult {
  loading: boolean
  eligible: boolean
  reasons: string[]
  hasPet: boolean
  hasAddress: boolean
  hasCompletedWalk: boolean
}

export function useEligibility(): EligibilityResult {
  const [result, setResult] = useState<EligibilityResult>({
    loading: true, eligible: false, reasons: [],
    hasPet: false, hasAddress: false, hasCompletedWalk: false,
  })

  useEffect(() => {
    let cancelled = false
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (cancelled) return
      if (!user) {
        setResult({ loading: false, eligible: false, reasons: ['Inicia sesión para usar PET Ahora'], hasPet: false, hasAddress: false, hasCompletedWalk: false })
        return
      }

      const reasons: string[] = []
      let hasPet = false
      let hasAddress = false
      let hasCompletedWalk = false

      try {
        const petsSnap = await getDocs(query(collection(db, 'pets'), where('ownerId', '==', user.uid), limit(1)))
        hasPet = !petsSnap.empty
        if (!hasPet) reasons.push('Registra un perro en tu cuenta')
      } catch { reasons.push('Error al verificar mascotas') }

      try {
        const addrSnap = await getDocs(query(collection(db, 'addresses'), where('ownerId', '==', user.uid), limit(1)))
        hasAddress = !addrSnap.empty
        if (!hasAddress) reasons.push('Agrega una dirección de recogida')
      } catch { reasons.push('Error al verificar direcciones') }

      try {
        const walksSnap = await getDocs(query(collection(db, 'reservations'), where('uid', '==', user.uid), where('status', '==', 'completed'), limit(1)))
        hasCompletedWalk = !walksSnap.empty
        if (!hasCompletedWalk) reasons.push('Completa al menos un paseo primero')
      } catch { reasons.push('Error al verificar historial') }

      if (!cancelled) {
        setResult({
          loading: false,
          eligible: hasPet && hasAddress && hasCompletedWalk,
          reasons,
          hasPet, hasAddress, hasCompletedWalk,
        })
      }
    })
    return () => { cancelled = true; unsub() }
  }, [])

  return result
}
