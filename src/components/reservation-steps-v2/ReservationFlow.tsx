'use client'

import { useState, useEffect, useCallback } from 'react'
import { db, auth } from '@/firebase/config'
import { collection, query, where, limit, getDocs } from 'firebase/firestore'
import { useSearchParams } from 'next/navigation'
import { submitReservation } from '@/lib/submitReservation'
import { usePrices } from '@/context/PricesContext'
import StepV2Pet from './StepV2Pet'
import StepV2Address from './StepV2Address'
import StepV2When from './StepV2When'
import StepV2Service from './StepV2Service'
import StepV2Walker from './StepV2Walker'
import StepV2Confirm from './StepV2Confirm'
import { CheckCircle2 } from 'lucide-react'

const STEPS = [
  { id: 'pet', label: 'Compañero', icon: '🐾' },
  { id: 'address', label: 'Dirección', icon: '📍' },
  { id: 'when', label: 'Momento', icon: '⏰' },
  { id: 'service', label: 'Servicio', icon: '🎯' },
  { id: 'walker', label: 'Paseador', icon: '🚶' },
  { id: 'confirm', label: 'Confirmar', icon: '✅' },
]

interface FormData {
  petId: string
  petName: string
  petType: string
  addressId: string
  address: string
  addressNote: string
  whenType: 'asap' | 'scheduled'
  date: string
  time: string
  windowStart: string
  windowEnd: string
  recurring: boolean
  recurringDays: Record<string, string>
  service: string
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
  addressNote: '',
  whenType: 'asap',
  date: '',
  time: '',
  windowStart: '',
  windowEnd: '',
  recurring: false,
  recurringDays: {},
  service: '',
  walkerId: '',
  walkerName: '',
  autoSearch: true,
  searchCancel: false,
}

export default function ReservationFlow() {
  const searchParams = useSearchParams()
  const { prices } = usePrices()
  const repeatService = searchParams.get('repeat') || ''

  const [step, setStep] = useState(0)
  const [form, setForm] = useState<FormData>(DEFAULT_FORM)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [userPets, setUserPets] = useState<{ id: string; name: string; type: string }[]>([])
  const [userAddresses, setUserAddresses] = useState<{ id: string; address: string }[]>([])
  const [availableWalkers, setAvailableWalkers] = useState<{ id: string; name: string; rating: number; completedWalks: number }[]>([])
  const [searchingWalkers, setSearchingWalkers] = useState(false)
  const [searchResult, setSearchResult] = useState<{ id: string; name: string; reason: string } | null>(null)

  const isRepeat = !!repeatService

  useEffect(() => {
    const user = auth.currentUser
    if (!user) return

    getDocs(query(collection(db, 'dogs'), where('ownerId', '==', user.uid), limit(10)))
      .then(snap => {
        setUserPets(snap.docs.map(d => ({ id: d.id, ...d.data() } as { id: string; name: string; type: string })))
      })
      .catch(() => {})

    getDocs(query(collection(db, 'addresses'), where('ownerId', '==', user.uid), limit(10)))
      .then(snap => {
        setUserAddresses(snap.docs.map(d => ({ id: d.id, ...d.data() } as { id: string; address: string })))
      })
      .catch(() => {})
  }, [])

  const updateForm = useCallback((updates: Partial<FormData>) => {
    setForm(prev => ({ ...prev, ...updates }))
  }, [])

  const nextStep = useCallback(() => {
    setStep(prev => Math.min(prev + 1, STEPS.length - 1))
  }, [])

  const prevStep = useCallback(() => {
    setStep(prev => Math.max(prev - 1, 0))
  }, [])

  const handleSubmit = async () => {
    setLoading(true)
    setError('')
    try {
      await submitReservation({
        form: {
          name: auth.currentUser?.displayName || '',
          phone: '',
          petName: form.petName,
          petType: form.petType,
          service: form.service,
          date: form.date,
          time: form.time,
          notes: form.addressNote,
          coupon: '',
          addressId: form.addressId,
          walkerPreference: form.walkerId,
        },
        prices,
        couponStatus: null,
        referralCode: '',
        weeklySchedule: form.recurringDays,
        walkerPreference: form.walkerId,
        availableWalkers,
        selectedAddressId: form.addressId,
        isWeeklyPackage: form.service === 'Paquete Semanal',
      })
      setSuccess('¡Paseo solicitado! Nos contactaremos contigo pronto.')
      clearDraft()
    } catch {
      setError('No se pudo solicitar el paseo. Inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const renderStep = () => {
    switch (STEPS[step].id) {
      case 'pet':
        return <StepV2Pet
          form={form}
          updateForm={updateForm}
          userPets={userPets}
          onNext={nextStep}
        />
      case 'address':
        return <StepV2Address
          form={form}
          updateForm={updateForm}
          userAddresses={userAddresses}
          onNext={nextStep}
          onBack={prevStep}
        />
      case 'when':
        return <StepV2When
          form={form}
          updateForm={updateForm}
          onNext={nextStep}
          onBack={prevStep}
        />
      case 'service':
        return <StepV2Service
          form={form}
          updateForm={updateForm}
          onNext={nextStep}
          onBack={prevStep}
        />
      case 'walker':
        return <StepV2Walker
          form={form}
          updateForm={updateForm}
          availableWalkers={availableWalkers}
          setAvailableWalkers={setAvailableWalkers}
          searchingWalkers={searchingWalkers}
          setSearchingWalkers={setSearchingWalkers}
          searchResult={searchResult}
          setSearchResult={setSearchResult}
          onNext={nextStep}
          onBack={prevStep}
        />
      case 'confirm':
        return <StepV2Confirm
          form={form}
          updateForm={updateForm}
          onSubmit={handleSubmit}
          onBack={prevStep}
          loading={loading}
          error={error}
          success={success}
        />
      default:
        return null
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
          {isRepeat ? 'Repetir último paseo' : 'Nuevo paseo'}
        </h2>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Paso {step + 1} de {STEPS.length}
        </span>
      </div>

      <div className="flex items-center gap-1 mb-8 overflow-x-auto pb-2">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center shrink-0">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              i < step ? 'bg-brand-500 text-white' :
              i === step ? 'bg-brand-500/20 text-brand-600 border-2 border-brand-500' :
              'bg-ink/5 text-ink/30'
            }`}>
              {i < step ? <CheckCircle2 size={14} /> : i + 1}
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-8 h-0.5 mx-1 ${i < step ? 'bg-brand-500' : 'bg-ink/10'}`} />
            )}
          </div>
        ))}
      </div>

      {renderStep()}
    </div>
  )
}

function clearDraft() {
  try { localStorage.removeItem('pq_reservation_draft') } catch { /* noop */ }
}