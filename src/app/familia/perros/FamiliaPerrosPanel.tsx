'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import {
  collection, query, where, onSnapshot, deleteDoc, doc, limit,
} from 'firebase/firestore'
import { auth } from '@/firebase/config'
import { db } from '@/firebase/db'
import { onAuthStateChanged } from 'firebase/auth'
import { motion, AnimatePresence } from 'framer-motion'
import { PawPrint, Plus, Pencil, Trash2, ArrowLeft, AlertTriangle } from 'lucide-react'
import { Pet } from '@/types'
import { Button, Card, EmptyState } from '@/components/ui'
import DogAvatar from '@/components/dogs/DogAvatar'
import { SIZE_OPTIONS } from '@/lib/petOptions'
import { useDogPhotos } from '@/lib/useDogPhotos'

// El formulario son trescientas líneas que sólo hacen falta al agregar o
// editar; la lista se abre sin ellas.
const DogFormModal = dynamic(() => import('@/components/family/DogFormModal'), { ssr: false })

/**
 * Mis perros: la lista.
 *
 * Cada tarjeta traía todo lo que se sabe de la mascota -- carácter, peso, notas,
 * alergias --, así que en un teléfono cabía una y media. Aquí queda lo que sirve
 * para reconocerla y lo que un paseador tiene que saber antes de salir; el resto
 * está en su perfil, a un toque.
 */
export default function MisPerrosPage() {
  const router = useRouter()
  const [pets, setPets] = useState<Pet[]>([])
  const photoUrls = useDogPhotos(pets.map((pet) => ({ id: pet.id, reference: pet.photoReference })))
  const [loading, setLoading] = useState(true)
  const [formPet, setFormPet] = useState<Pet | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    let unsubPets: (() => void) | undefined
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (unsubPets) { unsubPets(); unsubPets = undefined }
      if (!user) { router.push('/login'); return }
      const q = query(collection(db, 'dogs'), where('ownerId', '==', user.uid), limit(50))
      unsubPets = onSnapshot(q, (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Pet))
        docs.sort((a, b) => {
          const ca = (a as unknown as Record<string, unknown>).createdAt as { seconds?: number } | undefined
          const cb = (b as unknown as Record<string, unknown>).createdAt as { seconds?: number } | undefined
          return (cb?.seconds || 0) - (ca?.seconds || 0)
        })
        setPets(docs)
        setLoading(false)
      }, () => setLoading(false))
    })
    return () => { unsubPets?.(); unsubAuth() }
  }, [router])

  const openCreate = () => { setFormPet(null); setFormOpen(true) }
  const openEdit = (pet: Pet) => { setFormPet(pet); setFormOpen(true) }

  const handleDelete = async (petId: string) => {
    setDeleting(true)
    try {
      await deleteDoc(doc(db, 'dogs', petId))
      setConfirmDelete(null)
    } catch (err) {
      const code = err && typeof err === 'object' && 'code' in err ? String((err as { code?: unknown }).code) : ''
      setActionError(code.includes('permission-denied')
        ? 'Tu sesión no tiene permiso para eliminar esta mascota.'
        : 'No pudimos eliminar la mascota. Intenta nuevamente.')
    }
    setDeleting(false)
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="skeleton h-10 w-48 rounded-xl" />
        {[1, 2].map((i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/familia')}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-muted transition-colors hover:bg-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Volver al inicio de Familia PET"
          >
            <ArrowLeft size={16} aria-hidden="true" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-ink">Mis perros</h1>
            <p className="text-xs text-muted">
              {pets.length} mascota{pets.length !== 1 ? 's' : ''} registrada{pets.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <Button size="sm" onClick={openCreate} leftIcon={<Plus size={12} />}>
          Agregar
        </Button>
      </div>

      {actionError && <p role="alert" className="rounded-xl bg-danger-500/10 px-4 py-3 text-sm text-red-700">{actionError}</p>}

      {pets.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            icon={<PawPrint size={28} />}
            title="Aún no tienes mascotas registradas"
            description="Registra a tu peludo para agilizar tus reservas y guardar su información"
            action={<Button size="sm" onClick={openCreate} leftIcon={<Plus size={12} />}>Registrar primer mascota</Button>}
          />
        </Card>
      ) : (
        // El escalonado lo hace CSS: ver `.animate-enter-list` en globals.css.
        // Con framer-motion cada tarjeta traía un componente animado detrás.
        <ul className="animate-enter-list space-y-3">
          {pets.map((pet) => (
            <li
              key={pet.id}
              className="rounded-xl border border-ink/10 bg-surface p-4 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <DogAvatar name={pet.name} breed={pet.breed} photoUrl={photoUrls[pet.id] ?? ''} size={48} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        href={`/familia/perros/${encodeURIComponent(pet.id)}`}
                        className="rounded text-sm font-bold text-ink underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        {pet.name}
                      </Link>
                      {/* Sin raza ni tamaño, "Sin datos todavía" sólo constata el
                          hueco; mejor decir qué falta y para qué sirve. */}
                      <p className="mt-0.5 text-xs text-muted">
                        {[
                          pet.breed,
                          SIZE_OPTIONS.find((s) => s.value === pet.size)?.label,
                          pet.age,
                          pet.sex === 'macho' ? 'Macho' : pet.sex === 'hembra' ? 'Hembra' : '',
                        ].filter(Boolean).join(' · ')
                          || 'Agrega su raza y tamaño para que el paseador sepa a quién va a pasear'}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button onClick={() => openEdit(pet)} className="flex h-11 w-11 items-center justify-center rounded-lg text-muted transition-colors hover:bg-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label={`Editar ${pet.name}`}>
                        <Pencil size={14} aria-hidden="true" />
                      </button>
                      <button onClick={() => setConfirmDelete(pet.id)} className="flex h-11 w-11 items-center justify-center rounded-lg text-muted transition-colors hover:bg-danger-500/10 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-500" aria-label={`Eliminar ${pet.name}`}>
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  {/* Lo único del expediente que cambia lo que alguien hace hoy. */}
                  {pet.health?.allergies && pet.health.allergies.length > 0 && (
                    <p className="mt-2 flex items-start gap-1.5 text-xs text-red-700">
                      <AlertTriangle size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
                      <span>Alergias: {pet.health.allergies.join(', ')}</span>
                    </p>
                  )}

                  <Link
                    href={`/familia/perros/${encodeURIComponent(pet.id)}`}
                    className="mt-2 inline-flex min-h-11 items-center text-xs font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    Ver su perfil y sus paseos
                  </Link>
                </div>
              </div>

              <AnimatePresence>
                {confirmDelete === pet.id && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="mt-3 flex items-center justify-between border-t border-ink/10 pt-3">
                      <p className="text-xs text-muted">¿Eliminar a {pet.name}?</p>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(null)} disabled={deleting}>Cancelar</Button>
                        <Button size="sm" variant="danger" onClick={() => handleDelete(pet.id)} isLoading={deleting}>Eliminar</Button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </li>
          ))}
        </ul>
      )}

      <AnimatePresence>
        {formOpen && <DogFormModal pet={formPet} onClose={() => setFormOpen(false)} />}
      </AnimatePresence>
    </div>
  )
}
