'use client'

import { Suspense } from 'react'
import ReservationFlow from '@/components/reservation-steps-v2/ReservationFlow'
import { BookingPausedNotice } from '@/components/Maintenance'
import { useConfig } from '@/context/ConfigContext'

export default function NuevaReservaPage() {
  const { config } = useConfig()
  // Configuración → Mantenimiento pauses new bookings; scheduled walks go on.
  if (config.maintenance === true) return <BookingPausedNotice />

  return (
    <div className="-mx-6 -mt-4">
      <Suspense>
        <ReservationFlow />
      </Suspense>
    </div>
  )
}
