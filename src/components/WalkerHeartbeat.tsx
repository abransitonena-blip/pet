'use client'

import { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/firebase/config'
import { useWalkerPresence } from '@/lib/useWalkerPresence'
import { Circle, AlertTriangle } from 'lucide-react'

export default function WalkerHeartbeat() {
  const [walkerInfo, setWalkerInfo] = useState<{ id: string; name: string } | null>(null)
  const [gpsError, setGpsError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { setLoaded(true); return }
      try {
        const snap = await getDoc(doc(db, 'users', user.uid))
        const role = snap.data()?.role
        if (role !== 'walker') { setLoaded(true); return }

        const walkerSnap = await getDoc(doc(db, 'walkers', user.uid))
        if (walkerSnap.exists()) {
          setWalkerInfo({ id: user.uid, name: walkerSnap.data().name || 'Paseador' })
        } else {
          const profileSnap = await getDoc(doc(db, 'walkerProfiles', user.uid))
          if (profileSnap.exists()) {
            setWalkerInfo({ id: user.uid, name: profileSnap.data().name || 'Paseador' })
          }
        }
      } catch {} finally { setLoaded(true) }
    })
    return unsub
  }, [])

  const { setBusy, setOnline } = useWalkerPresence({
    walkerId: walkerInfo?.id ?? '',
    walkerName: walkerInfo?.name ?? '',
    enabled: !!walkerInfo,
  })

  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsError('GPS no disponible en este navegador')
    }
  }, [])

  if (!loaded || !walkerInfo) return null

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs" style={{ background: gpsError ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)', border: `1px solid ${gpsError ? 'rgba(245,158,11,0.2)' : 'rgba(16,185,129,0.2)'}` }}>
      <Circle size={6} className={gpsError ? 'text-amber-500' : 'text-success-500'} />
      <span style={{ color: gpsError ? 'var(--text-muted)' : 'var(--text-secondary)' }}>
        {gpsError ? 'GPS no disponible' : 'Presencia activa'}
      </span>
      {gpsError && <AlertTriangle size={10} className="text-amber-500" />}
    </div>
  )
}
