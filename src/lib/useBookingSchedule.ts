'use client'

import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/firebase/db'
import { parseBookingSchedule, type BookingSchedule, type BookingScheduleStatus } from '@/lib/bookingSchedule'

export function useBookingSchedule(): { schedule: BookingSchedule | null; status: BookingScheduleStatus } {
  const [schedule, setSchedule] = useState<BookingSchedule | null>(null)
  const [status, setStatus] = useState<BookingScheduleStatus>('loading')

  useEffect(() => {
    return onSnapshot(doc(db, 'appSettings', 'bookingSchedule'), (snapshot) => {
      if (!snapshot.exists()) {
        setSchedule(null)
        setStatus('missing')
        return
      }
      const parsed = parseBookingSchedule(snapshot.data())
      setSchedule(parsed)
      setStatus(parsed ? 'ready' : 'invalid')
    }, (error) => {
      setSchedule(null)
      setStatus(error.code === 'permission-denied' ? 'permission-denied' : 'network-error')
    })
  }, [])

  return { schedule, status }
}
