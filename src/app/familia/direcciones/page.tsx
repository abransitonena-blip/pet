'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { motion, AnimatePresence } from 'framer-motion'
import { auth } from '@/firebase/config'
import { db } from '@/firebase/db'
import {
  collection, query, where, onSnapshot, updateDoc, deleteDoc, doc, limit,
} from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { MapPin, Plus, Pencil, Trash2, Star } from 'lucide-react'
import type { Address } from '@/types'
import { Button, Card, ConfirmDialog, EmptyState } from '@/components/ui'

// El formulario trae consigo el buscador de código postal y una escucha de las
// zonas activas. Nada de eso hace falta para mirar lo que ya está guardado.
const AddressFormModal = dynamic(() => import('@/components/family/AddressFormModal'), { ssr: false })

export default function DireccionesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnTo = searchParams.get('returnTo') === '/familia/nueva-reserva' ? '/familia/nueva-reserva' : null
  const [addresses, setAddresses] = useState<Address[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Address | null>(null)
  const [actionError, setActionError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) { router.push('/login'); return }
      const q = query(collection(db, 'addresses'), where('ownerId', '==', user.uid), limit(25))
      const unsub = onSnapshot(q, (snap) => {
        setAddresses(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Address)))
        setLoading(false)
      }, () => setLoading(false))
      return unsub
    })
    return unsubAuth
  }, [router])

  const openCreate = () => { setEditing(null); setFormOpen(true) }
  const openEdit = (addr: Address) => { setEditing(addr); setFormOpen(true) }

  const handleDelete = async (id: string) => {
    setDeleting(true)
    try {
      await deleteDoc(doc(db, 'addresses', id))
      setConfirmDelete(null)
    } catch (err) {
      const code = err && typeof err === 'object' && 'code' in err ? String((err as { code?: unknown }).code) : ''
      setActionError(code.includes('permission-denied')
        ? 'Tu sesión no tiene permiso para eliminar esta dirección.'
        : 'No pudimos eliminar la dirección. Intenta nuevamente.')
    }
    setDeleting(false)
  }

  const setDefault = async (id: string) => {
    const user = auth.currentUser
    if (!user) return
    // Unset all defaults
    for (const addr of addresses) {
      if (addr.isDefault && addr.id !== id) {
        await updateDoc(doc(db, 'addresses', addr.id), { isDefault: false })
      }
    }
    await updateDoc(doc(db, 'addresses', id), { isDefault: true })
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="skeleton h-10 w-48 rounded-xl" />
        {[1, 2, 3].map((i) => <div key={i} className="skeleton h-24 rounded-xl" />)}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Mis direcciones</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {addresses.length} dirección{addresses.length !== 1 ? 'es' : ''} guardada{addresses.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button size="sm" onClick={openCreate} leftIcon={<Plus size={12} />}>
          Agregar
        </Button>
      </div>

      {actionError && <p role="alert" className="rounded-xl bg-danger-500/10 px-4 py-3 text-sm text-red-700">{actionError}</p>}

      {addresses.length === 0 ? (
        <Card className="py-12">
          <EmptyState
            icon={<MapPin size={28} />}
            title="Aún no tienes direcciones guardadas"
            action={<Button size="sm" onClick={openCreate}>Agregar primera dirección</Button>}
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {addresses.map((addr) => (
            <motion.div
              key={addr.id}
              layout
              className="rounded-xl border border-ink/10 bg-surface p-4 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{addr.alias}</span>
                    {addr.isDefault && (
                      <span className="text-2xs px-2 py-0.5 rounded-full bg-brand-500/15 text-brand-600 font-medium flex items-center gap-1">
                        <Star size={8} /> Predeterminada
                      </span>
                    )}
                  </div>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {addr.street}{addr.exterior ? ` ${addr.exterior}` : ''}{addr.interior ? ` Int. ${addr.interior}` : ''}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {addr.colony}{addr.city ? `, ${addr.city}` : ''}{addr.zip ? ` CP ${addr.zip}` : ''}
                  </p>
                  {addr.references && (
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Ref: {addr.references}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!addr.isDefault && (
                    <button onClick={() => setDefault(addr.id)} className="h-11 w-11 rounded-lg flex items-center justify-center transition-colors hover:bg-brand-500/10 text-brand-600" title="Marcar como predeterminada" aria-label="Marcar como predeterminada">
                      <Star size={11} />
                    </button>
                  )}
                  <button onClick={() => openEdit(addr)} className="h-11 w-11 rounded-lg flex items-center justify-center transition-colors hover:bg-blue-500/10 text-blue-400" title="Editar" aria-label="Editar dirección">
                    <Pencil size={12} />
                  </button>
                  <button onClick={() => setConfirmDelete(addr.id)} className="h-11 w-11 rounded-lg flex items-center justify-center transition-colors hover:bg-danger-500/10 text-danger-400" title="Eliminar" aria-label="Eliminar dirección">
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Form Modal */}

      <AnimatePresence>
        {formOpen && (
          <AddressFormModal
            address={editing}
            isFirst={addresses.length === 0}
            onClose={() => setFormOpen(false)}
            onSaved={() => {
              setFormOpen(false)
              setEditing(null)
              if (returnTo) router.push(returnTo)
            }}
          />
        )}
      </AnimatePresence>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="¿Eliminar esta dirección?"
        confirmLabel="Eliminar"
        danger
        loading={deleting}
        icon={<Trash2 size={18} />}
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  )
}
