'use client'

import { Suspense } from 'react'
import ReservationFlow from '@/components/reservation-steps-v2/ReservationFlow'

export default function NuevaReservaPage() {
  return (
    <div className="-mx-6 -mt-4">
      <Suspense>
        <ReservationFlow />
      </Suspense>
    </div>
  )
}
