'use client'

import { useState, useMemo } from 'react'
import { Search, PawPrint, Dog } from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import LoadingState from '@/components/ui/LoadingState'
import EmptyState from '@/components/ui/EmptyState'
import ErrorState from '@/components/ui/ErrorState'
import Card from '@/components/ui/Card'
import { useCanonicalDirectory, type DirectoryCustomer, type DirectoryDog } from '@/lib/useCanonicalDirectory'
import { useCanonicalReservations } from '@/lib/useCanonicalReservations'
import { canonicalReadErrorMessage } from '@/lib/useCanonicalWalkSessions'
import type { CanonicalReservationView } from '@/lib/useCanonicalReservations'

/**
 * Every dog registered by a family, not only the ones that already have a walk.
 *
 * This page used to build its list from the legacy `reservations` collection,
 * so a dog only appeared once it had been booked -- and since nothing writes
 * to that collection anymore, in practice a single leftover dog was visible.
 * The roster now comes from `dogs`; walk history is layered on from the
 * canonical sessions, and a dog with no walks shows as exactly that.
 */

// The family form stores "pequeño" with the ñ; older records may not have it.
const SIZE_LABELS: Record<string, string> = {
  'pequeño': 'Pequeño',
  pequeno: 'Pequeño',
  mediano: 'Mediano',
  grande: 'Grande',
}

interface PetRow {
  dog: DirectoryDog
  owner: DirectoryCustomer | null
  sessions: CanonicalReservationView[]
  lastVisit: string
  services: string[]
}

export default function AdminPerrosPage() {
  const { customers, dogs, loading, error, retry } = useCanonicalDirectory()
  const { reservations, loading: sessionsLoading } = useCanonicalReservations({ max: 300 })
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDogId, setSelectedDogId] = useState<string | null>(null)

  const pets = useMemo<PetRow[]>(() => {
    const ownersByUid = new Map(customers.map((customer) => [customer.uid, customer]))
    const sessionsByDog = new Map<string, CanonicalReservationView[]>()
    reservations.forEach((session) => {
      session.dogIds.forEach((dogId) => {
        const bucket = sessionsByDog.get(dogId)
        if (bucket) bucket.push(session)
        else sessionsByDog.set(dogId, [session])
      })
    })

    return dogs
      .map((dog) => {
        const sessions = sessionsByDog.get(dog.id) ?? []
        return {
          dog,
          owner: ownersByUid.get(dog.ownerId) ?? null,
          sessions,
          lastVisit: sessions.reduce((latest, session) => (session.date > latest ? session.date : latest), ''),
          services: Array.from(new Set(sessions.map((session) => session.service).filter(Boolean))),
        }
      })
      .sort((a, b) => b.sessions.length - a.sessions.length || a.dog.name.localeCompare(b.dog.name))
  }, [customers, dogs, reservations])

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return pets
    const needle = searchQuery.toLowerCase()
    return pets.filter((row) =>
      row.dog.name.toLowerCase().includes(needle)
      || row.dog.breed.toLowerCase().includes(needle)
      || (row.owner?.name ?? '').toLowerCase().includes(needle)
      || (row.owner?.phone ?? '').includes(needle))
  }, [pets, searchQuery])

  const withWalks = pets.filter((row) => row.sessions.length > 0).length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Perros registrados"
        description={`${pets.length} perros en el directorio · ${withWalks} con paseos registrados`}
      />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={12} style={{ color: 'var(--text-muted)' }} />
        <input
          type="text"
          placeholder="Buscar por perro, raza, dueño o teléfono…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input-field pl-9"
          aria-label="Buscar perro"
        />
      </div>

      {error ? (
        <Card className="p-4 shadow-none">
          <ErrorState description={canonicalReadErrorMessage(error)} onRetry={retry} />
        </Card>
      ) : loading || sessionsLoading ? (
        <LoadingState rows={4} height="h-20" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<PawPrint size={24} />}
          title={searchQuery ? 'Sin resultados' : 'Todavía no hay perros registrados'}
          description={searchQuery ? undefined : 'Los perros aparecen aquí en cuanto una familia los da de alta en su cuenta.'}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {filtered.map((row) => {
            const isOpen = selectedDogId === row.dog.id
            const details = [row.dog.breed, SIZE_LABELS[row.dog.size] ?? row.dog.size].filter(Boolean).join(' · ')

            return (
              <div
                key={row.dog.id}
                className="cursor-pointer rounded-xl border border-ink/10 bg-surface p-4 shadow-sm transition-colors hover:bg-ink/5"
                onClick={() => setSelectedDogId(isOpen ? null : row.dog.id)}
              >
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: 'var(--bg-elevated)' }}>
                    <Dog size={18} style={{ color: 'var(--text-muted)' }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{row.dog.name}</span>
                      <span className="text-2xs rounded-full px-2 py-0.5" style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
                        {row.dog.petType}
                      </span>
                    </div>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{details || 'Sin raza ni tamaño capturados'}</p>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                      <span>{row.owner ? row.owner.name : 'Dueño no encontrado'}</span>
                      {row.owner?.phone && <span>{row.owner.phone}</span>}
                      <span>{row.sessions.length === 0 ? 'Sin paseos' : `${row.sessions.length} paseos`}</span>
                      {row.lastVisit && <span>Último: {row.lastVisit}</span>}
                    </div>
                    {row.services.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {row.services.map((service) => (
                          <span key={service} className="text-2xs rounded-full bg-brand-500/10 px-2 py-0.5 text-brand-400">{service}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {isOpen && (
                  <div className="mt-3 border-t border-ink/10 pt-3">
                    <p className="mb-2 text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Historial de paseos</p>
                    {row.sessions.length === 0 ? (
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Este perro todavía no tiene paseos registrados.</p>
                    ) : (
                      <div className="max-h-40 space-y-1.5 overflow-y-auto">
                        {row.sessions.map((session) => (
                          <div key={session.id} className="flex items-center justify-between rounded-lg px-2 py-1 text-xs" style={{ background: 'var(--bg-elevated)' }}>
                            <div className="flex items-center gap-2">
                              <span className={`h-1.5 w-1.5 rounded-full ${session.status === 'completed' ? 'bg-success-500' : session.status === 'in_progress' || session.status === 'on_the_way' ? 'bg-blue-500' : 'bg-brand-500'}`} />
                              <span style={{ color: 'var(--text-muted)' }}>{session.date} {session.time}</span>
                              <span style={{ color: 'var(--text-primary)' }}>{session.service}</span>
                            </div>
                            {session.walkerName && <span className="text-2xs" style={{ color: 'var(--text-muted)' }}>{session.walkerName}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
