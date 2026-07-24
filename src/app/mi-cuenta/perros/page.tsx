'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp,
} from 'firebase/firestore'
import { auth, db } from '@/firebase/config'
import { onAuthStateChanged } from 'firebase/auth'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FaPaw, FaPlus, FaEdit, FaTrash, FaArrowLeft, FaDog, FaCat, FaHeart,
  FaWeight, FaRulerVertical, FaStickyNote, FaTimes, FaCheck, FaSpinner,
} from 'react-icons/fa'

interface Pet {
  id: string
  ownerId: string
  name: string
  breed: string
  size: 'pequeño' | 'mediano' | 'grande'
  age: string
  weight: string
  petType: 'perro' | 'gato' | 'otro'
  notes: string
  createdAt: unknown
}

const EMPTY_PET = {
  name: '',
  breed: '',
  size: 'mediano' as const,
  age: '',
  weight: '',
  petType: 'perro' as const,
  notes: '',
}

const SIZE_OPTIONS = [
  { value: 'pequeño', label: 'Pequeño', desc: '< 10 kg', emoji: '🐕' },
  { value: 'mediano', label: 'Mediano', desc: '10-25 kg', emoji: '🐕‍🦺' },
  { value: 'grande', label: 'Grande', desc: '> 25 kg', emoji: '🦮' },
]

const PET_TYPE_OPTIONS = [
  { value: 'perro', label: 'Perro', emoji: '🐕' },
  { value: 'gato', label: 'Gato', emoji: '🐈' },
  { value: 'otro', label: 'Otro', emoji: '🐾' },
]

