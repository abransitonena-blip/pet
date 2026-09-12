'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { db, auth } from '@/firebase/config'
import { collection, doc, query, where, limit, getDoc, getDocs } from 'firebase/firestore'
import { useSearchParams } from 'next/navigation'
import { submitReservation } from '@/lib/submitReservation'
import { usePrices } from '@/context/PricesContext'
import StepV2Service from './StepV2Service'
import StepV2Details from './StepV2Details'
import StepV2Schedule from './StepV2Schedule'
import StepV2Confirm from './StepV2Confirm'
import { CheckCircle2 } from 'lucide-react'
import { getReservationServiceOptions, normalizeServiceName, type ReservationPackageType } from '@/lib/walkServices'
import { getReservationValidationIssues, type ReservationStepId } from '@/lib/reservationValidation'
import { nextStepIndex, soleChoice } from '@/lib/reservationPrefill'

const STEPS = [
  { id: 'service', label: 'Servicio' },
  { id: 'details', label: 'Perro y dirección' },
  { id: 'schedule', label: 'Fecha y horario' },
  { id: 'confirm', label: 'Revisar y enviar' },
] as const

interface FormData {
  petId: string
  petName: string
  petType: string
  addressId: string
  address: string
  zoneId: string
  zoneActive: boolean
  addressNote: string
  whenType: 'asap' | 'scheduled'
  date: string
  time: string
  windowStart: string
  windowEnd: string
  recurring: boolean
  recurringDays: Record<string, string>
  serviceId: string
  serviceName: string
  servicePackageType: ReservationPackageType | ''
  serviceAmountCents: number | null
  serviceVersion: number | null
  serviceComplimentary: boolean
  serviceDurationMinutes: number | null
  walkerId: string
  walkerName: string
  autoSearch: boolean
  searchCancel: boolean
}

const DEFAULT_FORM: FormData = {
  petId: '',
  petName: '',
  petType: 'perro',
  addressId: '',
  address: '',
  zoneId: '',
  zoneActive: false,
  addressNote: '',
  whenType: 'scheduled',
  date: '',
  time: '',
  windowStart: '',
  windowEnd: '',
  recurring: false,
  recurringDays: {},
  serviceId: '',
  serviceName: '',
  servicePackageType: '',
  serviceAmountCents: null,
  serviceVersion: null,
  serviceComplimentary: false,
  serviceDurationMinutes: null,
  walkerId: '',
  walkerName: '',
  autoSearch: true,
  searchCancel: false,
}

