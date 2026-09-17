'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { collection, doc, limit, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { AlertTriangle } from 'lucide-react'
import { auth } from '@/firebase/config'
import { db } from '@/firebase/db'
import { FEATURE_FLAGS } from '@/lib/featureFlags'

/**
 * Aviso en todo el panel cuando un paseador sale de la zona de su paseo.
 *
 * Mounted in the admin layout so it shows on whatever screen the admin is on:
 * the point of the alert is that someone sees it now, not when they happen to
 * open the routes page. "Enterado" is the only write the rules allow here.
 */

interface OpenAlert {
  id: string
  walkerName: string
  zoneName: string
  distanceMeters: number | null
  radiusKm: number | null
  lastOutsideAt: number | null
}

function minutesAgo(at: number | null): string {
  if (at === null) return ''
  const minutes = Math.max(0, Math.round((Date.now() - at) / 60_000))
  return minutes === 0 ? 'ahora' : `hace ${minutes} min`
}

export default function GeofenceAlertsBanner() {
  const [alerts, setAlerts] = useState<OpenAlert[]>([])
  const [acknowledging, setAcknowledging] = useState<string | null>(null)

  useEffect(() => {
    if (!FEATURE_FLAGS.WALK_TRACKING_ENABLED) return
    return onSnapshot(
      query(collection(db, 'geofenceAlerts'), where('status', '==', 'open'), limit(20)),
      (snapshot) => setAlerts(snapshot.docs.map((item) => {
        const data = item.data()
        return {
          id: item.id,
          walkerName: typeof data.walkerName === 'string' ? data.walkerName : 'Paseador',
          zoneName: typeof data.zoneName === 'string' ? data.zoneName : '',
          distanceMeters: typeof data.distanceMeters === 'number' ? data.distanceMeters : null,
          radiusKm: typeof data.radiusKm === 'number' ? data.radiusKm : null,
          lastOutsideAt: typeof data.lastOutsideAt?.seconds === 'number' ? data.lastOutsideAt.seconds * 1000 : null,
        }
      })),
      () => setAlerts([]),
    )
  }, [])

  const acknowledge = async (id: string) => {
    const uid = auth.currentUser?.uid
    if (!uid) return
    setAcknowledging(id)
    try {
      await updateDoc(doc(db, 'geofenceAlerts', id), { status: 'acknowledged', acknowledgedBy: uid, acknowledgedAt: serverTimestamp() })
    } catch {
      // The alert stays visible; the admin can try again.
    } finally {
      setAcknowledging(null)
    }
  }

  if (alerts.length === 0) return null

  return (
    <div className="mb-5 space-y-2">
      {alerts.map((alert) => (
        <div key={alert.id} role="alert" className="flex flex-wrap items-center gap-3 rounded-2xl bg-danger-500/10 px-4 py-3 text-sm text-red-800">
          <AlertTriangle size={17} className="shrink-0" aria-hidden="true" />
          <p className="min-w-0 flex-1">
            <strong className="font-semibold">{alert.walkerName}</strong> salió de la zona{alert.zoneName ? ` ${alert.zoneName}` : ''}
            {alert.distanceMeters !== null && alert.radiusKm !== null
              ? ` · a ${(alert.distanceMeters / 1000).toFixed(1)} km del centro (radio ${alert.radiusKm} km)`
              : ''}
            {alert.lastOutsideAt !== null ? ` · ${minutesAgo(alert.lastOutsideAt)}` : ''}
          </p>
          <div className="flex gap-2">
            <Link href="/admin/rutas" className="inline-flex min-h-9 items-center rounded-full bg-surface px-4 text-xs font-semibold text-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              Ver recorrido
            </Link>
            <button
              type="button"
              onClick={() => void acknowledge(alert.id)}
              disabled={acknowledging === alert.id}
              className="inline-flex min-h-9 items-center rounded-full px-4 text-xs font-semibold text-red-800 underline-offset-2 hover:underline disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Enterado
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
