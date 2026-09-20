'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, MapPinned, Navigation, Pill, Stethoscope, Syringe } from 'lucide-react'
import { VACCINE_STATUS_LABELS, type VaccineStatus } from '@/lib/dogHealth'
import DogAvatar from '@/components/dogs/DogAvatar'
import { ZONE_SPOT_LABELS } from '@/lib/zoneMatching'
import type { ZoneSpot } from '@/types'

/**
 * Lo que el paseador necesita saber antes de salir.
 *
 * Los datos vienen de /api/walker/walk-sheet, que confirma en el servidor que
 * el paseo es suyo. El paseador no lee la colección de perros ni la dirección
 * de la familia: solo llegan los cuidados del perro y los lugares de la zona.
 */

interface DogSheet {
  name: string
  breed: string
  size: string
  sex: string
  age: string
  weight: string
  energyLevel: string
  temperament: string[]
  allergies: string[]
  medications: string[]
  specialNeeds: string
  vetName: string
  vetPhone: string
  vaccines: { name: string; date: string; nextDue: string; status: VaccineStatus }[]
  /** Enlace temporal a la foto, o '' si la familia no ha subido una. */
  photoUrl: string
}

interface WalkSheetData {
  dogs: DogSheet[]
  zone: { name: string; spots: ZoneSpot[] } | null
  /** A dónde llegar por el perro. Sólo mientras el paseo sigue en pie. */
  pickup: { line: string; references: string; instructions: string; query: string } | null
}

const ENERGY_LABELS: Record<string, string> = { bajo: 'Tranquilo', medio: 'Activo', alto: 'Muy activo' }
const SIZE_LABELS: Record<string, string> = { 'pequeño': 'Pequeño', pequeno: 'Pequeño', mediano: 'Mediano', grande: 'Grande' }
const SEX_LABELS: Record<string, string> = { macho: 'Macho', hembra: 'Hembra' }

export default function WalkSheet({ sessionId, today }: { sessionId: string; today: string }) {
  const [data, setData] = useState<WalkSheetData | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'unavailable'>('loading')

  const load = useCallback(async () => {
    setState('loading')
    try {
      const { auth } = await import('@/firebase/config')
      const idToken = await auth.currentUser?.getIdToken()
      if (!idToken) throw new Error('auth-required')
      const response = await fetch('/api/walker/walk-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ sessionId, today }),
      })
      const result = await response.json().catch(() => ({})) as {
        code?: string
        dogs?: DogSheet[]
        zone?: WalkSheetData['zone']
        pickup?: WalkSheetData['pickup']
      }
      if (!response.ok) {
        setState(result.code === 'privileged-identity-not-configured' ? 'unavailable' : 'error')
        return
      }
      setData({ dogs: result.dogs ?? [], zone: result.zone ?? null, pickup: result.pickup ?? null })
      setState('ready')
    } catch {
      setState('error')
    }
  }, [sessionId, today])

  useEffect(() => { void load() }, [load])

  if (state === 'loading') {
    return <p className="text-xs text-muted">Consultando la ficha del paseo…</p>
  }

  if (state === 'unavailable') {
    return <p className="text-xs text-muted">La ficha solo está disponible en la app publicada.</p>
  }

  if (state === 'error' || !data) {
    return (
      <p className="text-xs text-muted">
        No pudimos cargar la ficha.{' '}
        <button type="button" onClick={() => void load()} className="font-semibold text-primary underline-offset-2 hover:underline">
          Reintentar
        </button>
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {data.dogs.map((dog, index) => {
        const facts = [
          dog.breed,
          SIZE_LABELS[dog.size] ?? dog.size,
          SEX_LABELS[dog.sex],
          dog.age,
          dog.weight,
          ENERGY_LABELS[dog.energyLevel],
        ].filter(Boolean).join(' · ')
        const overdue = dog.vaccines.filter((vaccine) => vaccine.status === 'vencida')

        return (
          <div key={`${dog.name}-${index}`} className="space-y-2 rounded-xl bg-ink/[0.03] p-3">
            {/* La foto es para reconocer al perro en la puerta; sin foto queda su
                marca teñida, la misma que ve la familia. */}
            <div className="flex items-center gap-3">
              <DogAvatar name={dog.name} breed={dog.breed} photoUrl={dog.photoUrl} size={44} />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">{dog.name}</p>
                {facts && <p className="text-xs text-muted">{facts}</p>}
              </div>
            </div>

            {dog.allergies.length > 0 && (
              <p className="flex items-start gap-2 rounded-lg bg-danger-500/10 px-2 py-1.5 text-xs text-red-700">
                <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
                Alergias: {dog.allergies.join(', ')}
              </p>
            )}
            {dog.medications.length > 0 && (
              <p className="flex items-start gap-2 rounded-lg bg-warning/10 px-2 py-1.5 text-xs text-amber-900">
                <Pill size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
                Medicamento: {dog.medications.join(', ')}
              </p>
            )}
            {dog.specialNeeds && (
              <p className="text-xs text-ink">Cuidados especiales: {dog.specialNeeds}</p>
            )}
            {dog.temperament.length > 0 && (
              <p className="text-xs text-muted">Carácter: {dog.temperament.join(', ')}</p>
            )}
            {overdue.length > 0 && (
              <p className="flex items-start gap-2 text-xs text-amber-900">
                <Syringe size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
                {VACCINE_STATUS_LABELS.vencida}: {overdue.map((vaccine) => vaccine.name).join(', ')}
              </p>
            )}
            {dog.vetName && (
              <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                <Stethoscope size={13} aria-hidden="true" /> {dog.vetName}
                {dog.vetPhone && (
                  <a href={`tel:${dog.vetPhone.replace(/[^\d+]/g, '')}`} className="font-semibold text-primary">
                    {dog.vetPhone}
                  </a>
                )}
              </p>
            )}
          </div>
        )
      })}

      {/* A dónde llegar. Antes no viajaba, y el paseador tenía que pedir la
          dirección por chat en cada paseo. */}
      {data.pickup && (
        <div className="space-y-1.5 rounded-xl border border-primary/20 bg-primary/[0.06] p-3">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            <Navigation size={14} aria-hidden="true" /> Dónde recoger
          </p>
          <p className="text-sm text-ink">{data.pickup.line}</p>
          {data.pickup.references && <p className="text-xs text-muted">Referencias: {data.pickup.references}</p>}
          {data.pickup.instructions && <p className="text-xs text-muted">Para entrar: {data.pickup.instructions}</p>}
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(data.pickup.query)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary/10 px-3 text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Navigation size={15} aria-hidden="true" /> Abrir en Google Maps
          </a>
        </div>
      )}

      {data.zone && data.zone.spots.length > 0 && (
        <div className="space-y-1.5 rounded-xl bg-ink/[0.03] p-3">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            <MapPinned size={14} aria-hidden="true" /> Dónde pasear en {data.zone.name}
          </p>
          <ul className="space-y-1">
            {data.zone.spots.map((spot) => (
              <li key={spot.id} className="text-xs">
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${spot.lat},${spot.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`font-medium underline-offset-2 hover:underline ${spot.kind === 'evitar' ? 'text-red-700' : 'text-primary'}`}
                >
                  {spot.name}
                </a>
                <span className="text-muted"> · {ZONE_SPOT_LABELS[spot.kind]}{spot.note ? ` · ${spot.note}` : ''}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.dogs.length === 0 && !data.zone && !data.pickup && (
        <p className="text-xs text-muted">Este paseo todavía no tiene ficha: falta el perro o la zona de la dirección.</p>
      )}
    </div>
  )
}
