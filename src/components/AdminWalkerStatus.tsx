'use client'

import { useState, useEffect } from 'react'
import { collection, onSnapshot, query, where, doc, getDoc } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { motion } from 'framer-motion'
import { Footprints, Wifi, WifiOff, MapPin, Clock } from 'lucide-react'

interface OnlineWalker {
  id: string
  name: string
  status: string
  lastHeartbeat: { seconds: number; nanoseconds: number }
  lat?: number
  lng?: number
  batteryLevel?: number
  currentZoneId?: string
}

export default function AdminWalkerStatus() {
  const [walkers, setWalkers] = useState<OnlineWalker[]>([])
  const [loading, setLoading] = useState(true)
  const [zoneNames, setZoneNames] = useState<Record<string, string>>({})

  useEffect(() => {
    // Load zone names for display
    const unsubZones = onSnapshot(collection(db, 'zones'), (snap) => {
      const names: Record<string, string> = {}
      snap.docs.forEach((d) => { names[d.id] = d.data().name || d.id })
      setZoneNames(names)
    })

    // Listen to walkerPresence for online/offline status
    const unsub = onSnapshot(collection(db, 'walkerPresence'), (snap) => {
      const now = Date.now() / 1000
      const list: OnlineWalker[] = []
      snap.docs.forEach((d) => {
        const data = d.data() as OnlineWalker
        const isStale = data.lastHeartbeat?.seconds && (now - data.lastHeartbeat.seconds) > 120
        if (!isStale) {
          const { id: _id, ...rest } = data
      list.push({ id: d.id, ...rest })
        }
      })
      list.sort((a, b) => {
        if (a.status === 'online' && b.status !== 'online') return -1
        if (a.status !== 'online' && b.status === 'online') return 1
        return (b.lastHeartbeat?.seconds || 0) - (a.lastHeartbeat?.seconds || 0)
      })
      setWalkers(list)
      setLoading(false)
    })

    return () => { unsub(); unsubZones() }
  }, [])

  const formatTime = (seconds?: number) => {
    if (!seconds) return ''
    const diff = Math.floor(Date.now() / 1000 - seconds)
    if (diff < 60) return 'Ahora'
    if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`
    return `Hace ${Math.floor(diff / 3600)}h`
  }

  const onlineCount = walkers.filter((w) => w.status === 'online').length

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="card p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Footprints size={16} className="text-primary" />
          <h2 className="text-sm font-semibold text-ink">Paseadores en vivo</h2>
        </div>
        <span className="text-xs text-muted">
          {loading ? '...' : `${onlineCount} en línea · ${walkers.length} activos`}
        </span>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="skeleton w-8 h-8 rounded-lg" />
              <div className="flex-1">
                <div className="skeleton h-4 w-24 mb-1" />
                <div className="skeleton h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : walkers.length === 0 ? (
        <div className="text-center py-6">
          <WifiOff size={24} className="mx-auto text-muted mb-2" />
          <p className="text-xs text-muted">Ningún paseador en línea</p>
        </div>
      ) : (
        <div className="space-y-2">
          {walkers.map((w, i) => (
            <motion.div
              key={w.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className="flex items-center justify-between py-2 border-b border-border last:border-0"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  w.status === 'online' ? 'bg-success/10 text-success' :
                  w.status === 'busy' ? 'bg-warning/10 text-warning' :
                  'bg-border/50 text-muted'
                }`}>
                  <Footprints size={14} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink truncate">{w.name || w.id}</p>
                  <div className="flex items-center gap-2 text-2xs text-muted">
                    <span className={`flex items-center gap-0.5 ${
                      w.status === 'online' ? 'text-success' :
                      w.status === 'busy' ? 'text-warning' : ''
                    }`}>
                      {w.status === 'online' ? <Wifi size={10} /> : <WifiOff size={10} />}
                      {w.status === 'online' ? 'En línea' : w.status === 'busy' ? 'Ocupado' : 'Desconectado'}
                    </span>
                    {w.currentZoneId && zoneNames[w.currentZoneId] && (
                      <span className="flex items-center gap-0.5">
                        <MapPin size={8} />
                        {zoneNames[w.currentZoneId]}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-2xs text-muted shrink-0 flex items-center gap-1">
                <Clock size={8} />
                {formatTime(w.lastHeartbeat?.seconds)}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  )
}
