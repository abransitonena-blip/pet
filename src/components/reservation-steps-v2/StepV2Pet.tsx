'use client'

import { useState, useEffect } from 'react'
import { Dog, Plus, CheckCircle2, ArrowRight } from 'lucide-react'
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db, auth } from '@/firebase/config'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'

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
      petType: newPetType,
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
        <div className="space-y-2" role="radiogroup" aria-label="Seleccionar mascota">
          {userPets.map(pet => (
            <div
              key={pet.id}
              role="radio"
              aria-checked={form.petId === pet.id}
              tabIndex={0}
              onClick={() => updateForm({ petId: pet.id, petName: pet.name, petType: pet.type || 'perro' })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  updateForm({ petId: pet.id, petName: pet.name, petType: pet.type || 'perro' })
                }
              }}
              className="cursor-pointer"
            >
              <Card
                className={`w-full flex items-center gap-3 p-3 transition-all ${form.petId === pet.id
                  ? 'bg-brand-500/10 border-brand-500/30'
                  : 'bg-white/50 border-transparent hover:bg-ink/5'}`}
                style={{ border: form.petId === pet.id ? '1px solid var(--brand)' : '1px solid var(--border)' }}
              >
                <Dog size={20} className="shrink-0" style={{ color: form.petId === pet.id ? 'var(--brand)' : 'var(--text-muted)' }} />
                <div className="flex-1">
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{pet.name}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{pet.type === 'perro' ? '🐕 Perro' : pet.type === 'gato' ? '🐈 Gato' : '🐾 Otro'}</p>
                </div>
                {form.petId === pet.id && (
                  <CheckCircle2 size={16} className="ml-auto shrink-0" style={{ color: 'var(--brand)' }} />
                )}
              </Card>
            </div>
          ))}
        </div>
      )}

      {showAdd ? (
        <Card className="space-y-3 p-4">
          <Input
            type="text"
            value={newPetName}
            onChange={(e) => setNewPetName(e.target.value)}
            placeholder="Nombre de tu mascota"
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
            <Button
              variant="primary"
              onClick={handleAddPet}
              disabled={!newPetName.trim()}
              className="flex-1"
            >
              Agregar
            </Button>
            <Button
              variant="secondary"
              onClick={() => setShowAdd(false)}
            >
              Cancelar
            </Button>
          </div>
        </Card>
      ) : (
        <Button
          variant="secondary"
          onClick={() => setShowAdd(true)}
          leftIcon={<Plus size={16} />}
        >
          Agregar mascota
        </Button>
      )}

      <div className="flex justify-end pt-2">
        <Button
          variant="primary"
          onClick={onNext}
          disabled={!form.petId}
          leftIcon={<ArrowRight size={14} />}
        >
          Siguiente
        </Button>
      </div>
    </div>
  )
}
