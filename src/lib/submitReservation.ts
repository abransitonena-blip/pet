import { auth } from '@/firebase/config'
import { db } from '@/firebase/db'
import { collection, serverTimestamp, doc, getDoc, writeBatch } from 'firebase/firestore'
import { WHATSAPP_NUMBER } from '@/lib/utils'
import type { ReservationPackageType } from '@/lib/walkServices'
import { isValidSameDayWindow } from '@/lib/reservationValidation'
import { buildBookingSlots, parseBookingSchedule } from '@/lib/bookingSchedule'

// Margin guard: discounts cannot reduce price below this percentage of base price
const MIN_MARGIN_PERCENT = 30

export function applyMarginGuard(basePrice: number, discount: number): number {
  const minPrice = Math.round(basePrice * MIN_MARGIN_PERCENT / 100)
  const maxDiscount = Math.max(0, basePrice - minPrice)
  return Math.min(discount, maxDiscount)
}

export function parseTimeWindow(slot: string): { start: string; end: string } {
  const parts = slot.split('-')
  if (parts.length !== 2 || !isValidSameDayWindow(parts[0], parts[1])) {
    throw new Error('BOOKING_INVALID_TIME_WINDOW')
  }
  return { start: parts[0], end: parts[1] }
}

interface Form {
  name: string; phone: string; petId?: string; petName: string; petType: string;
  serviceId: string; serviceName: string; servicePackageType: ReservationPackageType | ''; serviceVersion: number | null;
  serviceDurationMinutes: number | null;
  zoneId: string;
  date: string; time: string; notes: string;
  coupon: string; addressId: string; walkerPreference: string;
}

interface CouponStatus {
  valid: boolean; msg: string; discount?: number; type?: 'percentage' | 'fixed'
}

interface Walker {
  id: string; name: string; photo?: string; zones?: string[]; rating?: number
}

interface SubmitResult {
  message: string
  whatsappUrl: string
}

export async function submitReservation({
  form,
  selectedAddressId,
}: {
  form: Form
  couponStatus: CouponStatus | null
  referralCode: string
  walkerPreference: string
  availableWalkers: Walker[]
  selectedAddressId: string
}): Promise<SubmitResult> {
  const user = auth.currentUser
  if (!user) throw new Error('AUTH_REQUIRED')
  if (!form.petId || !selectedAddressId) throw new Error('BOOKING_DATA_INCOMPLETE')
  if (!form.zoneId) throw new Error('BOOKING_ZONE_UNAVAILABLE')
  if (!form.serviceId || !form.serviceName || !form.servicePackageType) throw new Error('BOOKING_SERVICE_INCOMPLETE')
  if (!Number.isSafeInteger(form.serviceVersion) || Number(form.serviceVersion) < 1) throw new Error('SERVICE_PRICE_NOT_CONFIGURED')
  if (!Number.isSafeInteger(form.serviceDurationMinutes) || Number(form.serviceDurationMinutes) <= 0) throw new Error('BOOKING_SERVICE_DURATION_MISSING')
  if (form.servicePackageType === 'weekly') throw new Error('BOOKING_WEEKLY_SCHEDULE_INCOMPLETE')

  const scheduledWalks = [[form.date, form.time] as [string, string]]

  if (scheduledWalks.length === 0 || scheduledWalks.some(([date, time]) => !date || !time)) {
    throw new Error('BOOKING_SCHEDULE_INCOMPLETE')
  }

  const validatedWalks = scheduledWalks.map(([date, time]) => ({
    date,
    time,
    window: parseTimeWindow(time),
  }))

  const [dogSnapshot, addressSnapshot, zoneSnapshot, bookingScheduleSnapshot] = await Promise.all([
    getDoc(doc(db, 'dogs', form.petId)),
    getDoc(doc(db, 'addresses', selectedAddressId)),
    getDoc(doc(db, 'zones', form.zoneId)),
    getDoc(doc(db, 'appSettings', 'bookingSchedule')),
  ])
  const dog = dogSnapshot.data()
  const address = addressSnapshot.data()
  const zone = zoneSnapshot.data()
  if (!dogSnapshot.exists() || dog?.ownerId !== user.uid) throw new Error('BOOKING_DOG_UNAVAILABLE')
  if (!addressSnapshot.exists() || address?.ownerId !== user.uid) throw new Error('BOOKING_ADDRESS_UNAVAILABLE')
  if (address?.zoneId !== form.zoneId || !zoneSnapshot.exists() || zone?.active !== true) {
    throw new Error('BOOKING_ZONE_UNAVAILABLE')
  }
  const bookingSchedule = bookingScheduleSnapshot.exists() ? parseBookingSchedule(bookingScheduleSnapshot.data()) : null
  if (!bookingSchedule?.active) throw new Error('BOOKING_SCHEDULE_UNAVAILABLE')
  const requestedSlot = buildBookingSlots(bookingSchedule, form.date, Number(form.serviceDurationMinutes))
    .find((slot) => slot.start === validatedWalks[0].window.start && slot.end === validatedWalks[0].window.end)
  if (!requestedSlot) throw new Error('BOOKING_SLOT_UNAVAILABLE')

  const orderRef = doc(collection(db, 'serviceOrders'))
  const batch = writeBatch(db)
  batch.set(orderRef, {
    customerId: user.uid,
    dogIds: [form.petId],
    serviceId: form.serviceId,
    serviceName: form.serviceName,
    serviceVersion: form.serviceVersion,
    paymentStatus: 'pending',
    packageType: form.servicePackageType,
    numberOfSessions: scheduledWalks.length,
    addressId: selectedAddressId,
    notes: form.notes,
    status: 'pending_confirmation',
    requestedSchedule: validatedWalks.map(({ date, time }) => ({ date, time })),
    createdAt: serverTimestamp(),
  })

  for (const { date, window } of validatedWalks) {
    const sessionRef = doc(collection(db, 'walkSessions'))
    batch.set(sessionRef, {
      orderId: orderRef.id,
      customerId: user.uid,
      dogIds: [form.petId],
      addressId: selectedAddressId,
      serviceId: form.serviceId,
      serviceVersion: form.serviceVersion,
      scheduledDate: date,
      scheduledStart: window.start,
      arrivalWindowStart: window.start,
      arrivalWindowEnd: window.end,
      notes: form.notes,
      status: 'requested',
      createdAt: serverTimestamp(),
    })
  }

  await batch.commit()

  const dates = scheduledWalks.map(([date]) => date).join(', ')
  const message = `Solicitud PET ${orderRef.id}\nFecha(s): ${dates}\nSolicito contacto para confirmar.`
  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`
  return { message, whatsappUrl }
}
