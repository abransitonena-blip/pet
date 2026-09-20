'use client'

import { useEffect, useState } from 'react'
import { collection, limit, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '@/firebase/db'
import type { DogVaccine } from '@/lib/dogHealth'

/**
 * Los perros de una familia, para cualquier pantalla que los necesite.
 *
 * El inicio de la familia hablaba de "tu próximo paseo" sin enseñar nunca al
 * perro del que hablaba: sólo su nombre en texto. Y los refuerzos de vacuna que
 * la familia anota en el perfil no se volvían a ver desde ninguna parte.
 *
 * Esta lectura trae lo justo para las dos cosas -- cómo se ve el perro y qué
 * cuidados tiene pendientes -- y nada más. El tope de 50 está por debajo del
 * que permiten las reglas: Firestore rechaza la consulta entera si se pasa, no
 * la recorta.
 */

/** Las reglas topan en 100; pedimos la mitad y con eso sobra para una familia. */
export const FAMILY_DOGS_LIMIT = 50

export interface FamilyDog {
  id: string
  name: string
  breed: string
  size: string
  photoReference: string
  vaccines: DogVaccine[]
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function vaccinesOf(value: unknown): DogVaccine[] {
  if (!Array.isArray(value)) return []
  return value.map((entry) => {
    const item = (entry ?? {}) as Record<string, unknown>
    return { name: text(item.name), date: text(item.date), nextDue: text(item.nextDue) }
  })
}

export interface FamilyDogsResult {
  dogs: FamilyDog[]
  loading: boolean
  /** Cierto cuando la lectura fue rechazada: la pantalla calla en vez de mentir. */
  failed: boolean
}

export function useFamilyDogs(ownerId: string): FamilyDogsResult {
  const [dogs, setDogs] = useState<FamilyDog[]>([])
  const [loading, setLoading] = useState(Boolean(ownerId))
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!ownerId) { setDogs([]); setLoading(false); setFailed(false); return }
    setLoading(true)
    setFailed(false)
    const unsubscribe = onSnapshot(
      query(collection(db, 'dogs'), where('ownerId', '==', ownerId), limit(FAMILY_DOGS_LIMIT)),
      (snapshot) => {
        setDogs(snapshot.docs.map((item) => {
          const data = item.data() as Record<string, unknown>
          const health = (data.health ?? {}) as Record<string, unknown>
          return {
            id: item.id,
            name: text(data.name),
            breed: text(data.breed),
            size: text(data.size),
            photoReference: text(data.photoReference),
            vaccines: vaccinesOf(health.vaccines),
          }
        }))
        setLoading(false)
      },
      () => { setDogs([]); setLoading(false); setFailed(true) },
    )
    return () => unsubscribe()
  }, [ownerId])

  return { dogs, loading, failed }
}
