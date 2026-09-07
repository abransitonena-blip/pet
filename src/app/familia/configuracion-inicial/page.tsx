'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Check, Dog, MapPin, Search, UserRound } from 'lucide-react'
import { auth } from '@/firebase/config'
import {
  getFamilyOnboardingStep,
  isLaQuebradaSearch,
  loadActiveZones,
  loadFamilyOnboardingSnapshot,
  normalizeZoneName,
  previousFamilyOnboardingStep,
  saveOnboardingAddress,
  saveOnboardingDog,
  saveOnboardingProfile,
  validateFamilyOnboardingStep,
  type FamilyOnboardingStep,
  type OnboardingZone,
} from '@/lib/familyOnboarding'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import type { InputProps } from '@/components/ui/Input'

const STEPS: Array<{ id: Exclude<FamilyOnboardingStep, 'complete'>; label: string }> = [
  { id: 'profile', label: 'Tus datos' },
  { id: 'zone-address', label: 'Zona y dirección' },
  { id: 'dog', label: 'Tu perro' },
]

function LabeledInput({ label, ...props }: InputProps & { label: string }) {
  const id = props.id || `onboarding-${label.toLocaleLowerCase('es-MX').replace(/\s+/g, '-')}`
  return (
    <label htmlFor={id} className="block space-y-2 text-sm font-medium text-ink">
      <span>{label}{props.required ? ' *' : ''}</span>
      <Input {...props} id={id} />
    </label>
  )
}

function friendlyError(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
  if (code.includes('permission-denied')) return 'No tienes permiso para guardar estos datos. Vuelve a iniciar sesión e inténtalo nuevamente.'
  if (code.includes('unavailable') || code.includes('network')) return 'No pudimos conectar. Conservamos lo que escribiste para que puedas reintentar.'
  return 'No pudimos guardar este paso. Revisa los datos e inténtalo nuevamente.'
}

