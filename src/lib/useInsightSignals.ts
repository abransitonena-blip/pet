'use client'

import { useEffect, useState } from 'react'
import { collection, getDocs, limit, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '@/firebase/config'
import type { OpenGeofenceAlertInput } from '@/lib/insights'

/**
 * Two small reads the Centro de Insights needs beyond the walks themselves.
 * Both return null while unknown or unreadable, and the page then leaves the
 * matching insight out rather than claiming "all clear".
 */

/** Open "salió de la zona" alerts (staff-only collection, written by the server). */
export function useOpenGeofenceAlerts(): OpenGeofenceAlertInput[] | null {
  const [alerts, setAlerts] = useState<OpenGeofenceAlertInput[] | null>(null)

  useEffect(() => onSnapshot(
    query(collection(db, 'geofenceAlerts'), where('status', '==', 'open'), limit(50)),
    (snapshot) => {
      setAlerts(snapshot.docs.map((item) => {
        const data = item.data()
        return {
          sessionId: item.id,
          walkerName: typeof data.walkerName === 'string' && data.walkerName ? data.walkerName : 'Paseador',
          zoneName: typeof data.zoneName === 'string' ? data.zoneName : '',
          distanceMeters: typeof data.distanceMeters === 'number' ? data.distanceMeters : null,
        }
      }))
    },
    () => setAlerts(null),
  ), [])

  return alerts
}

/**
 * Which of these walks already have a sent report. Read ten at a time (the
 * `in` limit), well under the rules' cap of 100 per walkReports list.
 */
export function useSubmittedReportIds(sessionIds: readonly string[]): Set<string> | null {
  const key = [...sessionIds].sort().join('|')
  const [submitted, setSubmitted] = useState<Set<string> | null>(null)

  useEffect(() => {
    const ids = key ? key.split('|') : []
    if (ids.length === 0) {
      setSubmitted(new Set())
      return
    }
    let cancelled = false
    setSubmitted(null)
    const chunks: string[][] = []
    for (let index = 0; index < ids.length; index += 10) chunks.push(ids.slice(index, index + 10))
    Promise.all(chunks.map((chunk) => getDocs(query(collection(db, 'walkReports'), where('walkSessionId', 'in', chunk), limit(10)))))
      .then((snapshots) => {
        if (cancelled) return
        const found = new Set<string>()
        for (const snapshot of snapshots) {
          for (const item of snapshot.docs) {
            const data = item.data()
            if (data.status === 'submitted' && typeof data.walkSessionId === 'string') found.add(data.walkSessionId)
          }
        }
        setSubmitted(found)
      })
      .catch(() => {
        if (!cancelled) setSubmitted(null)
      })
    return () => { cancelled = true }
  }, [key])

  return submitted
}
