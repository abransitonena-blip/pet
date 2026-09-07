'use client'

import Link from 'next/link'
import { CheckCircle2, Dog, MapPin } from 'lucide-react'
import { Button } from '@/components/ui'

interface DetailsForm {
  petId: string
  petName: string
  petType: string
  addressId: string
  address: string
  zoneId: string
  zoneActive: boolean
}

interface StepV2DetailsProps {
  form: DetailsForm
  updateForm: (updates: Partial<DetailsForm>) => void
  userPets: { id: string; name: string; type: string }[]
  userAddresses: { id: string; address: string; zoneId: string; zoneActive: boolean }[]
  onNext: () => void
  onBack: () => void
}

export default function StepV2Details({ form, updateForm, userPets, userAddresses, onNext, onBack }: StepV2DetailsProps) {
  return (
    <div className="space-y-6">
      <section aria-labelledby="booking-dog-title">
        <div className="flex items-end justify-between gap-3"><div><h3 id="booking-dog-title" className="text-base font-semibold text-ink">Perro</h3><p className="text-sm text-muted">Selecciona un perfil guardado.</p></div><Link href="/familia/perros" className="min-h-11 py-3 text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Gestionar</Link></div>
        {userPets.length === 0 ? <p className="mt-3 rounded-xl bg-warning/10 px-4 py-3 text-sm text-ink">Registra primero un perro desde Familia PET.</p> : <div className="mt-3 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Seleccionar perro">{userPets.map((pet) => {
          const selected = form.petId === pet.id
          return <button key={pet.id} type="button" role="radio" aria-checked={selected} onClick={() => updateForm({ petId: pet.id, petName: pet.name, petType: pet.type || 'perro' })} className={`flex min-h-11 items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none ${selected ? 'bg-primary/10 text-ink ring-1 ring-primary' : 'bg-ink/[0.035] text-ink hover:bg-ink/[0.07]'}`}><Dog size={18} aria-hidden="true" /><span className="min-w-0 flex-1 truncate text-sm font-semibold">{pet.name}</span>{selected && <CheckCircle2 size={17} className="text-primary" aria-hidden="true" />}</button>
        })}</div>}
      </section>

      <section aria-labelledby="booking-address-title">
        <div className="flex items-end justify-between gap-3"><div><h3 id="booking-address-title" className="text-base font-semibold text-ink">Dirección</h3><p className="text-sm text-muted">Debe pertenecer a una zona activa.</p></div><Link href="/familia/direcciones?returnTo=/familia/nueva-reserva" className="min-h-11 py-3 text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Gestionar</Link></div>
        {userAddresses.length === 0 ? <p className="mt-3 rounded-xl bg-warning/10 px-4 py-3 text-sm text-ink">Registra primero una dirección y selecciona su zona.</p> : <div className="mt-3 space-y-2" role="radiogroup" aria-label="Seleccionar dirección">{userAddresses.map((address) => {
          const selected = form.addressId === address.id
          return <button key={address.id} type="button" role="radio" aria-checked={selected} disabled={!address.zoneActive} onClick={() => updateForm({ addressId: address.id, address: address.address, zoneId: address.zoneId, zoneActive: true })} className={`flex min-h-11 w-full items-start gap-3 rounded-xl px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-65 motion-reduce:transition-none ${selected ? 'bg-primary/10 text-ink ring-1 ring-primary' : 'bg-ink/[0.035] text-ink hover:bg-ink/[0.07]'}`}><MapPin size={18} className="mt-0.5 shrink-0" aria-hidden="true" /><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{address.address}</span>{!address.zoneActive && <span className="mt-1 block text-xs text-warning">Zona sin cobertura. Actualiza esta dirección.</span>}</span>{selected && <CheckCircle2 size={17} className="text-primary" aria-hidden="true" />}</button>
        })}</div>}
      </section>

      <div className="flex justify-between gap-3 pt-2"><Button variant="secondary" onClick={onBack}>← Atrás</Button><Button onClick={onNext} disabled={!form.petId || !form.addressId || !form.zoneId || !form.zoneActive}>Siguiente</Button></div>
    </div>
  )
}