export default function ReservationFlow() {
  const searchParams = useSearchParams()
  const { services: prices, status: priceStatus } = usePrices()
  const repeatService = searchParams.get('repeat') || ''

  const [step, setStep] = useState(0)
  const [form, setForm] = useState<FormData>(DEFAULT_FORM)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sourceError, setSourceError] = useState('')
  const [success, setSuccess] = useState('')
  const [whatsAppPreview, setWhatsAppPreview] = useState<{ message: string; url: string } | null>(null)
  const [userPets, setUserPets] = useState<{ id: string; name: string; type: string }[]>([])
  const [userAddresses, setUserAddresses] = useState<{ id: string; address: string; zoneId: string; zoneActive: boolean }[]>([])
  const submissionLocked = useRef(false)

  const isRepeat = !!repeatService

  useEffect(() => {
    const user = auth.currentUser
    if (!user) return

    getDocs(query(collection(db, 'dogs'), where('ownerId', '==', user.uid), limit(10)))
      .then(snap => {
        setUserPets(snap.docs.map(d => ({ id: d.id, ...d.data() } as { id: string; name: string; type: string })))
      })
      .catch((cause) => {
        const code = cause && typeof cause === 'object' && 'code' in cause ? String((cause as { code?: unknown }).code) : ''
        setSourceError(code.includes('permission-denied')
          ? 'Tu sesión no tiene permiso para consultar tus perros guardados.'
          : 'No pudimos consultar tus perros guardados. Revisa tu conexión.')
      })

    Promise.all([
      getDocs(query(collection(db, 'addresses'), where('ownerId', '==', user.uid), limit(10))),
      getDocs(query(collection(db, 'zones'), where('active', '==', true), limit(100))),
    ])
      .then(([addressSnapshot, zoneSnapshot]) => {
        const activeZoneIds = new Set(zoneSnapshot.docs.map((item) => item.id))
        setUserAddresses(addressSnapshot.docs.map((item) => {
          const data = item.data()
          const zoneId = String(data.zoneId || '')
          const line = [data.street, data.exterior, data.colony, data.city]
            .filter((value) => typeof value === 'string' && value.trim())
            .join(', ')
          return {
            id: item.id,
            address: line || String(data.alias || 'Dirección guardada'),
            zoneId,
            zoneActive: zoneId.length > 0 && activeZoneIds.has(zoneId),
          }
        }))
      })
      .catch((cause) => {
        const code = cause && typeof cause === 'object' && 'code' in cause ? String((cause as { code?: unknown }).code) : ''
        setSourceError(code.includes('permission-denied')
          ? 'Tu sesión no tiene permiso para consultar tus direcciones o las zonas disponibles.'
          : 'No pudimos consultar tus direcciones y zonas disponibles. Revisa tu conexión.')
      })
  }, [])

  const updateForm = useCallback((updates: Partial<FormData>) => {
    setForm(prev => ({ ...prev, ...updates }))
  }, [])

  // Una familia con un perro y una dirección no tiene nada que elegir ahí: se
  // eligen solos y el paso se salta, pero siguen a la vista en el resumen y se
  // pueden cambiar desde ahí. Una dirección cuya zona ya no está disponible no
  // se elige sola: ese problema tiene que verse.
  useEffect(() => {
    const onlyPet = soleChoice(userPets)
    const onlyAddress = soleChoice(userAddresses)
    setForm((prev) => {
      const next = { ...prev }
      if (!prev.petId && onlyPet) {
        next.petId = onlyPet.id
        next.petName = onlyPet.name
        next.petType = onlyPet.type || 'perro'
      }
      if (!prev.addressId && onlyAddress && onlyAddress.zoneActive) {
        next.addressId = onlyAddress.id
        next.address = onlyAddress.address
        next.zoneId = onlyAddress.zoneId
        next.zoneActive = true
      }
      return next
    })
  }, [userPets, userAddresses])

  useEffect(() => {
    if (priceStatus !== 'ready') return
    const options = getReservationServiceOptions(prices)
    const selected = form.serviceId
      ? options.find((option) => option.id === form.serviceId)
      : options.find((option) => option.id === repeatService || option.name === normalizeServiceName(repeatService))
    if (!selected || (!form.serviceId && !selected.isRequestable)) return
    if (
      form.serviceId !== selected.id
      || form.serviceAmountCents !== selected.amountCents
      || form.serviceVersion !== selected.version
      || form.serviceComplimentary !== selected.complimentary
      || form.serviceDurationMinutes !== selected.durationMinutes
    ) {
      updateForm({
        serviceId: selected.id,
        serviceName: selected.name,
        servicePackageType: selected.packageType,
        serviceAmountCents: selected.amountCents,
        serviceVersion: selected.version,
        serviceComplimentary: selected.complimentary,
        serviceDurationMinutes: selected.durationMinutes,
      })
    }
  }, [form.serviceAmountCents, form.serviceComplimentary, form.serviceDurationMinutes, form.serviceId, form.serviceVersion, priceStatus, prices, repeatService, updateForm])

  const validateAddressBeforeConfirmation = useCallback(async () => {
    const user = auth.currentUser
    if (!user || !form.addressId || !form.zoneId) return false
    try {
      const [addressSnapshot, zoneSnapshot] = await Promise.all([
        getDoc(doc(db, 'addresses', form.addressId)),
        getDoc(doc(db, 'zones', form.zoneId)),
      ])
      const address = addressSnapshot.data()
      const zone = zoneSnapshot.data()
      const valid = addressSnapshot.exists()
        && address?.ownerId === user.uid
        && address?.zoneId === form.zoneId
        && zoneSnapshot.exists()
        && zone?.active === true
      if (!valid) {
        updateForm({ zoneActive: false })
        setSourceError('La zona de esta dirección ya no está disponible. Actualiza la dirección antes de reservar.')
      }
      return valid
    } catch (cause) {
      const code = cause && typeof cause === 'object' && 'code' in cause ? String((cause as { code?: unknown }).code) : ''
      setSourceError(code.includes('permission-denied')
        ? 'Tu sesión no tiene permiso para comprobar esta dirección.'
        : 'No pudimos comprobar la dirección y su zona. Revisa tu conexión.')
      return false
    }
  }, [form.addressId, form.zoneId, updateForm])

  const nextStep = useCallback(async () => {
    if (STEPS[step].id === 'schedule' && !(await validateAddressBeforeConfirmation())) {
      setStep(STEPS.findIndex((item) => item.id === 'details'))
      return
    }
    setSourceError('')
    const issues = getReservationValidationIssues(form)
    setStep(prev => nextStepIndex(prev, issues, STEPS.map((item) => item.id)))
  }, [form, step, validateAddressBeforeConfirmation])

  // Hacia atrás nunca se salta nada: quien regresa es justo quien quiere
  // cambiar el perro o la dirección que se eligieron solos.
  const prevStep = useCallback(() => {
    setStep(prev => Math.max(prev - 1, 0))
  }, [])

  const goToStep = useCallback((stepId: ReservationStepId) => {
    const target = STEPS.findIndex((item) => item.id === stepId)
    if (target >= 0) setStep(target)
  }, [])

  const handleSubmit = async () => {
    if (submissionLocked.current) return
    const validationIssues = getReservationValidationIssues(form)
    if (validationIssues.length > 0) {
      setError('Corrige los datos indicados antes de enviar la solicitud.')
      return
    }
    submissionLocked.current = true
    setLoading(true)
    setError('')
    try {
      const result = await submitReservation({
        form: {
          name: auth.currentUser?.displayName || '',
          phone: '',
          petId: form.petId,
          petName: form.petName,
          petType: form.petType,
          serviceId: form.serviceId,
          serviceName: form.serviceName,
          servicePackageType: form.servicePackageType,
          serviceVersion: form.serviceVersion,
          serviceDurationMinutes: form.serviceDurationMinutes,
          zoneId: form.zoneId,
          date: form.date,
          time: form.time,
          notes: form.addressNote,
          coupon: '',
          addressId: form.addressId,
          walkerPreference: '',
        },
        couponStatus: null,
        referralCode: '',
        walkerPreference: '',
        availableWalkers: [],
        selectedAddressId: form.addressId,
      })
      setSuccess('¡Paseo solicitado! Nos contactaremos contigo pronto.')
      setWhatsAppPreview({ message: result.message, url: result.whatsappUrl })
      clearDraft()
    } catch (cause) {
      const code = cause && typeof cause === 'object' && 'code' in cause ? String((cause as { code?: unknown }).code) : ''
      const message = cause instanceof Error ? cause.message : ''
      setError(
        message === 'AUTH_REQUIRED' ? 'Tu sesión terminó. Inicia sesión nuevamente para enviar la solicitud.'
        : message === 'SERVICE_PRICE_NOT_CONFIGURED' ? 'El servicio elegido no tiene un precio configurado. Vuelve al paso Servicio.'
        : message === 'BOOKING_ZONE_UNAVAILABLE' ? 'La zona de la dirección ya no está disponible. Actualiza la dirección antes de reservar.'
        : message === 'BOOKING_ADDRESS_UNAVAILABLE' ? 'La dirección ya no está disponible para esta cuenta.'
        : message === 'BOOKING_DOG_UNAVAILABLE' ? 'El perro seleccionado ya no está disponible para esta cuenta.'
        : message === 'BOOKING_SCHEDULE_UNAVAILABLE' ? 'El equipo PET aún no configura el horario de solicitudes.'
        : message === 'BOOKING_SLOT_UNAVAILABLE' ? 'Ese horario dejó de estar disponible para solicitar. Elige otro.'
        : message === 'BOOKING_SERVICE_DURATION_MISSING' ? 'El servicio no tiene una duración configurada.'
        : message.includes('INCOMPLETE') ? 'Faltan datos de la solicitud. Revisa los campos indicados.'
        : code.includes('permission-denied') ? 'Tu sesión no tiene permiso para registrar esta solicitud.'
        : code.includes('unavailable') ? 'El servicio no está disponible temporalmente. Conservamos tu progreso para intentarlo después.'
        : 'No pudimos registrar la solicitud. Revisa tu conexión e inténtalo nuevamente.',
      )
    } finally {
      setLoading(false)
      submissionLocked.current = false
    }
  }

  const renderStep = () => {
    switch (STEPS[step].id) {
      case 'service':
        return <StepV2Service form={form} updateForm={updateForm} prices={prices} priceStatus={priceStatus} onNext={nextStep} />
      case 'details':
        return <StepV2Details
          form={form}
          updateForm={updateForm}
          userPets={userPets}
          userAddresses={userAddresses}
          onNext={nextStep}
          onBack={prevStep}
        />
      case 'schedule':
        return <StepV2Schedule
          form={form}
          updateForm={updateForm}
          onNext={nextStep}
          onBack={prevStep}
        />
      case 'confirm':
        return <StepV2Confirm
          form={form}
          updateForm={updateForm}
          onSubmit={handleSubmit}
          onBack={prevStep}
          onGoToStep={goToStep}
          loading={loading}
          error={error}
          success={success}
          whatsAppPreview={whatsAppPreview}
        />
      default:
        return null
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
          {isRepeat ? 'Repetir último paseo' : 'Nuevo paseo'}
        </h2>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Paso {step + 1} de {STEPS.length}
        </span>
      </div>

      <ol className="mb-8 grid grid-cols-4 gap-1" aria-label="Progreso de la reserva">
        {STEPS.map((s, i) => (
          <li key={s.id} className="min-w-0 text-center">
            <div className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors motion-reduce:transition-none ${
              i < step ? 'bg-brand-500 text-white' :
              i === step ? 'bg-brand-500/20 text-brand-600 border-2 border-brand-500' :
              'bg-ink/5 text-ink/30'
            }`}>
              {i < step ? <CheckCircle2 size={14} /> : i + 1}
            </div>
            <span className="mt-1 hidden truncate text-[11px] text-muted sm:block">{s.label}</span>
          </li>
        ))}
      </ol>

      {sourceError && (
        <p className="mb-4 rounded-xl bg-danger-500/10 px-4 py-3 text-sm text-red-700" role="alert">
          {sourceError}
        </p>
      )}

      {renderStep()}
    </div>
  )
}

function clearDraft() {
  try { localStorage.removeItem('pq_reservation_draft') } catch { /* noop */ }
}
