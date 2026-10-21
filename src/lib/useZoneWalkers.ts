'use client'

import { useCallback } from 'react'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/firebase/db'

/**
 * Qué paseadores activos cubren cada zona -- la misma lectura que usan tanto
 * "Mi zona" (a quién delegar un paseo) como "Suministros" (a quién
 * entregarle algo): walkerProfiles ya deja leer a cualquier autenticado, así
 * que no hace falta una ruta de servidor para esto.
 */

export interface ZoneWalker {
  id: string
  name: string
}

export function useFetchWalkersByZone() {
  return useCallback(async (zoneIds: readonly string[]): Promise<Map<string, ZoneWalker[]>> => {
    const snapshot = await getDocs(query(collection(db, 'walkerProfiles'), where('status', '==', 'active')))
    const byZone = new Map<string, ZoneWalker[]>()
    for (const zoneId of zoneIds) {
      byZone.set(zoneId, snapshot.docs
        .filter((item) => {
          const zones = item.data().zones
          return Array.isArray(zones) && zones.includes(zoneId)
        })
        .map((item) => {
          const name = item.data().name
          return { id: item.id, name: typeof name === 'string' && name ? name : 'Paseador' }
        }))
    }
    return byZone
  }, [])
}
