'use client'

import { useState, useEffect } from 'react'
import { Dog, Plus, Trash2 } from 'lucide-react'
import { collection, query, where, getDocs, doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db, auth } from '@/firebase/config'

interface StepV2PetProps {
  form: { petId: string; petName: string; petType: string }
  updateForm: (updates: Partial<{ petId: string; petName: string; petType: string }>) => void
  userPets: { id: string; name: string; type: string }[]
  onNext: () => void
}

export default function StepV2Pet({ form, updateForm, userPets, onNext }: StepV2PetProps) {
  const [showAdd, setShowAdd] = useState(false)
  const [newPetName, setNewPetName] = useState('')
  const [newPetType, setNewPetType] = useState('perro')

  useEffect(() => {
    if (userPets.length > 0 && !form.petId) {
      updateForm({ petId: userPets[0].id, petName: userPets[0].name, petType: userPets[0].type || 'perro' })
    }
  }, [userPets, form.petId, updateForm])

  const handleAddPet = async () => {
    if (!newPetName.trim()) return
    const user = auth.currentUser
    if (!user) return

    const petRef = doc(collection(db, 'dogs'))
    await setDoc(petRef, {
      name: newPetName.trim(),
      type: newPetType,
      ownerId: user.uid,
      createdAt: serverTimestamp(),
    })

    updateForm({ petId: petRef.id, petName: newPetName.trim(), petType: newPetType })
    setNewPetName('')
    setShowAdd(false)
  }

  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        ¿Quién es tu compañero de paseo?
      </p>

      {userPets.length > 0 && (
        <div className="space-y-2">
          {userPets.map(pet => (
            <button
              key={pet.id}
              onClick={() => updateForm({ petId: pet.id, petName: pet.name, petType: pet.type || 'perro' })}
              className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${
                form.petId === pet.id
                  ? 'bg-brand-500/10 border-brand-500/30'
                  : 'bg-white/50 border-transparent hover:bg-ink/5'
              }`}
              style={{ border: form.petId === pet.id ? '1px solid var(--brand)' : '1px solid var(--border)' }}
            >
              <Dog size={20} className="shrink-0" style={{ color: form.petId === pet.id ? 'var(--brand)' : 'var(--text-muted)' }} />
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{pet.name}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{pet.type === 'perro' ? '🐕 Perro' : pet.type === 'gato' ? '🐈 Gato' : '🐾 Otro'}</p>
              </div>
              {form.petId === pet.id && (
                <CheckCircle2 size={16} className="ml-auto shrink-0" style={{ color: 'var(--brand)' }} />
              )}
            </button>
          ))}
        </div>
      )}

      {showAdd ? (
        <div className="space-y-3 p-4 rounded-xl" style={{ background: 'var(--glass-bg)', border: '1px solid var(--border)' }}>
          <input
            type="text"
            value={newPetName}
            onChange={(e) => setNewPetName(e.target.value)}
            placeholder="Nombre de tu mascota"
            className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            style={{ background: 'var(--glass-bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          />
          <select
            value={newPetType}
            onChange={(e) => setNewPetType(e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            style={{ background: 'var(--glass-bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          >
            <option value="perro">🐕 Perro</option>
            <option value="gato">🐈 Gato</option>
            <option value="otro">🐾 Otro</option>
          </select>
          <div className="flex gap-2">
            <button
              onClick={handleAddPet}
              disabled={!newPetName.trim()}
              className="flex-1 py-3 rounded-xl text-sm font-semibold bg-brand-500 text-white hover:opacity-90 transition-all disabled:opacity-40"
            >
              Agregar
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="px-4 py-3 rounded-xl text-sm font-medium transition-colors hover:bg-ink/5"
              style={{ color: 'var(--text-muted)' }}
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="w-full flex items-center gap-2 py-3 rounded-xl text-sm font-medium transition-colors hover:bg-ink/5"
          style={{ color: 'var(--text-muted)', border: '1px dashed var(--border)' }}
        >
          <Plus size={16} /> Agregar mascota
        </button>
      )}

      <div className="flex justify-end pt-2">
        <button
          onClick={onNext}
          disabled={!form.petId}
          className="btn-primary inline-flex items-center gap-2"
        >
          Siguiente <ArrowRight size={14} />
        </button>
      </div>
    </div>
  )
}