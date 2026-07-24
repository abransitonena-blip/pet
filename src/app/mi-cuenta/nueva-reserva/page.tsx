'use client'

import { Suspense } from 'react'
import ReservationForm from '@/components/ReservationForm'

export default function NuevaReservaPage() {
  return (
    <div className="-mx-6 -mt-4">
      <Suspense>
        <ReservationForm />
      </Suspense>
    </div>
  )
}
