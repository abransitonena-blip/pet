import { db, auth } from '@/firebase/config'
import { collection, addDoc, serverTimestamp, getDocs, query, where, limit, doc, setDoc, updateDoc, increment } from 'firebase/firestore'
import { WHATSAPP_NUMBER } from '@/lib/utils'
import { getServicePrice } from '@/lib/services'
import { showPushNotification } from '@/components/PWARegister'
import { logAudit } from '@/lib/auditLog'

// Margin guard: discounts cannot reduce price below this percentage of base price
const MIN_MARGIN_PERCENT = 30

export function applyMarginGuard(basePrice: number, discount: number): number {
  const minPrice = Math.round(basePrice * MIN_MARGIN_PERCENT / 100)
  const maxDiscount = Math.max(0, basePrice - minPrice)
  return Math.min(discount, maxDiscount)
}

export function parseTimeWindow(slot: string): { start: string; end: string } {
  if (slot.includes('-')) {
    const [start, end] = slot.split('-')
    return { start, end }
  }
  return { start: slot, end: '' }
}

interface Form {
  name: string; phone: string; petName: string; petType: string;
  service: string; date: string; time: string; notes: string;
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
}

export async function submitReservation({
  form,
  prices,
  couponStatus,
  referralCode,
  weeklySchedule,
  walkerPreference,
  availableWalkers,
  selectedAddressId,
  isWeeklyPackage,
}: {
  form: Form
  prices: Record<string, number>
  couponStatus: CouponStatus | null
  referralCode: string
  weeklySchedule: Record<string, string>
  walkerPreference: string
  availableWalkers: Walker[]
  selectedAddressId: string
  isWeeklyPackage: boolean
}): Promise<SubmitResult> {
  const basePrice = prices[form.service] ?? getServicePrice(form.service)
  let discountAmount = 0
  if (couponStatus?.valid && couponStatus.discount) {
    discountAmount = couponStatus.type === 'percentage' ? Math.round(basePrice * couponStatus.discount / 100) : couponStatus.discount
  }
  discountAmount = applyMarginGuard(basePrice, discountAmount)
  const finalPrice = basePrice - discountAmount

  const PET_TYPES = [
    { value: 'perro', label: 'Perro' },
    { value: 'gato', label: 'Gato' },
    { value: 'otro', label: 'Otro' },
  ]
  const petTypeLabel = PET_TYPES.find((p) => p.value === form.petType)?.label || form.petType

  let message = `🐾 *Nuevo${isWeeklyPackage ? ' Paquete Semanal' : ' Paseo'} — PET Ap*\n`
  message += `👤 *Nombre:* ${form.name}\n`
  message += `📱 *Teléfono:* ${form.phone}\n`
  message += `🐶 *Mascota:* ${form.petName} (${petTypeLabel})\n`
  message += `🎒 *Paquete:* ${form.service}\n`
  if (basePrice > 0) message += `💰 *Precio:* $${basePrice.toLocaleString()}\n`
  if (discountAmount > 0) message += `🏷️ *Descuento:* -$${discountAmount.toLocaleString()} (${form.coupon.toUpperCase()})\n`
  message += `💵 *Total:* $${finalPrice.toLocaleString()}\n`
  if (!isWeeklyPackage) {
    message += `📅 *Fecha:* ${form.date}\n`
    message += `🕐 *Hora:* ${form.time}\n`
  } else {
    const scheduledDays = Object.entries(weeklySchedule).filter(([, t]) => t).sort()
    message += `📅 *Semana:* ${scheduledDays.length} días\n`
    scheduledDays.forEach(([date, time]) => {
      const d = new Date(date + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' })
      message += `  • ${d}: ${time}\n`
    })
  }
  if (form.notes) message += `📝 *Notas:* ${form.notes}\n`

  const orderIdRef = doc(collection(db, 'serviceOrders'))

  if (isWeeklyPackage && Object.values(weeklySchedule).some((t) => !!t)) {
    const scheduledDays = Object.entries(weeklySchedule).filter(([, t]) => t).sort()

    await setDoc(orderIdRef, {
      clientId: auth.currentUser?.uid || '',
      clientName: form.name,
      clientPhone: form.phone,
      dogIds: [],
      dogName: form.petName,
      petType: form.petType,
      serviceId: form.service,
      serviceName: form.service,
      packageType: 'weekly' as const,
      numberOfSessions: scheduledDays.length,
      addressId: selectedAddressId,
      zoneId: '',
      zoneName: '',
      subtotal: basePrice,
      zoneAdjustment: 0,
      discount: discountAmount,
      referralDiscount: 0,
      total: finalPrice,
      paymentStatus: 'pending' as const,
      status: 'active' as const,
      notes: form.notes,
      referralCode: referralCode || '',
      appliedCoupon: form.coupon.toUpperCase() || '',
      createdAt: serverTimestamp(),
    })

    for (const [date, time] of scheduledDays) {
      const window = parseTimeWindow(time)
      const sessionRef = doc(collection(db, 'serviceOrders', orderIdRef.id, 'sessions'))
      await setDoc(sessionRef, {
        orderId: orderIdRef.id,
        clientId: auth.currentUser?.uid || '',
        clientName: form.name,
        clientPhone: form.phone,
        dogName: form.petName,
        petType: form.petType,
        serviceName: form.service,
        date,
        startTime: time,
        arrivalWindowStart: window.start,
        arrivalWindowEnd: window.end,
        expectedEndTime: '',
        zoneId: '',
        zoneName: '',
        addressId: selectedAddressId,
        walkerId: walkerPreference || '',
        walkerName: walkerPreference ? availableWalkers.find((w) => w.id === walkerPreference)?.name || '' : '',
        assignmentStatus: walkerPreference ? 'client_preferred' : 'unassigned',
        sessionStatus: 'pending',
        notes: form.notes,
        internalNotes: '',
        history: [{ status: 'pending', timestamp: new Date().toISOString() }],
        createdAt: serverTimestamp(),
      })
    }

    for (const [date, time] of scheduledDays) {
      const window = parseTimeWindow(time)
      await addDoc(collection(db, 'reservations'), {
        uid: auth.currentUser?.uid || '',
        client: { uid: auth.currentUser?.uid || '', name: form.name, phone: form.phone },
        name: form.name, phone: form.phone, petName: form.petName, petType: form.petType,
        service: '[Paquete] ' + form.service, date, time,
        arrivalWindowStart: window.start, arrivalWindowEnd: window.end,
        notes: form.notes,
        status: 'pending' as const,
        assignedWalker: walkerPreference || '',
        orderId: orderIdRef.id,
        createdAt: serverTimestamp(),
      })
    }
    showPushNotification('🐾 Paquete Semanal', `${form.name} agendó paquete de ${scheduledDays.length} sesiones`)
  } else {
    const window = parseTimeWindow(form.time)

    await setDoc(orderIdRef, {
      clientId: auth.currentUser?.uid || '',
      clientName: form.name,
      clientPhone: form.phone,
      serviceName: form.service,
      total: finalPrice,
      discount: discountAmount,
      paymentStatus: 'pending' as const,
      status: 'active' as const,
      notes: form.notes,
      referralCode: referralCode || '',
      appliedCoupon: form.coupon.toUpperCase() || '',
      createdAt: serverTimestamp(),
    })

    const sessionRef = doc(collection(db, 'serviceOrders', orderIdRef.id, 'sessions'))
    await setDoc(sessionRef, {
      orderId: orderIdRef.id,
      clientId: auth.currentUser?.uid || '',
      clientName: form.name,
      clientPhone: form.phone,
      dogName: form.petName,
      petType: form.petType,
      serviceName: form.service,
      date: form.date,
      startTime: form.time,
      arrivalWindowStart: window.start,
      arrivalWindowEnd: window.end,
      expectedEndTime: '',
      zoneId: '',
      zoneName: '',
      addressId: selectedAddressId,
      walkerId: walkerPreference || '',
      walkerName: walkerPreference ? availableWalkers.find((w) => w.id === walkerPreference)?.name || '' : '',
      assignmentStatus: walkerPreference ? 'client_preferred' : 'unassigned',
      sessionStatus: 'pending',
      notes: form.notes,
      internalNotes: '',
      history: [{ status: 'pending', timestamp: new Date().toISOString() }],
      createdAt: serverTimestamp(),
    })

    await addDoc(collection(db, 'reservations'), {
      uid: auth.currentUser?.uid || '',
      client: { uid: auth.currentUser?.uid || '', name: form.name, phone: form.phone },
      name: form.name, phone: form.phone, petName: form.petName, petType: form.petType,
      service: form.service, date: form.date, time: form.time,
      arrivalWindowStart: window.start, arrivalWindowEnd: window.end,
      notes: form.notes,
      status: 'pending' as const,
      assignedWalker: walkerPreference || '',
      orderId: orderIdRef.id,
      createdAt: serverTimestamp(),
    })
    showPushNotification('🐾 Nueva reserva', `${form.name} agendó "${form.service}" para ${form.petName}`)
  }

  // Save/update client profile
  if (auth.currentUser) {
    await setDoc(doc(db, 'clients', auth.currentUser.uid), {
      name: form.name,
      phone: form.phone,
      email: auth.currentUser.email || '',
    }, { merge: true }).catch(() => {})
  }

  // Increment coupon usedCount
  if (form.coupon.trim() && couponStatus?.valid) {
    const couponQ = query(collection(db, 'coupons'), where('code', '==', form.coupon.trim().toUpperCase()), limit(1))
    const couponSnap = await getDocs(couponQ)
    if (!couponSnap.empty) {
      await updateDoc(doc(db, 'coupons', couponSnap.docs[0].id), {
        usedCount: increment(1),
      }).catch(() => {})
    }
  }

  // Audit log
  logAudit({
    action: 'create',
    entity: 'reservation',
    entityId: orderIdRef.id,
    after: { service: form.service, date: form.date, time: form.time, client: form.name, pet: form.petName },
  })

  // Referral tracking
  if (referralCode && referralCode !== form.phone) {
    const refQ = query(collection(db, 'referrals'), where('code', '==', referralCode), where('active', '==', true))
    const refSnap = await getDocs(refQ)
    if (!refSnap.empty) {
      const refDoc = refSnap.docs[0]
      await addDoc(collection(db, 'referrals', refDoc.id, 'conversions'), {
        refereePhone: form.phone,
        refereeName: form.name,
        reservationId: 'pending',
        status: 'pending',
        createdAt: serverTimestamp(),
      }).catch(() => {})
    }
  }

  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, '_blank')

  return { message }
}
