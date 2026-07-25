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
  FaPaw, FaPlus, FaEdit, FaTrash, FaArrowLeft, FaTimes, FaCheck, FaSpinner,
  FaHeart, FaBrain, FaFirstAid, FaSlidersH, FaDog, FaCat,
  FaWeight, FaRulerVertical, FaVenus, FaMars,
  FaBolt, FaShieldAlt, FaSyringe, FaPhone, FaMedkit, FaExclamationTriangle,
  FaStar, FaPuzzlePiece, FaCommentDots,
} from 'react-icons/fa'
import { Pet } from '@/types'

type PetTab = 'basico' | 'personalidad' | 'salud' | 'preferencias'

const EMPTY_FORM = {
  name: '',
  breed: '',
  size: 'mediano' as 'pequeño' | 'mediano' | 'grande',
  sex: '' as 'macho' | 'hembra' | '',
  age: '',
  weight: '',
  petType: 'perro' as const,
  notes: '',
  personality: {
    energyLevel: 'medio' as 'bajo' | 'medio' | 'alto',
    temperament: [] as string[],
  },
  health: {
    allergies: [] as string[],
    medications: [] as string[],
    vaccines: [] as { name: string; date: string; nextDue?: string }[],
    vetName: '',
    vetPhone: '',
  },
  preferences: {
    favoriteToys: [] as string[],
    commands: [] as string[],
    specialNeeds: '',
  },
}

type PetForm = typeof EMPTY_FORM

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

const ENERGY_OPTIONS = [
  { value: 'bajo', label: 'Tranquilo', emoji: '😴', desc: 'Prefiere paseos cortos' },
  { value: 'medio', label: 'Activo', emoji: '🚶', desc: 'Paseos regulares' },
  { value: 'alto', label: 'Muy activo', emoji: '🏃', desc: 'Necesita mucho ejercicio' },
]

const TEMPERAMENT_TAGS = [
  'Amigable', 'Juguetón', 'Tranquilo', 'Nervioso', 'Sociable',
  'Tímido', 'Protector', 'Independiente', 'Apegado', 'Obediente',
]

const VACCINE_PRESETS = ['Rabia', 'Moquillo', 'Parvovirus', 'Leptospirosis', 'Bordetella', 'Leishmania']

const TABS: { key: PetTab; label: string; icon: typeof FaPaw }[] = [
  { key: 'basico', label: 'Básico', icon: FaPaw },
  { key: 'personalidad', label: 'Personalidad', icon: FaBrain },
  { key: 'salud', label: 'Salud', icon: FaFirstAid },
  { key: 'preferencias', label: 'Preferencias', icon: FaSlidersH },
]

