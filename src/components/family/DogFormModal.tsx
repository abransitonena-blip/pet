'use client'

import { useState } from 'react'
import {
  collection, addDoc, updateDoc, deleteField, doc, serverTimestamp,
} from 'firebase/firestore'
import { auth, db } from '@/firebase/config'
import { motion } from 'framer-motion'
import {
  PawPrint, Plus, X, Check, Brain, HeartPulse, SlidersHorizontal,
  Venus, Mars, Syringe, Phone,
} from 'lucide-react'
import { Pet } from '@/types'
import { Button } from '@/components/ui'
import { DOG_BREED_SUGGESTIONS } from '@/lib/dogBreeds'
import { SIZE_OPTIONS } from '@/lib/petOptions'

/**
 * El alta y la edición de una mascota.
 *
 * Vivía dentro de Mis perros: trescientas líneas de formulario que se cargaban
 * con la lista aunque casi siempre se entra sólo a mirar. Ahora la pantalla
 * pide este componente cuando alguien toca Agregar o Editar.
 */

type PetTab = 'basico' | 'personalidad' | 'salud' | 'preferencias'


const EMPTY_FORM = {
  name: '',
  breed: '',
  size: 'mediano' as 'pequeño' | 'mediano' | 'grande',
  sex: '' as 'macho' | 'hembra' | '',
  age: '',
  weight: '',
  petType: 'perro' as 'perro' | 'gato' | 'otro',
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

const PET_TYPE_OPTIONS = [
  { value: 'perro', label: 'Perro', emoji: '🐕' },
  { value: 'gato', label: 'Gato', emoji: '🐈' },
  { value: 'otro', label: 'Otro', emoji: '🐾' },
]

/**
 * Suggestions, not a closed list: the field stays free text, because forcing a
 * choice would make a family pick something false for a mixed or uncommon
 * breed. "Mestizo" leads because it is the most common answer.
 */
const BREED_SUGGESTIONS: Record<'perro' | 'gato' | 'otro', readonly string[]> = {
  // Las razas conocidas salen del catálogo que también decide el color del
  // perro sin foto: una sola lista que crece en un solo lugar. Las primeras son
  // las respuestas más comunes, que además son las que se ofrecen de un toque.
  perro: [
    'Mestizo', 'Chihuahua', 'Labrador Retriever', 'Golden Retriever', 'Pastor Aleman',
    'Schnauzer', 'Poodle', 'Shih Tzu', 'Pug', 'Bulldog Frances',
    ...DOG_BREED_SUGGESTIONS.filter((breed) => ![
      'Mestizo', 'Chihuahua', 'Labrador Retriever', 'Golden Retriever', 'Pastor Aleman',
      'Schnauzer', 'Poodle', 'Shih Tzu', 'Pug', 'Bulldog Frances',
    ].includes(breed)),
  ],
  gato: [
    'Mestizo', 'Doméstico de pelo corto', 'Doméstico de pelo largo', 'Siamés', 'Persa',
    'Maine Coon', 'Bengalí', 'Ragdoll', 'Angora', 'Esfinge',
  ],
  otro: [],
}

const QUICK_BREEDS = 6

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

const TABS: { key: PetTab; label: string; icon: typeof PawPrint }[] = [
  { key: 'basico', label: 'Básico', icon: PawPrint },
  { key: 'personalidad', label: 'Personalidad', icon: Brain },
  { key: 'salud', label: 'Salud', icon: HeartPulse },
  { key: 'preferencias', label: 'Preferencias', icon: SlidersHorizontal },
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
    if (v && items.length < 10 && !items.includes(v)) { onChange([...items, v]); setValue('') }
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
          aria-label={placeholder}
          maxLength={80}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          placeholder={placeholder}
          className="flex-1 px-3 py-2 rounded-xl text-xs border transition-all focus:outline-none focus:ring-2 focus:ring-primary/30"
          style={{ background: 'var(--glass-bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
        />
        <button type="button" onClick={add} className="px-3 py-2 rounded-xl text-xs font-medium transition-colors hover:bg-ink/5" style={{ color: 'var(--color-primary)', border: '1px solid var(--border)' }}>
          + Agregar
        </button>
      </div>
    </div>
  )
}

export default function DogFormModal({ pet, onClose }: { pet: Pet | null; onClose: () => void }) {
  // Los registros viejos no traen todos estos campos; el formulario es de
  // entradas controladas y validate() llama a .trim(), así que cada campo tiene
  // que llegar con un valor real o editar una mascota vieja truena.
  const [form, setForm] = useState<PetForm>(pet ? {
      name: pet.name || '',
      breed: pet.breed || '',
      size: pet.size || 'mediano',
      sex: pet.sex || '',
      age: String(pet.age || ''),
      weight: String(pet.weight || ''),
      petType: pet.petType || 'perro',
      notes: pet.notes || '',
      personality: pet.personality || { energyLevel: 'medio', temperament: [] },
      health: pet.health || { allergies: [], medications: [], vaccines: [], vetName: '', vetPhone: '' },
    preferences: pet.preferences || { favoriteToys: [], commands: [], specialNeeds: '' },
  } : EMPTY_FORM)
  const [activeTab, setActiveTab] = useState<PetTab>('basico')
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saveError, setSaveError] = useState('')


  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.name?.trim()) e.name = 'Escribe el nombre de tu mascota'
    if (!form.breed?.trim()) e.breed = 'Escribe la raza'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    const user = auth.currentUser
    if (!user) return

    setSaving(true)
    setSaveError('')
    try {
      const data = {
        name: form.name.trim(),
        breed: form.breed.trim(),
        size: form.size,
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

      // Firestore rejects `undefined`, so a pet saved without choosing a sex
      // used to fail outright. Unset means: absent on create, removed on edit.
      if (pet) {
        await updateDoc(doc(db, 'dogs', pet.id), { ...data, sex: form.sex || deleteField() })
      } else {
        await addDoc(collection(db, 'dogs'), {
          ...data,
          ...(form.sex ? { sex: form.sex } : {}),
          ownerId: user.uid,
          createdAt: serverTimestamp(),
        })
      }
      onClose()
    } catch (err) {
      const code = err && typeof err === 'object' && 'code' in err ? String((err as { code?: unknown }).code) : ''
      setSaveError(code.includes('permission-denied')
        ? 'Tu sesión no tiene permiso para guardar esta mascota.'
        : 'No pudimos guardar la mascota. Revisa tu conexión e intenta nuevamente.')
    }
    setSaving(false)
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

  return (
    <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
            onClick={() => onClose()}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-md space-y-0 max-h-[88vh] overflow-hidden flex flex-col rounded-xl border border-ink/10 bg-surface shadow-elevated"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-5 pb-3">
                <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                  {pet ? `Editar ${pet.name}` : 'Nueva mascota'}
                </h2>
                <Button variant="icon" onClick={() => onClose()} aria-label="Cerrar formulario">
                  <X size={14} />
                </Button>
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
                      <label htmlFor="dog-name" className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
                        Nombre <span style={{ color: 'var(--color-danger)' }}>*</span>
                      </label>
                      <input id="dog-name" type="text" value={form.name} onChange={(e) => setField('name', e.target.value)} placeholder="Ej: Max, Luna, Toby..." className="w-full px-4 py-2.5 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-primary/30" style={{ background: 'var(--glass-bg)', borderColor: errors.name ? 'var(--color-error)' : 'var(--border)', color: 'var(--text-primary)' }} />
                      {errors.name && <p role="alert" className="text-xs mt-1" style={{ color: 'var(--color-danger)' }}>{errors.name}</p>}
                    </div>

                    {/* Breed */}
                    <div>
                      <label htmlFor="dog-breed" className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
                        Raza <span style={{ color: 'var(--color-danger)' }}>*</span>
                      </label>
                      <input id="dog-breed" type="text" list={`breed-options-${form.petType}`} autoComplete="off" value={form.breed} onChange={(e) => setField('breed', e.target.value)} placeholder="Escribe o elige una raza" className="w-full px-4 py-2.5 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-primary/30" style={{ background: 'var(--glass-bg)', borderColor: errors.breed ? 'var(--color-error)' : 'var(--border)', color: 'var(--text-primary)' }} />
                      <datalist id={`breed-options-${form.petType}`}>
                        {BREED_SUGGESTIONS[form.petType].map((breed) => <option key={breed} value={breed} />)}
                      </datalist>
                      {/* iOS Safari shows datalist suggestions poorly, so the most
                          common answers are also one tap away. */}
                      {BREED_SUGGESTIONS[form.petType].length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {BREED_SUGGESTIONS[form.petType].slice(0, QUICK_BREEDS).map((breed) => (
                            <button
                              key={breed}
                              type="button"
                              onClick={() => setField('breed', breed)}
                              aria-pressed={form.breed === breed}
                              className={`min-h-9 rounded-full border px-3 text-2xs font-medium transition-colors ${form.breed === breed ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted hover:text-ink'}`}
                            >
                              {breed}
                            </button>
                          ))}
                        </div>
                      )}
                      {errors.breed && <p role="alert" className="text-xs mt-1" style={{ color: 'var(--color-danger)' }}>{errors.breed}</p>}
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
                          { value: 'macho' as const, label: 'Macho', icon: Mars, color: '#3b82f6' },
                          { value: 'hembra' as const, label: 'Hembra', icon: Venus, color: '#ec4899' },
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
                        <label htmlFor="dog-age" className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Edad</label>
                        <input id="dog-age" type="text" value={form.age} onChange={(e) => setField('age', e.target.value)} placeholder="Ej: 2 años" className="w-full px-4 py-2.5 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-primary/30" style={{ background: 'var(--glass-bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                      </div>
                      <div>
                        <label htmlFor="dog-weight" className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Peso</label>
                        <input id="dog-weight" type="text" value={form.weight} onChange={(e) => setField('weight', e.target.value)} placeholder="Ej: 15 kg" className="w-full px-4 py-2.5 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-primary/30" style={{ background: 'var(--glass-bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                      </div>
                    </div>

                    {/* Notes */}
                    <div>
                      <label htmlFor="dog-notes" className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
                        Notas <span className="font-normal" style={{ color: 'var(--text-muted)' }}>(opcional)</span>
                      </label>
                      <textarea id="dog-notes" value={form.notes} onChange={(e) => setField('notes', e.target.value)} rows={2} placeholder="Ej: Alergia al pollo, nervioso con perros grandes..." className="w-full px-4 py-2.5 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" style={{ background: 'var(--glass-bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
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
                              {selected && <Check size={8} className="inline mr-1" />}
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
                    <p className="rounded-xl border p-3 text-xs" style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>Información opcional. Registra únicamente alergias, medicamentos o contactos que el equipo necesite conocer para realizar el paseo de forma segura; no solicitamos un diagnóstico médico.</p>
                    {/* Allergies */}
                    <div>
                      <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Alergias</label>
                      <ChipInput items={form.health.allergies} onChange={(val) => setField('health', { ...form.health, allergies: val })} placeholder="Solo si es relevante para el paseo" color="rgba(220,38,38,0.15)" />
                    </div>

                    {/* Medications */}
                    <div>
                      <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Medicamentos</label>
                      <ChipInput items={form.health.medications} onChange={(val) => setField('health', { ...form.health, medications: val })} placeholder="Solo si requiere una precaución operativa" color="rgba(59,130,246,0.15)" />
                    </div>

                    {/* Vaccines */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Vacunas</label>
                        <button type="button" onClick={addVaccine} className="text-2xs font-medium flex items-center gap-1 transition-colors hover:opacity-80" style={{ color: 'var(--color-primary)' }}>
                          <Plus size={8} /> Agregar
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
                        <div key={i} className="mb-2 space-y-1.5 p-2 rounded-xl" style={{ background: 'var(--glass-bg)', border: '1px solid var(--border)' }}>
                          <div className="flex items-center gap-2">
                            <Syringe size={12} className="text-brand-600 shrink-0" />
                            <input type="text" value={vac.name} onChange={(e) => updateVaccine(i, 'name', e.target.value)} placeholder="Nombre" aria-label="Nombre de la vacuna" className="flex-1 text-xs bg-transparent border-none outline-none" style={{ color: 'var(--text-primary)' }} />
                            <button type="button" onClick={() => removeVaccine(i)} aria-label="Quitar vacuna" className="text-danger-400 hover:opacity-80"><X size={10} /></button>
                          </div>
                          {/* The booster date is what lets admin warn before a vaccine lapses; nothing is assumed without it. */}
                          <div className="grid grid-cols-2 gap-2 pl-5">
                            <label htmlFor={`dog-vaccine-date-${i}`} className="text-2xs" style={{ color: 'var(--text-muted)' }}>
                              Aplicada
                              <input id={`dog-vaccine-date-${i}`} type="date" value={vac.date} onChange={(e) => updateVaccine(i, 'date', e.target.value)} className="block w-full text-2xs bg-transparent outline-none" style={{ color: 'var(--text-secondary)' }} />
                            </label>
                            <label htmlFor={`dog-vaccine-next-${i}`} className="text-2xs" style={{ color: 'var(--text-muted)' }}>
                              Próximo refuerzo
                              <input id={`dog-vaccine-next-${i}`} type="date" value={vac.nextDue ?? ''} onChange={(e) => updateVaccine(i, 'nextDue', e.target.value)} className="block w-full text-2xs bg-transparent outline-none" style={{ color: 'var(--text-secondary)' }} />
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Vet Info */}
                    <div className="p-3 rounded-xl" style={{ background: 'var(--glass-bg)', border: '1px solid var(--border)' }}>
                      <div className="flex items-center gap-2 mb-3">
                        <Phone size={12} className="text-success-400" />
                        <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Veterinario</label>
                      </div>
                      <div className="space-y-2">
                        <input type="text" aria-label="Nombre del veterinario" maxLength={100} value={form.health.vetName} onChange={(e) => setField('health', { ...form.health, vetName: e.target.value })} placeholder="Contacto veterinario (opcional)" className="w-full px-3 py-2 rounded-lg text-xs border transition-all focus:outline-none" style={{ background: 'transparent', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                        <input type="tel" aria-label="Teléfono del veterinario" maxLength={20} value={form.health.vetPhone} onChange={(e) => setField('health', { ...form.health, vetPhone: e.target.value })} placeholder="Teléfono (opcional)" className="w-full px-3 py-2 rounded-lg text-xs border transition-all focus:outline-none" style={{ background: 'transparent', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
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
                      <label htmlFor="dog-special-needs" className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
                        Necesidades especiales <span className="font-normal" style={{ color: 'var(--text-muted)' }}>(opcional)</span>
                      </label>
                      <textarea id="dog-special-needs" value={form.preferences.specialNeeds} onChange={(e) => setField('preferences', { ...form.preferences, specialNeeds: e.target.value })} rows={3} placeholder="Ej: Miedo a los truenos, necesita rampa para subirse al coche, no puede comer ciertos alimentos..." className="w-full px-4 py-2.5 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" style={{ background: 'var(--glass-bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
                    </div>
                  </>
                )}
              </div>

              {/* Actions */}
              <div className="border-t border-ink/10 px-5 pb-5 pt-3 space-y-3">
                {saveError && <p role="alert" className="text-xs text-danger">{saveError}</p>}
                <div className="flex gap-3">
                  <Button variant="secondary" className="flex-1" onClick={() => onClose()}>
                    Cancelar
                  </Button>
                  <Button className="flex-1" onClick={handleSave} isLoading={saving} leftIcon={<Check size={14} />}>
                    {pet ? 'Guardar cambios' : 'Agregar mascota'}
                  </Button>
                </div>
              </div>
      </motion.div>
    </motion.div>
  )
}
