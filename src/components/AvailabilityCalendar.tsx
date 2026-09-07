'use client'

import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { generateTimeSlots, getDayOfWeek } from '@/lib/defaultConfig'

export default function AvailabilityCalendar({ date, onSelect }: { date?: string; onSelect?: (time: string) => void }) {
  const timeSlots = date ? generateTimeSlots(getDayOfWeek(date)) : []

  if (!date) {
    return (
      <div className="text-xs text-muted text-center py-6">
        Selecciona una fecha para ver disponibilidad
      </div>
    )
  }

  if (timeSlots.length === 0) {
    return (
      <div className="text-xs text-muted text-center py-6">
        No hay servicio este día
      </div>
    )
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-1.5">
        {timeSlots.map((slot) => (
          <motion.button
            key={slot}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSelect?.(slot)}
            className="flex items-center justify-center gap-1.5 text-xs py-2 rounded-lg transition-all bg-ink/5 text-muted hover:bg-primary/20 hover:text-primary"
          >
            <Check size={9} className="opacity-0" />
            {slot}
          </motion.button>
        ))}
      </div>
      <p className="text-2xs text-muted mt-2 text-center">
        Horarios solicitables. La disponibilidad se confirma al revisar tu solicitud.
      </p>
    </div>
  )
}
