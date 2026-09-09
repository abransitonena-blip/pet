'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  collection,
  limit as fsLimit,
  onSnapshot,
  query,
  type FirestoreError,
} from 'firebase/firestore'
import { db } from '@/firebase/config'
import { classifyCanonicalReadError, type CanonicalReadError } from '@/lib/useCanonicalWalkSessions'

/**
 * Directorio canónico de familias y perros para los paneles de administración.
 *
 * `/admin/clientes` and `/admin/perros` used to derive their whole list from
 * the legacy `reservations` collection, which nothing writes to anymore. The
 * visible effect was that an admin saw exactly one client and one dog -- the
 * ones left over from before the migration -- while every family registered
 * since then was invisible, dogs included.
 *
 * These read `customerProfiles` and `dogs` directly, which the Firestore rules
 * already allow an admin to do. Walk activity is layered on top by the callers
 * from `useCanonicalReservations`, so this hook stays a plain directory and
 * invents no counts of its own.
 */

const MAX_CUSTOMERS = 300
const MAX_DOGS = 600

export interface DirectoryCustomer {
  uid: string
  name: string
  email: string
  phone: string
  createdAt: { seconds: number; nanoseconds: number } | null
}

export interface DirectoryDog {
  id: string
  ownerId: string
  name: string
  breed: string
  size: string
  petType: string
  notes: string
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function timestamp(value: unknown): { seconds: number; nanoseconds: number } | null {
  if (value && typeof value === 'object' && 'seconds' in value && typeof (value as { seconds: unknown }).seconds === 'number') {
    return value as { seconds: number; nanoseconds: number }
  }
  return null
}

export function useCanonicalDirectory() {
  const [customers, setCustomers] = useState<DirectoryCustomer[]>([])
  const [dogs, setDogs] = useState<DirectoryDog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<CanonicalReadError | null>(null)
  const [revision, setRevision] = useState(0)

  const retry = useCallback(() => setRevision((value) => value + 1), [])

  useEffect(() => {
    setLoading(true)
    setError(null)

    let customersLoaded = false
    let dogsLoaded = false
    const settle = () => {
      if (customersLoaded && dogsLoaded) setLoading(false)
    }
    const fail = (cause: FirestoreError) => {
      setError(classifyCanonicalReadError(cause))
      setLoading(false)
    }

    const unsubCustomers = onSnapshot(
      query(collection(db, 'customerProfiles'), fsLimit(MAX_CUSTOMERS)),
      (snapshot) => {
        setCustomers(snapshot.docs.map((item) => {
          const data = item.data()
          return {
            uid: item.id,
            name: text(data.name) || 'Sin nombre',
            email: text(data.email),
            phone: text(data.phone),
            createdAt: timestamp(data.createdAt),
          }
        }))
        customersLoaded = true
        settle()
      },
      fail,
    )

    const unsubDogs = onSnapshot(
      query(collection(db, 'dogs'), fsLimit(MAX_DOGS)),
      (snapshot) => {
        setDogs(snapshot.docs.map((item) => {
          const data = item.data()
          return {
            id: item.id,
            ownerId: text(data.ownerId),
            name: text(data.name) || 'Sin nombre',
            breed: text(data.breed),
            size: text(data.size),
            petType: text(data.petType) || 'perro',
            notes: text(data.notes),
          }
        }))
        dogsLoaded = true
        settle()
      },
      fail,
    )

    return () => {
      unsubCustomers()
      unsubDogs()
    }
  }, [revision])

  return { customers, dogs, loading, error, retry }
}
