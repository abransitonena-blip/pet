'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { db } from '@/firebase/config'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { FaCheck, FaTimes } from 'react-icons/fa'
import { generateTimeSlots, getDayOfWeek } from '@/lib/defaultConfig'

export default function AvailabilityCalendar({ date, onSelect }: { date?: string; onSelect?: (time: string) => void }) {
  const [bookedSlots, setBookedSlots] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const timeSlots = date ? generateTimeSlots(getDayOfWeek(date)) : []

  useEffect(() => {
    if (!date) return
    setLoading(true)
    const q = query(collection(db, 'reservations'), where('date', '==', date), where('status', '==', 'pending'))
    getDocs(q)
      .then((snap) => {
        const times = snap.docs.map((d) => d.data().time).filter(Boolean)
        setBookedSlots(times)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [date])

  const availableSlots = timeSlots.filter((t) => !bookedSlots.includes(t))

  if (!date) {
    return (
      <div className="text-xs text-white/30 text-center py-6">
        Selecciona una fecha para ver disponibilidad
      </div>
    )
  }

  if (timeSlots.length === 0) {
    return (
      <div className="text-xs text-white/30 text-center py-6">
        No hay servicio este día
      </div>
    )
  }

  return (
    <div>
      {loading ? (
        <div className="text-xs text-white/30 text-center py-6">Cargando disponibilidad...</div>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {timeSlots.map((slot) => {
            const isBooked = bookedSlots.includes(slot)
            return (
              <motion.button
                key={slot}
                whileTap={{ scale: 0.95 }}
                disabled={isBooked}
                onClick={() => onSelect?.(slot)}
                className={`flex items-center justify-center gap-1.5 text-xs py-2 rounded-lg transition-all ${
                  isBooked
                    ? 'bg-red-500/10 text-red-400/50 cursor-not-allowed line-through'
                    : 'bg-white/5 text-white/60 hover:bg-primary/20 hover:text-primary'
                }`}
              >
                {isBooked ? <FaTimes size={9} /> : <FaCheck size={9} className="opacity-0" />}
                {slot}
              </motion.button>
            )
          })}
        </div>
      )}
      <p className="text-[10px] text-white/20 mt-2 text-center">
        {availableSlots.length} de {timeSlots.length} horarios disponibles
      </p>
    </div>
  )
}