function ChipInput({ items, onChange, placeholder, color }: {
  items: string[]
  onChange: (items: string[]) => void
  placeholder: string
  color?: string
}) {
  const [value, setValue] = useState('')
  const add = () => {
    const v = value.trim()
    if (v && !items.includes(v)) { onChange([...items, v]); setValue('') }
  }
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i))
  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {items.map((item, i) => (
          <span key={i} className="inline-flex items-center gap-1 text-2xs px-2 py-1 rounded-full" style={{ background: color || 'var(--color-primary-light)', color: 'var(--text-primary)' }}>
            {item}
            <button type="button" onClick={() => remove(i)} className="ml-0.5 opacity-60 hover:opacity-100">✕</button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          placeholder={placeholder}
          className="flex-1 px-3 py-2 rounded-xl text-xs border transition-all focus:outline-none focus:ring-2 focus:ring-primary/30"
          style={{ background: 'var(--glass-bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
        />
        <button type="button" onClick={add} className="px-3 py-2 rounded-xl text-xs font-medium transition-colors hover:bg-white/5" style={{ color: 'var(--color-primary)', border: '1px solid var(--border)' }}>
          + Agregar
        </button>
      </div>
    </div>
  )
}

export default function MisPerrosPage() {
  const router = useRouter()
  const [pets, setPets] = useState<Pet[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingPet, setEditingPet] = useState<Pet | null>(null)
  const [form, setForm] = useState<PetForm>(EMPTY_FORM)
  const [activeTab, setActiveTab] = useState<PetTab>('basico')
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

  const openCreate = () => {
    setEditingPet(null)
    setForm(EMPTY_FORM)
    setActiveTab('basico')
    setErrors({})
    setShowForm(true)
  }

  const openEdit = (pet: Pet) => {
    setEditingPet(pet)
    setForm({
      name: pet.name,
      breed: pet.breed,
      size: pet.size,
      sex: pet.sex || '',
      age: String(pet.age || ''),
      weight: String(pet.weight || ''),
      petType: pet.petType,
      notes: pet.notes || '',
      personality: pet.personality || { energyLevel: 'medio', temperament: [] },
      health: pet.health || { allergies: [], medications: [], vaccines: [], vetName: '', vetPhone: '' },
      preferences: pet.preferences || { favoriteToys: [], commands: [], specialNeeds: '' },
    })
    setActiveTab('basico')
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
      const data = {
        name: form.name.trim(),
        breed: form.breed.trim(),
        size: form.size,
        sex: form.sex || undefined,
        age: form.age.trim(),
        weight: form.weight.trim(),
        petType: form.petType,
        notes: form.notes.trim(),
        personality: {
          energyLevel: form.personality.energyLevel,
          temperament: form.personality.temperament,
        },
        health: {
          allergies: form.health.allergies,
          medications: form.health.medications,
          vaccines: form.health.vaccines,
          vetName: form.health.vetName.trim(),
          vetPhone: form.health.vetPhone.trim(),
        },
        preferences: {
          favoriteToys: form.preferences.favoriteToys,
          commands: form.preferences.commands,
          specialNeeds: form.preferences.specialNeeds.trim(),
        },
      }

      if (editingPet) {
        await updateDoc(doc(db, 'pets', editingPet.id), data)
      } else {
        await addDoc(collection(db, 'pets'), {
          ...data,
          ownerId: user.uid,
          createdAt: serverTimestamp(),
        })
      }
      setShowForm(false)
      setEditingPet(null)
      setForm(EMPTY_FORM)
    } catch (err) {
      console.error('Error saving pet:', err)
    }
    setSaving(false)
  }

  const handleDelete = async (petId: string) => {
    await deleteDoc(doc(db, 'pets', petId))
    setConfirmDelete(null)
  }

  const setField = <K extends keyof PetForm>(key: K, val: PetForm[K]) => {
    setForm((p) => ({ ...p, [key]: val }))
    if (errors[key]) setErrors((p) => { const n = { ...p }; delete n[key]; return n })
  }

  const toggleTemperament = (tag: string) => {
    setForm((p) => ({
      ...p,
      personality: {
        ...p.personality,
        temperament: p.personality.temperament.includes(tag)
          ? p.personality.temperament.filter((t) => t !== tag)
          : [...p.personality.temperament, tag],
      },
    }))
  }

  const addVaccine = () => {
    setForm((p) => ({
      ...p,
      health: { ...p.health, vaccines: [...p.health.vaccines, { name: '', date: '' }] },
    }))
  }

  const updateVaccine = (i: number, field: 'name' | 'date' | 'nextDue', val: string) => {
    setForm((p) => ({
      ...p,
      health: {
        ...p.health,
        vaccines: p.health.vaccines.map((v, idx) => idx === i ? { ...v, [field]: val } : v),
      },
    }))
  }

  const removeVaccine = (i: number) => {
    setForm((p) => ({
      ...p,
      health: { ...p.health, vaccines: p.health.vaccines.filter((_, idx) => idx !== i) },
    }))
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
          <button onClick={() => router.push('/mi-cuenta')} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/5" style={{ color: 'var(--text-muted)' }}>
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

      {pets.length === 0 ? (
        <div className="rounded-2xl p-8 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <FaPaw className="text-4xl mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Aún no tienes mascotas registradas</p>
          <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
            Registra a tu peludo para agilizar tus reservas y guardar su información
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
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{pet.name}</p>
                      {pet.sex && (
                        <span className="text-2xs" style={{ color: 'var(--text-muted)' }}>
                          {pet.sex === 'macho' ? '♂️' : '♀️'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(pet)} className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-white/5" style={{ color: 'var(--text-muted)' }} aria-label={`Editar ${pet.name}`}>
                        <FaEdit size={12} />
                      </button>
                      <button onClick={() => setConfirmDelete(pet.id)} className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-danger-500/10 hover:text-danger-400" style={{ color: 'var(--text-muted)' }} aria-label={`Eliminar ${pet.name}`}>
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
                  {pet.personality?.temperament && pet.personality.temperament.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {pet.personality.temperament.slice(0, 3).map((tag) => (
                        <span key={tag} className="text-2xs px-2 py-0.5 rounded-full" style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
                          {tag}
                        </span>
                      ))}
                      {pet.personality.temperament.length > 3 && (
                        <span className="text-2xs px-2 py-0.5 rounded-full" style={{ background: 'var(--glass-bg)', color: 'var(--text-muted)' }}>
                          +{pet.personality.temperament.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                  {pet.health?.allergies && pet.health.allergies.length > 0 && (
                    <div className="flex items-center gap-1 mt-2 text-2xs" style={{ color: 'var(--color-danger)' }}>
                      <FaExclamationTriangle size={9} />
                      <span>Alergias: {pet.health.allergies.join(', ')}</span>
                    </div>
                  )}
                  {pet.notes && (
                    <div className="mt-2 flex items-start gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                      <span className="mt-0.5 shrink-0">📝</span>
                      <span>{pet.notes}</span>
                    </div>
                  )}
                </div>
              </div>

              <AnimatePresence>
                {confirmDelete === pet.id && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="mt-3 pt-3 flex items-center justify-between" style={{ borderTop: '1px solid var(--border)' }}>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>¿Eliminar a {pet.name}?</p>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setConfirmDelete(null)} className="text-xs px-3 py-1.5 rounded-lg transition-colors hover:bg-white/5" style={{ color: 'var(--text-muted)' }}>Cancelar</button>
                        <button onClick={() => handleDelete(pet.id)} className="text-xs px-3 py-1.5 rounded-lg bg-danger-500/10 text-danger-400 transition-colors hover:bg-danger-500/20">Eliminar</button>
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
              className="w-full max-w-md rounded-2xl space-y-0 max-h-[88vh] overflow-hidden flex flex-col"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-5 pb-3">
                <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                  {editingPet ? `Editar ${editingPet.name}` : 'Nueva mascota'}
                </h2>
                <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/5" style={{ color: 'var(--text-muted)' }}>
                  <FaTimes size={14} />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex px-5 gap-1 overflow-x-auto scrollbar-hide">
                {TABS.map((tab) => {
                  const Icon = tab.icon
                  const isActive = activeTab === tab.key
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap"
                      style={{
                        background: isActive ? 'var(--color-primary-light)' : 'transparent',
                        color: isActive ? 'var(--color-primary)' : 'var(--text-muted)',
                      }}
                    >
                      <Icon size={12} /> {tab.label}
                    </button>
                  )
                })}
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                {activeTab === 'basico' && (
                  <>
                    {/* Pet Type */}
                    <div>
                      <label className="text-xs font-medium mb-2 block" style={{ color: 'var(--text-secondary)' }}>Tipo</label>
                      <div className="grid grid-cols-3 gap-2">
                        {PET_TYPE_OPTIONS.map((pt) => (
                          <button key={pt.value} type="button" onClick={() => setField('petType', pt.value as PetForm['petType'])} className="flex flex-col items-center gap-1 py-3 rounded-xl border text-xs font-medium transition-all" style={{ background: form.petType === pt.value ? 'var(--color-primary-light)' : 'var(--glass-bg)', borderColor: form.petType === pt.value ? 'var(--color-primary)' : 'var(--border)', color: form.petType === pt.value ? 'var(--color-primary)' : 'var(--text-secondary)' }}>
                            <span className="text-lg">{pt.emoji}</span> {pt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Name */}
                    <div>
                      <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
                        Nombre <span style={{ color: 'var(--color-danger)' }}>*</span>
                      </label>
                      <input type="text" value={form.name} onChange={(e) => setField('name', e.target.value)} placeholder="Ej: Max, Luna, Toby..." className="w-full px-4 py-2.5 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-primary/30" style={{ background: 'var(--glass-bg)', borderColor: errors.name ? 'var(--color-error)' : 'var(--border)', color: 'var(--text-primary)' }} />
                      {errors.name && <p className="text-xs mt-1" style={{ color: 'var(--color-danger)' }}>{errors.name}</p>}
                    </div>

                    {/* Breed */}
                    <div>
                      <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
                        Raza <span style={{ color: 'var(--color-danger)' }}>*</span>
                      </label>
                      <input type="text" value={form.breed} onChange={(e) => setField('breed', e.target.value)} placeholder="Ej: Labrador, Mestizo, Pastor Alemán..." className="w-full px-4 py-2.5 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-primary/30" style={{ background: 'var(--glass-bg)', borderColor: errors.breed ? 'var(--color-error)' : 'var(--border)', color: 'var(--text-primary)' }} />
                      {errors.breed && <p className="text-xs mt-1" style={{ color: 'var(--color-danger)' }}>{errors.breed}</p>}
                    </div>

                    {/* Size */}
                    <div>
                      <label className="text-xs font-medium mb-2 block" style={{ color: 'var(--text-secondary)' }}>Tamaño</label>
                      <div className="grid grid-cols-3 gap-2">
                        {SIZE_OPTIONS.map((sz) => (
                          <button key={sz.value} type="button" onClick={() => setField('size', sz.value as PetForm['size'])} className="flex flex-col items-center gap-1 py-3 rounded-xl border text-xs font-medium transition-all" style={{ background: form.size === sz.value ? 'var(--color-primary-light)' : 'var(--glass-bg)', borderColor: form.size === sz.value ? 'var(--color-primary)' : 'var(--border)', color: form.size === sz.value ? 'var(--color-primary)' : 'var(--text-secondary)' }}>
                            <span className="text-lg">{sz.emoji}</span> {sz.label}
                            <span className="text-2xs" style={{ color: 'var(--text-muted)' }}>{sz.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Sex */}
                    <div>
                      <label className="text-xs font-medium mb-2 block" style={{ color: 'var(--text-secondary)' }}>Sexo</label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { value: 'macho' as const, label: 'Macho', icon: FaMars, color: '#3b82f6' },
                          { value: 'hembra' as const, label: 'Hembra', icon: FaVenus, color: '#ec4899' },
                        ].map((opt) => {
                          const Icon = opt.icon
                          return (
                            <button key={opt.value} type="button" onClick={() => setField('sex', form.sex === opt.value ? '' : opt.value)} className="flex items-center justify-center gap-2 py-3 rounded-xl border text-xs font-medium transition-all" style={{ background: form.sex === opt.value ? `${opt.color}15` : 'var(--glass-bg)', borderColor: form.sex === opt.value ? opt.color : 'var(--border)', color: form.sex === opt.value ? opt.color : 'var(--text-secondary)' }}>
                              <Icon size={14} /> {opt.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Age & Weight */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Edad</label>
                        <input type="text" value={form.age} onChange={(e) => setField('age', e.target.value)} placeholder="Ej: 2 años" className="w-full px-4 py-2.5 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-primary/30" style={{ background: 'var(--glass-bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                      </div>
                      <div>
                        <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Peso</label>
                        <input type="text" value={form.weight} onChange={(e) => setField('weight', e.target.value)} placeholder="Ej: 15 kg" className="w-full px-4 py-2.5 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-primary/30" style={{ background: 'var(--glass-bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                      </div>
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
                        Notas <span className="font-normal" style={{ color: 'var(--text-muted)' }}>(opcional)</span>
                      </label>
                      <textarea value={form.notes} onChange={(e) => setField('notes', e.target.value)} rows={2} placeholder="Ej: Alergia al pollo, nervioso con perros grandes..." className="w-full px-4 py-2.5 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" style={{ background: 'var(--glass-bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                    </div>
                  </>
                )}

                {activeTab === 'personalidad' && (
                  <>
                    {/* Energy Level */}
                    <div>
                      <label className="text-xs font-medium mb-2 block" style={{ color: 'var(--text-secondary)' }}>Nivel de energía</label>
                      <div className="grid grid-cols-3 gap-2">
                        {ENERGY_OPTIONS.map((opt) => (
                          <button key={opt.value} type="button" onClick={() => setField('personality', { ...form.personality, energyLevel: opt.value as PetForm['personality']['energyLevel'] })} className="flex flex-col items-center gap-1 py-3 rounded-xl border text-xs font-medium transition-all" style={{ background: form.personality.energyLevel === opt.value ? 'var(--color-primary-light)' : 'var(--glass-bg)', borderColor: form.personality.energyLevel === opt.value ? 'var(--color-primary)' : 'var(--border)', color: form.personality.energyLevel === opt.value ? 'var(--color-primary)' : 'var(--text-secondary)' }}>
                            <span className="text-lg">{opt.emoji}</span>
                            {opt.label}
                            <span className="text-2xs" style={{ color: 'var(--text-muted)' }}>{opt.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Temperament */}
                    <div>
                      <label className="text-xs font-medium mb-2 block" style={{ color: 'var(--text-secondary)' }}>Temperamento</label>
                      <p className="text-2xs mb-3" style={{ color: 'var(--text-muted)' }}>Selecciona las que apliquen</p>
                      <div className="flex flex-wrap gap-2">
                        {TEMPERAMENT_TAGS.map((tag) => {
                          const selected = form.personality.temperament.includes(tag)
                          return (
                            <button key={tag} type="button" onClick={() => toggleTemperament(tag)} className="px-3 py-1.5 rounded-full text-xs font-medium border transition-all" style={{ background: selected ? 'var(--color-primary-light)' : 'var(--glass-bg)', borderColor: selected ? 'var(--color-primary)' : 'var(--border)', color: selected ? 'var(--color-primary)' : 'var(--text-secondary)' }}>
                              {selected && <FaCheck size={8} className="inline mr-1" />}
                              {tag}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </>
                )}

                {activeTab === 'salud' && (
                  <>
                    {/* Allergies */}
                    <div>
                      <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Alergias</label>
                      <ChipInput items={form.health.allergies} onChange={(val) => setField('health', { ...form.health, allergies: val })} placeholder="Ej: Pollo, polen..." color="rgba(220,38,38,0.15)" />
                    </div>

                    {/* Medications */}
                    <div>
                      <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Medicamentos</label>
                      <ChipInput items={form.health.medications} onChange={(val) => setField('health', { ...form.health, medications: val })} placeholder="Ej: Apoquel, Nexgard..." color="rgba(59,130,246,0.15)" />
                    </div>

                    {/* Vaccines */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Vacunas</label>
                        <button type="button" onClick={addVaccine} className="text-2xs font-medium flex items-center gap-1 transition-colors hover:opacity-80" style={{ color: 'var(--color-primary)' }}>
                          <FaPlus size={8} /> Agregar
                        </button>
                      </div>
                      {/* Presets */}
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {VACCINE_PRESETS.map((v) => {
                          const exists = form.health.vaccines.some((vv) => vv.name === v)
                          return (
                            <button key={v} type="button" disabled={exists} onClick={() => setForm((p) => ({ ...p, health: { ...p.health, vaccines: [...p.health.vaccines, { name: v, date: '' }] } }))} className="text-2xs px-2 py-1 rounded-full border transition-all disabled:opacity-30" style={{ borderColor: 'var(--border)', color: exists ? 'var(--text-muted)' : 'var(--text-secondary)' }}>
                              {exists ? '✓ ' : '+ '}{v}
                            </button>
                          )
                        })}
                      </div>
                      {form.health.vaccines.map((vac, i) => (
                        <div key={i} className="flex items-center gap-2 mb-2 p-2 rounded-xl" style={{ background: 'var(--glass-bg)', border: '1px solid var(--border)' }}>
                          <FaSyringe size={12} className="text-brand-400 shrink-0" />
                          <input type="text" value={vac.name} onChange={(e) => updateVaccine(i, 'name', e.target.value)} placeholder="Nombre" className="flex-1 text-xs bg-transparent border-none outline-none" style={{ color: 'var(--text-primary)' }} />
                          <input type="date" value={vac.date} onChange={(e) => updateVaccine(i, 'date', e.target.value)} className="text-2xs bg-transparent outline-none" style={{ color: 'var(--text-muted)' }} />
                          <button type="button" onClick={() => removeVaccine(i)} className="text-danger-400 hover:opacity-80"><FaTimes size={10} /></button>
                        </div>
                      ))}
                    </div>

                    {/* Vet Info */}
                    <div className="p-3 rounded-xl" style={{ background: 'var(--glass-bg)', border: '1px solid var(--border)' }}>
                      <div className="flex items-center gap-2 mb-3">
                        <FaPhone size={12} className="text-success-400" />
                        <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Veterinario</label>
                      </div>
                      <div className="space-y-2">
                        <input type="text" value={form.health.vetName} onChange={(e) => setField('health', { ...form.health, vetName: e.target.value })} placeholder="Nombre del veterinario" className="w-full px-3 py-2 rounded-lg text-xs border transition-all focus:outline-none" style={{ background: 'transparent', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                        <input type="tel" value={form.health.vetPhone} onChange={(e) => setField('health', { ...form.health, vetPhone: e.target.value })} placeholder="Teléfono" className="w-full px-3 py-2 rounded-lg text-xs border transition-all focus:outline-none" style={{ background: 'transparent', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                      </div>
                    </div>
                  </>
                )}

                {activeTab === 'preferencias' && (
                  <>
                    {/* Favorite Toys */}
                    <div>
                      <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Juguetes favoritos</label>
                      <ChipInput items={form.preferences.favoriteToys} onChange={(val) => setField('preferences', { ...form.preferences, favoriteToys: val })} placeholder="Ej: Pelota, hueso, frisbee..." color="rgba(245,158,11,0.15)" />
                    </div>

                    {/* Commands */}
                    <div>
                      <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Comandos que conoce</label>
                      <ChipInput items={form.preferences.commands} onChange={(val) => setField('preferences', { ...form.preferences, commands: val })} placeholder="Ej: Sentado,quieto,venga..." color="rgba(5,150,105,0.15)" />
                    </div>

                    {/* Special Needs */}
                    <div>
                      <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
                        Necesidades especiales <span className="font-normal" style={{ color: 'var(--text-muted)' }}>(opcional)</span>
                      </label>
                      <textarea value={form.preferences.specialNeeds} onChange={(e) => setField('preferences', { ...form.preferences, specialNeeds: e.target.value })} rows={3} placeholder="Ej: Miedo a los truenos, necesita rampa para subirse al coche, no puede comer ciertos alimentos..." className="w-full px-4 py-2.5 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" style={{ background: 'var(--glass-bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                    </div>
                  </>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 px-5 pb-5 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors hover:bg-white/5" style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                  Cancelar
                </button>
                <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white transition-all btn-primary inline-flex items-center justify-center gap-2">
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
