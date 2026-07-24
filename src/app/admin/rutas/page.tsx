'use client'

import { useState, useEffect, useMemo } from 'react'
import { collection, query, orderBy, onSnapshot, where } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { motion } from 'framer-motion'
import { FaMapMarkedAlt, FaDog, FaClock, FaUser, FaLocationArrow, FaCamera, FaFilter, FaCheck } from 'react-icons/fa'
import type { Reservation, WalkMedia } from '@/types'

function getDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371e3
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatDistance(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`
}

function formatDuration(checkIn: WalkMedia, checkOut: WalkMedia): string {
  if (!checkIn.timestamp || !checkOut.timestamp) return '—'
  const ms = (checkOut.timestamp.seconds - checkIn.timestamp.seconds) * 1000
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `${mins} min`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

export default function AdminRutasPage() {
  const [routes, setRoutes] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [filterWalker, setFilterWalker] = useState('all')
  const [selectedRoute, setSelectedRoute] = useState<Reservation | null>(null)

  useEffect(() => {
    const q = query(
      collection(db, 'reservations'),
      where('walkCheckIn', '!=', null),
      orderBy('walkCheckIn'),
    )
    const unsub = onSnapshot(q, (snap) => {
      setRoutes(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Reservation)))
      setLoading(false)
    }, () => setLoading(false))
    return unsub
  }, [])

  const walkers = useMemo(() => {
    const set = new Set(routes.map((r) => r.assignedWalker).filter(Boolean))
    return Array.from(set)
  }, [routes])

  const filtered = useMemo(() => {
    if (filterWalker === 'all') return routes
    return routes.filter((r) => r.assignedWalker === filterWalker)
  }, [routes, filterWalker])

  const stats = useMemo(() => {
    const total = filtered.length
    const completed = filtered.filter((r) => r.walkCheckOut).length
    const distances = filtered
      .filter((r) => r.walkCheckIn && r.walkCheckOut)
      .map((r) => getDistance(r.walkCheckIn!.lat, r.walkCheckIn!.lng, r.walkCheckOut!.lat, r.walkCheckOut!.lng))
    const avgDistance = distances.length > 0 ? distances.reduce((a, b) => a + b, 0) / distances.length : 0
    const totalDistance = distances.reduce((a, b) => a + b, 0)
    return { total, completed, avgDistance, totalDistance }
  }, [filtered])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Mapa de Rutas</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Rutas de paseo con datos GPS</p>
        </div>
        <div className="flex items-center gap-2">
          <FaFilter size={12} style={{ color: 'var(--text-muted)' }} />
          <select
            value={filterWalker}
            onChange={(e) => setFilterWalker(e.target.value)}
            className="text-xs px-3 py-1.5 rounded-lg"
            style={{ background: 'var(--glass-bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          >
            <option value="all">Todos los paseadores</option>
            {walkers.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Rutas registradas', value: stats.total, icon: FaMapMarkedAlt },
          { label: 'Completadas', value: stats.completed, icon: FaCheck },
          { label: 'Distancia promedio', value: formatDistance(stats.avgDistance), icon: FaLocationArrow },
          { label: 'Distancia total', value: formatDistance(stats.totalDistance), icon: FaDog },
        ].map((s, i) => {
          const Icon = s.icon
          return (
            <div key={i} className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <Icon size={14} className="mb-2" style={{ color: 'var(--text-muted)' }} />
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
              <p className="text-lg font-bold mt-1" style={{ color: 'var(--text-primary)' }}>{s.value}</p>
            </div>
          )
        })}
      </div>

      {/* Routes list */}
      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-20 rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl p-8 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <FaMapMarkedAlt className="text-4xl mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Sin rutas registradas</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Las rutas aparecen cuando un paseador registra check-in con GPS</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((route) => {
            const hasBoth = route.walkCheckIn && route.walkCheckOut
            const distance = hasBoth
              ? getDistance(route.walkCheckIn!.lat, route.walkCheckIn!.lng, route.walkCheckOut!.lat, route.walkCheckOut!.lng)
              : null
            return (
              <motion.div
                key={route.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => setSelectedRoute(selectedRoute?.id === route.id ? null : route)}
                className="rounded-xl p-4 cursor-pointer transition-all hover:bg-white/[0.02]"
                style={{ background: 'var(--bg-card)', border: `1px solid ${selectedRoute?.id === route.id ? 'var(--primary)' : 'var(--border)'}` }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center">
                      <FaDog size={16} className="text-brand-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {route.petName} — {route.service}
                      </p>
                      <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                        {route.assignedWalker && (
                          <span className="flex items-center gap-1"><FaUser size={9} /> {route.assignedWalker}</span>
                        )}
                        <span>{route.date}</span>
                        {distance !== null && <span>{formatDistance(distance)}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasBoth && (
                      <span className="text-2xs px-2 py-0.5 rounded-full bg-success-500/15 text-success-400 font-medium">
                        {formatDuration(route.walkCheckIn!, route.walkCheckOut!)}
                      </span>
                    )}
                    {!hasBoth && route.walkCheckIn && (
                      <span className="text-2xs px-2 py-0.5 rounded-full bg-brand-500/15 text-brand-400 font-medium">
                        En curso
                      </span>
                    )}
                  </div>
                </div>

                {/* Expanded details */}
                {selectedRoute?.id === route.id && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-4 pt-4 space-y-3" style={{ borderTop: '1px solid var(--border)' }}>
                    <div className="grid grid-cols-2 gap-3">
                      {route.walkCheckIn && (
                        <div className="rounded-lg p-3" style={{ background: 'var(--glass-bg)' }}>
                          <p className="text-2xs font-medium mb-1 text-success-400 flex items-center gap-1">
                            <FaLocationArrow size={8} /> Check-in
                          </p>
                          <p className="text-xs" style={{ color: 'var(--text-primary)' }}>
                            {route.walkCheckIn.lat.toFixed(6)}, {route.walkCheckIn.lng.toFixed(6)}
                          </p>
                          {route.walkCheckIn.photo && (
                            <a href={route.walkCheckIn.photo} target="_blank" rel="noopener noreferrer" className="text-2xs text-brand-400 flex items-center gap-1 mt-1">
                              <FaCamera size={8} /> Ver foto
                            </a>
                          )}
                        </div>
                      )}
                      {route.walkCheckOut && (
                        <div className="rounded-lg p-3" style={{ background: 'var(--glass-bg)' }}>
                          <p className="text-2xs font-medium mb-1 text-danger-400 flex items-center gap-1">
                            <FaLocationArrow size={8} /> Check-out
                          </p>
                          <p className="text-xs" style={{ color: 'var(--text-primary)' }}>
                            {route.walkCheckOut.lat.toFixed(6)}, {route.walkCheckOut.lng.toFixed(6)}
                          </p>
                          {route.walkCheckOut.photo && (
                            <a href={route.walkCheckOut.photo} target="_blank" rel="noopener noreferrer" className="text-2xs text-brand-400 flex items-center gap-1 mt-1">
                              <FaCamera size={8} /> Ver foto
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                    {route.walkNotes && (
                      <div className="rounded-lg p-3" style={{ background: 'var(--glass-bg)' }}>
                        <p className="text-2xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Notas del paseo</p>
                        <p className="text-xs" style={{ color: 'var(--text-primary)' }}>{route.walkNotes}</p>
                      </div>
                    )}
                    {distance !== null && (
                      <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--text-secondary)' }}>
                        <span>Distancia: <strong>{formatDistance(distance)}</strong></span>
                        <span>Duración: <strong>{formatDuration(route.walkCheckIn!, route.walkCheckOut!)}</strong></span>
                      </div>
                    )}
                  </motion.div>
                )}
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}