export default function MisPerrosPage() {
  const router = useRouter()
  const [pets, setPets] = useState<Pet[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingPet, setEditingPet] = useState<Pet | null>(null)
  const [form, setForm] = useState(EMPTY_PET)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  useEffect(() => {
    let unsubPets: (() => void) | undefined

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (unsubPets) { unsubPets(); unsubPets = undefined }
      if (!user) { router.push('/login'); return }

      const q = query(collection(db, 'pets'), where('ownerId', '==', user.uid))
      unsubPets = onSnapshot(q, (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Pet))
        docs.sort((a, b) => {
          const ca = a.createdAt as { seconds?: number } | undefined
          const cb = b.createdAt as { seconds?: number } | undefined
          return (cb?.seconds || 0) - (ca?.seconds || 0)
        })
        setPets(docs)
        setLoading(false)
      }, () => setLoading(false))
    })
    return () => { unsubPets?.(); unsubAuth() }
  }, [router])

  const openCreate = () => {
    setEditingPet(null)
    setForm(EMPTY_PET)
    setErrors({})
    setShowForm(true)
  }

  const openEdit = (pet: Pet) => {
    setEditingPet(pet)
    setForm({
      name: pet.name,
      breed: pet.breed,
      size: pet.size,
      age: pet.age,
      weight: pet.weight,
      petType: pet.petType,
      notes: pet.notes,
    })
    setErrors({})
    setShowForm(true)
  }

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Escribe el nombre de tu mascota'
    if (!form.breed.trim()) e.breed = 'Escribe la raza'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    const user = auth.currentUser
    if (!user) return

    setSaving(true)
    try {
      if (editingPet) {
        await updateDoc(doc(db, 'pets', editingPet.id), {
          name: form.name.trim(),
          breed: form.breed.trim(),
          size: form.size,
          age: form.age.trim(),
          weight: form.weight.trim(),
          petType: form.petType,
          notes: form.notes.trim(),
        })
      } else {
        await addDoc(collection(db, 'pets'), {
          ownerId: user.uid,
          name: form.name.trim(),
          breed: form.breed.trim(),
          size: form.size,
          age: form.age.trim(),
          weight: form.weight.trim(),
          petType: form.petType,
          notes: form.notes.trim(),
          createdAt: serverTimestamp(),
        })
      }
      setShowForm(false)
      setEditingPet(null)
      setForm(EMPTY_PET)
    } catch (err) {
      console.error('Error saving pet:', err)
    }
    setSaving(false)
  }

  const handleDelete = async (petId: string) => {
    await deleteDoc(doc(db, 'pets', petId))
    setConfirmDelete(null)
  }

  const set = <K extends keyof typeof form>(key: K, val: (typeof form)[K]) => {
    setForm((p) => ({ ...p, [key]: val }))
    if (errors[key]) setErrors((p) => { const n = { ...p }; delete n[key]; return n })
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="skeleton h-10 w-48 rounded-xl" />
        {[1, 2].map((i) => <div key={i} className="skeleton h-28 rounded-2xl" />)}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/mi-cuenta')}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/5"
            style={{ color: 'var(--text-muted)' }}
          >
            <FaArrowLeft size={14} />
          </button>
          <div>
            <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Mis perros</h1>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {pets.length} mascota{pets.length !== 1 ? 's' : ''} registrada{pets.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button onClick={openCreate} className="btn-primary text-xs inline-flex gap-2">
          <FaPlus size={12} /> Agregar
        </button>
      </div>

      {/* Pet List */}
      {pets.length === 0 ? (
        <div className="rounded-2xl p-8 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <FaPaw className="text-4xl mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Aún no tienes mascotas registradas</p>
          <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
            Registra a tu peludo para agilizar tus reservas
          </p>
          <button onClick={openCreate} className="btn-primary text-xs inline-flex gap-2">
            <FaPlus size={12} /> Registrar primer mascota
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {pets.map((pet, i) => (
            <motion.div
              key={pet.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-2xl p-4"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl bg-brand-500/10 flex items-center justify-center shrink-0 text-xl">
                  {pet.petType === 'perro' ? '🐕' : pet.petType === 'gato' ? '🐈' : '🐾'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{pet.name}</p>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(pet)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-white/5"
                        style={{ color: 'var(--text-muted)' }}
                        aria-label={`Editar ${pet.name}`}
                      >
                        <FaEdit size={12} />
                      </button>
                      <button
                        onClick={() => setConfirmDelete(pet.id)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-danger-500/10 hover:text-danger-400"
                        style={{ color: 'var(--text-muted)' }}
                        aria-label={`Eliminar ${pet.name}`}
                      >
                        <FaTrash size={12} />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {pet.breed} · {SIZE_OPTIONS.find((s) => s.value === pet.size)?.label}
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {pet.age && (
                      <span className="flex items-center gap-1">
                        <FaRulerVertical size={10} className="text-brand-400" /> {pet.age}
                      </span>
                    )}
                    {pet.weight && (
                      <span className="flex items-center gap-1">
                        <FaWeight size={10} className="text-success-400" /> {pet.weight}
                      </span>
                    )}
                  </div>
                  {pet.notes && (
                    <div className="mt-2 flex items-start gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                      <FaStickyNote size={10} className="mt-0.5 shrink-0 text-pink-400" />
                      <span>{pet.notes}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Delete Confirmation */}
              <AnimatePresence>
                {confirmDelete === pet.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 pt-3 flex items-center justify-between" style={{ borderTop: '1px solid var(--border)' }}>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>¿Eliminar a {pet.name}?</p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="text-xs px-3 py-1.5 rounded-lg transition-colors hover:bg-white/5"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => handleDelete(pet.id)}
                          className="text-xs px-3 py-1.5 rounded-lg bg-danger-500/10 text-danger-400 transition-colors hover:bg-danger-500/20"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
            onClick={() => setShowForm(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-md rounded-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                  {editingPet ? `Editar ${editingPet.name}` : 'Nueva mascota'}
                </h2>
                <button
                  onClick={() => setShowForm(false)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/5"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <FaTimes size={14} />
                </button>
              </div>

              {/* Pet Type */}
              <div>
                <label className="text-xs font-medium mb-2 block" style={{ color: 'var(--text-secondary)' }}>Tipo</label>
                <div className="grid grid-cols-3 gap-2">
                  {PET_TYPE_OPTIONS.map((pt) => (
                    <button
                      key={pt.value}
                      type="button"
                      onClick={() => set('petType', pt.value as typeof form.petType)}
                      className="flex flex-col items-center gap-1 py-3 rounded-xl border text-xs font-medium transition-all"
                      style={{
                        background: form.petType === pt.value ? 'var(--color-primary-light)' : 'var(--glass-bg)',
                        borderColor: form.petType === pt.value ? 'var(--color-primary)' : 'var(--border)',
                        color: form.petType === pt.value ? 'var(--color-primary)' : 'var(--text-secondary)',
                      }}
                    >
                      <span className="text-lg">{pt.emoji}</span>
                      {pt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
                  Nombre <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  placeholder="Ej: Max, Luna, Toby..."
                  className="w-full px-4 py-2.5 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-primary/30"
                  style={{
                    background: 'var(--glass-bg)',
                    borderColor: errors.name ? 'var(--color-error)' : 'var(--border)',
                    color: 'var(--text-primary)',
                  }}
                />
                {errors.name && (
                  <p className="text-xs mt-1" style={{ color: 'var(--color-danger)' }}>{errors.name}</p>
                )}
              </div>

              {/* Breed */}
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
                  Raza <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <input
                  type="text"
                  value={form.breed}
                  onChange={(e) => set('breed', e.target.value)}
                  placeholder="Ej: Labrador, Mestizo, Pastor Alemán..."
                  className="w-full px-4 py-2.5 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-primary/30"
                  style={{
                    background: 'var(--glass-bg)',
                    borderColor: errors.breed ? 'var(--color-error)' : 'var(--border)',
                    color: 'var(--text-primary)',
                  }}
                />
                {errors.breed && (
                  <p className="text-xs mt-1" style={{ color: 'var(--color-danger)' }}>{errors.breed}</p>
                )}
              </div>

              {/* Size */}
              <div>
                <label className="text-xs font-medium mb-2 block" style={{ color: 'var(--text-secondary)' }}>Tamaño</label>
                <div className="grid grid-cols-3 gap-2">
                  {SIZE_OPTIONS.map((sz) => (
                    <button
                      key={sz.value}
                      type="button"
                      onClick={() => set('size', sz.value as typeof form.size)}
                      className="flex flex-col items-center gap-1 py-3 rounded-xl border text-xs font-medium transition-all"
                      style={{
                        background: form.size === sz.value ? 'var(--color-primary-light)' : 'var(--glass-bg)',
                        borderColor: form.size === sz.value ? 'var(--color-primary)' : 'var(--border)',
                        color: form.size === sz.value ? 'var(--color-primary)' : 'var(--text-secondary)',
                      }}
                    >
                      <span className="text-lg">{sz.emoji}</span>
                      {sz.label}
                      <span className="text-2xs" style={{ color: 'var(--text-muted)' }}>{sz.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Age & Weight */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Edad</label>
                  <input
                    type="text"
                    value={form.age}
                    onChange={(e) => set('age', e.target.value)}
                    placeholder="Ej: 2 años"
                    className="w-full px-4 py-2.5 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-primary/30"
                    style={{ background: 'var(--glass-bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Peso</label>
                  <input
                    type="text"
                    value={form.weight}
                    onChange={(e) => set('weight', e.target.value)}
                    placeholder="Ej: 15 kg"
                    className="w-full px-4 py-2.5 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-primary/30"
                    style={{ background: 'var(--glass-bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
                  Notas especiales <span className="font-normal" style={{ color: 'var(--text-muted)' }}>(opcional)</span>
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => set('notes', e.target.value)}
                  rows={2}
                  placeholder="Ej: Alergia al pollo, nervioso con perros grandes..."
                  className="w-full px-4 py-2.5 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                  style={{ background: 'var(--glass-bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors hover:bg-white/5"
                  style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white transition-all btn-primary inline-flex items-center justify-center gap-2"
                >
                  {saving ? <FaSpinner className="animate-spin" size={14} /> : <FaCheck size={14} />}
                  {editingPet ? 'Guardar cambios' : 'Agregar mascota'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