export default function FamilyInitialSetupPage() {
  const router = useRouter()
  const savingRef = useRef(false)
  const [step, setStep] = useState<FamilyOnboardingStep>('profile')
  const [zones, setZones] = useState<OnboardingZone[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [zoneSearch, setZoneSearch] = useState('')
  const [zoneId, setZoneId] = useState('')
  const [existingAddressId, setExistingAddressId] = useState<string | undefined>()
  const [address, setAddress] = useState({ alias: 'Casa', street: '', exterior: '', colony: '', city: '', state: '', zip: '' })
  const [dog, setDog] = useState({ name: '', breed: '', size: '' })

  useEffect(() => {
    let active = true
    ;(async () => {
      const user = auth.currentUser
      if (!user) return
      try {
        const [snapshot, activeZones] = await Promise.all([
          loadFamilyOnboardingSnapshot(user.uid),
          loadActiveZones(),
        ])
        if (!active) return
        setName(snapshot.profile?.name || user.displayName || '')
        setPhone(snapshot.profile?.phone || '')
        setExistingAddressId(snapshot.firstAddressId)
        if (snapshot.firstAddress) {
          setAddress({
            alias: snapshot.firstAddress.alias,
            street: snapshot.firstAddress.street,
            exterior: snapshot.firstAddress.exterior,
            colony: snapshot.firstAddress.colony,
            city: snapshot.firstAddress.city,
            state: snapshot.firstAddress.state,
            zip: snapshot.firstAddress.zip,
          })
          setZoneId(snapshot.firstAddress.zoneId)
        }
        setZones(activeZones)
        const nextStep = getFamilyOnboardingStep(snapshot)
        if (nextStep === 'complete') router.replace('/familia')
        else setStep(nextStep)
      } catch (cause) {
        if (active) setError(friendlyError(cause))
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [router])

  const filteredZones = useMemo(() => {
    const search = normalizeZoneName(zoneSearch)
    if (!search) return zones
    return zones.filter((zone) => normalizeZoneName(zone.name).includes(search))
  }, [zoneSearch, zones])

  const selectedZone = zones.find((zone) => zone.id === zoneId)
  const laQuebradaUnavailable = isLaQuebradaSearch(zoneSearch)
    && !zones.some((zone) => normalizeZoneName(zone.name) === 'la quebrada')

  const submit = async () => {
    if (savingRef.current) return
    const user = auth.currentUser
    if (!user) { setError('Tu sesión terminó. Vuelve a iniciar sesión.'); return }
    setError('')

    const issue = validateFamilyOnboardingStep(step, {
      name,
      phone,
      zoneId,
      street: address.street,
      colony: address.colony,
      city: address.city,
      dogName: dog.name,
      dogSize: dog.size,
    })
    if (issue) {
      setError(issue.message)
      const fieldId = issue.field === 'zoneId' ? 'onboarding-zone-search' : `onboarding-${issue.field}`
      requestAnimationFrame(() => document.getElementById(fieldId)?.focus())
      return
    }

    savingRef.current = true
    setSaving(true)
    try {
      if (step === 'profile') {
        await saveOnboardingProfile(user.uid, name, phone)
        setStep('zone-address')
      } else if (step === 'zone-address') {
        await saveOnboardingAddress(user.uid, { zoneId, ...address }, existingAddressId)
        setStep('dog')
      } else if (step === 'dog') {
        await saveOnboardingDog(user.uid, dog)
        router.replace('/familia')
      }
    } catch (cause) {
      setError(friendlyError(cause))
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  if (loading) return <div className="mx-auto max-w-2xl py-12 text-center text-sm text-muted" role="status">Preparando tu cuenta…</div>

  const activeIndex = Math.max(0, STEPS.findIndex((item) => item.id === step))
  const previousStep = previousFamilyOnboardingStep(step)

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-10">
      <header>
        <p className="text-sm font-semibold text-primary">Configuración inicial</p>
        <h1 className="mt-1 text-2xl font-bold text-ink sm:text-3xl">Prepara tu Familia PET</h1>
        <p className="mt-2 text-sm text-muted">Solo pedimos los datos necesarios para solicitar y operar un paseo.</p>
      </header>

      <ol className="grid grid-cols-3 gap-2" aria-label="Progreso de configuración">
        {STEPS.map((item, index) => (
          <li key={item.id} className="min-w-0">
            <div className={`h-1.5 rounded-full ${index <= activeIndex ? 'bg-primary' : 'bg-ink/10'}`} />
            <span className="mt-2 block text-xs leading-tight text-muted" aria-current={index === activeIndex ? 'step' : undefined}>{index + 1}. {item.label}</span>
          </li>
        ))}
      </ol>

      <Card className="p-5 sm:p-7">
        {step === 'profile' && (
          <section aria-labelledby="profile-title" className="space-y-4">
            <div className="flex items-center gap-3"><UserRound aria-hidden="true" className="text-primary" /><h2 id="profile-title" className="text-lg font-semibold text-ink">Tus datos de contacto</h2></div>
            <LabeledInput id="onboarding-name" label="Nombre" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" maxLength={80} required />
            <LabeledInput id="onboarding-phone" label="Teléfono" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" inputMode="tel" maxLength={20} required />
          </section>
        )}

        {step === 'zone-address' && (
          <section aria-labelledby="address-title" className="space-y-4">
            <div className="flex items-center gap-3"><MapPin aria-hidden="true" className="text-primary" /><h2 id="address-title" className="text-lg font-semibold text-ink">Zona y dirección</h2></div>
            <LabeledInput id="onboarding-zone-search" label="Buscar zona" value={zoneSearch} onChange={(event) => { setZoneSearch(event.target.value); setZoneId('') }} leftIcon={<Search size={18} />} placeholder="Ej. La Quebrada" aria-describedby="onboarding-zone-help" />
            <p id="onboarding-zone-help" className="text-xs text-muted">Busca por nombre y selecciona una opción. La identidad guardada siempre será el ID de la zona.</p>
            {laQuebradaUnavailable && <p className="rounded-xl bg-warning/10 p-3 text-sm text-ink" role="status">Aún no tenemos cobertura en esta zona. Puedes contactarnos para solicitar aviso cuando se habilite.</p>}
            <div className="grid gap-2 sm:grid-cols-2" role="listbox" aria-label="Zonas disponibles">
              {filteredZones.map((zone) => (
                <button key={zone.id} type="button" role="option" aria-selected={zoneId === zone.id} onClick={() => setZoneId(zone.id)} className={`min-h-11 rounded-xl border px-4 py-3 text-left text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${zoneId === zone.id ? 'border-primary bg-primary/10 text-ink' : 'border-ink/10 bg-surface text-ink hover:border-primary/50'}`}>
                  {zone.name}{zoneId === zone.id && <Check className="ml-2 inline" size={16} aria-hidden="true" />}
                </button>
              ))}
            </div>
            {zones.length === 0 && <p className="rounded-xl bg-warning/10 p-3 text-sm text-amber-800" role="status">No hay zonas activas disponibles en este momento. No puedes guardar una dirección hasta que administración habilite cobertura.</p>}
            {zoneSearch && filteredZones.length === 0 && !laQuebradaUnavailable && <p className="text-sm text-muted">No encontramos una zona disponible con ese nombre.</p>}
            {selectedZone && <p className="text-sm text-muted">Zona seleccionada: <strong className="text-ink">{selectedZone.name}</strong></p>}
            <div className="grid gap-4 sm:grid-cols-2">
              <LabeledInput id="onboarding-street" label="Calle" value={address.street} onChange={(event) => setAddress({ ...address, street: event.target.value })} maxLength={120} required />
              <LabeledInput label="Número exterior (opcional)" value={address.exterior} onChange={(event) => setAddress({ ...address, exterior: event.target.value })} maxLength={20} />
              <LabeledInput id="onboarding-colony" label="Colonia" value={address.colony} onChange={(event) => setAddress({ ...address, colony: event.target.value })} maxLength={80} required />
              <LabeledInput id="onboarding-city" label="Ciudad" value={address.city} onChange={(event) => setAddress({ ...address, city: event.target.value })} maxLength={80} required />
              <LabeledInput label="Estado (opcional)" value={address.state} onChange={(event) => setAddress({ ...address, state: event.target.value })} maxLength={80} />
              <LabeledInput label="Código postal (opcional)" value={address.zip} onChange={(event) => setAddress({ ...address, zip: event.target.value })} inputMode="numeric" maxLength={10} />
            </div>
          </section>
        )}

        {step === 'dog' && (
          <section aria-labelledby="dog-title" className="space-y-4">
            <div className="flex items-center gap-3"><Dog aria-hidden="true" className="text-primary" /><h2 id="dog-title" className="text-lg font-semibold text-ink">Tu primer perro</h2></div>
            <LabeledInput id="onboarding-dogName" label="Nombre" value={dog.name} onChange={(event) => setDog({ ...dog, name: event.target.value })} maxLength={60} required />
            <LabeledInput label="Raza (opcional)" value={dog.breed} onChange={(event) => setDog({ ...dog, breed: event.target.value })} maxLength={80} />
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-ink">Tamaño</legend>
              <div id="onboarding-dogSize" tabIndex={-1} className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-3">
                {['Pequeño', 'Mediano', 'Grande'].map((size) => <button key={size} type="button" onClick={() => setDog({ ...dog, size })} aria-pressed={dog.size === size} className={`min-h-11 rounded-xl border px-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none ${dog.size === size ? 'border-primary bg-primary/10 text-ink' : 'border-ink/10 bg-surface text-muted hover:border-primary/50'}`}>{size}</button>)}
              </div>
            </fieldset>
          </section>
        )}

        {error && <p className="mt-5 rounded-xl bg-danger/10 p-3 text-sm text-danger" role="alert">{error}</p>}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          {previousStep ? (
            <Button variant="ghost" leftIcon={<ArrowLeft size={16} />} disabled={saving} onClick={() => { setError(''); setStep(previousStep) }}>
              Volver
            </Button>
          ) : <span />}
          <Button onClick={() => void submit()} isLoading={saving}>{step === 'dog' ? 'Terminar configuración' : 'Guardar y continuar'}</Button>
        </div>
      </Card>
    </div>
  )
}
