'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FaPaw, FaTrash, FaDog, FaPlus } from 'react-icons/fa'

interface PetProfile {
  id: string
  name: string
  type: string
  ownerName: string
  phone: string
  notes: string
}

const STORAGE_KEY = 'pq_pet_profiles'

function loadProfiles(): PetProfile[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveProfiles(profiles: PetProfile[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles))
}

export default function PetProfileManager({ onSelect }: { onSelect?: (profile: PetProfile) => void }) {
  const [profiles, setProfiles] = useState<PetProfile[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<PetProfile>({
    id: '', name: '', type: 'perro', ownerName: '', phone: '', notes: '',
  })

  useEffect(() => {
    setProfiles(loadProfiles())
  }, [])

  const handleSave = () => {
    const updated = editing.id
      ? profiles.map((p) => (p.id === editing.id ? editing : p))
      : [...profiles, { ...editing, id: Date.now().toString() }]
    setProfiles(updated)
    saveProfiles(updated)
    setShowForm(false)
    setEditing({ id: '', name: '', type: 'perro', ownerName: '', phone: '', notes: '' })
  }

  const handleDelete = (id: string) => {
    const updated = profiles.filter((p) => p.id !== id)
    setProfiles(updated)
    saveProfiles(updated)
  }

  const handleEdit = (profile: PetProfile) => {
    setEditing(profile)
    setShowForm(true)
  }

  return (
    <div className="glass-card p-5 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FaDog className="text-primary" size={16} />
          <h3 className="text-sm font-semibold text-white">Mis mascotas</h3>
        </div>
        <button
          onClick={() => { setEditing({ id: '', name: '', type: 'perro', ownerName: '', phone: '', notes: '' }); setShowForm(true) }}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-primary/20 text-primary hover:bg-primary/30 transition-all"
        >
          <FaPlus size={10} />
          Agregar
        </button>
      </div>

      {profiles.length === 0 && !showForm && (
        <p className="text-xs text-white/30 text-center py-6">
          Guarda aquí los datos de tu perro para llenar el formulario más rápido
        </p>
      )}

      <div className="space-y-2">
        {profiles.map((profile) => (
          <motion.div
            key={profile.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/[0.07] transition-all cursor-pointer"
            onClick={() => onSelect?.(profile)}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-amber-600 flex items-center justify-center shrink-0">
                <FaPaw className="text-white" size={12} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">{profile.name}</p>
                <p className="text-xs text-white/30 truncate">{profile.ownerName} · {profile.phone}</p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {onSelect && (
                <span className="text-[10px] text-primary/60">Usar</span>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); handleEdit(profile) }}
                className="text-xs text-white/30 hover:text-white px-2"
              >
                ✏️
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(profile.id) }}
                className="text-xs text-white/30 hover:text-red-400 px-1"
              >
                <FaTrash size={10} />
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 space-y-3 overflow-hidden"
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-white/40 mb-1">Nombre del perro</label>
                <input
                  type="text"
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
                  placeholder="Max"
                />
              </div>
              <div>
                <label className="block text-xs text-white/40 mb-1">Tipo</label>
                <select
                  value={editing.type}
                  onChange={(e) => setEditing({ ...editing, type: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
                >
                  <option value="perro">Perro</option>
                  <option value="gato">Gato</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-white/40 mb-1">Tu nombre</label>
                <input
                  type="text"
                  value={editing.ownerName}
                  onChange={(e) => setEditing({ ...editing, ownerName: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
                  placeholder="María"
                />
              </div>
              <div>
                <label className="block text-xs text-white/40 mb-1">WhatsApp</label>
                <input
                  type="tel"
                  value={editing.phone}
                  onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
                  placeholder="5523053772"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1">Notas</label>
              <input
                type="text"
                value={editing.notes}
                onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
                placeholder="Alergias, comportamiento..."
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2 rounded-xl text-xs text-white/50 border border-white/10 hover:border-white/20 transition-all">
                Cancelar
              </button>
              <button onClick={handleSave} className="flex-1 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-primary to-amber-600 text-white hover:opacity-90 transition-all">
                {editing.id ? 'Guardar cambios' : 'Agregar mascota'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
