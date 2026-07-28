'use client'

import { FaPaw, FaDog, FaCheck, FaTimes } from 'react-icons/fa'

const PET_TYPES = [
  { value: 'perro', emoji: '🐕', label: 'Perro' },
  { value: 'gato',  emoji: '🐈', label: 'Gato' },
  { value: 'otro',  emoji: '🐾', label: 'Otro' },
]

export default function StepPet({
  form, set, errors, touched, handleBlur, savedPets,
}: {
  form: { petName: string; petType: string }
  set: (key: string, val: string) => void
  errors: Record<string, string>
  touched: Record<string, boolean>
  handleBlur: (key: string) => void
  savedPets: { id: string; name: string; petType: string; breed: string }[]
}) {
  return (
    <div>
      <h3 className="text-lg sm:text-xl font-bold mb-1">¿Cómo se llama tu compañero?</h3>
      <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>Cuéntanos sobre tu peludo</p>

      <div className="space-y-5">
        {savedPets.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Tus mascotas guardadas</p>
            <div className="flex flex-wrap gap-2">
              {savedPets.map((pet) => {
                const selected = form.petName === pet.name
                return (
                  <button
                    key={pet.id}
                    type="button"
                    onClick={() => {
                      set('petName', pet.name)
                      set('petType', pet.petType)
                    }}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-all"
                    style={{
                      background: selected ? 'var(--color-primary-light)' : 'var(--glass-bg)',
                      borderColor: selected ? 'var(--color-primary)' : 'var(--border)',
                      color: selected ? 'var(--color-primary)' : 'var(--text-secondary)',
                    }}
                  >
                    <span>{pet.petType === 'perro' ? '🐕' : pet.petType === 'gato' ? '🐈' : '🐾'}</span>
                    {pet.name}
                    {pet.breed && <span className="text-2xs opacity-60">· {pet.breed}</span>}
                  </button>
                )
              })}
            </div>
            <div className="h-px my-2" style={{ background: 'var(--border)' }} />
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="pet-name" className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
            <FaPaw size={13} className="text-primary" /> Nombre <span style={{ color: 'var(--color-danger)' }}>*</span>
          </label>
          <input
            id="pet-name"
            type="text"
            value={form.petName}
            onChange={(e) => set('petName', e.target.value)}
            onBlur={() => handleBlur('petName')}
            placeholder="Ej: Max, Luna, Toby..."
            autoComplete="off"
            aria-describedby={errors.petName ? 'pet-name-error' : undefined}
            aria-invalid={!!errors.petName}
            className="w-full px-4 py-3 rounded-xl text-sm transition-all duration-200 border focus:outline-none focus:ring-2 focus:ring-primary/30"
            style={{
              background: 'var(--glass-bg)',
              borderColor: errors.petName ? 'var(--color-error)' : form.petName ? 'var(--color-success)' : 'var(--border)',
              color: 'var(--text-primary)',
            }}
          />
          {errors.petName && touched.petName && (
            <p id="pet-name-error" className="text-xs flex items-center gap-1 animate-shake" role="alert" style={{ color: 'var(--color-danger)' }}>
              <FaTimes size={10} /> {errors.petName}
            </p>
          )}
          {!errors.petName && form.petName && (
            <p className="text-xs flex items-center gap-1" style={{ color: 'var(--color-success)' }}>
              <FaCheck size={10} /> ¡Qué bonito nombre!
            </p>
          )}
        </div>

        <div className="space-y-2">
          <fieldset>
            <legend className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
              <FaDog size={13} className="text-primary" /> Tipo de mascota
            </legend>
            <div className="grid grid-cols-3 gap-3" role="radiogroup">
              {PET_TYPES.map((pt) => {
                const selected = form.petType === pt.value
                return (
                  <label
                    key={pt.value}
                    className="relative flex flex-col items-center gap-2 py-4 rounded-xl border transition-all duration-200 cursor-pointer"
                    style={{
                      background: selected ? 'var(--color-primary-light)' : 'var(--glass-bg)',
                      borderColor: selected ? 'var(--color-primary)' : 'var(--border)',
                      minHeight: '44px',
                    }}
                  >
                    <input
                      type="radio"
                      name="petType"
                      value={pt.value}
                      checked={selected}
                      onChange={() => set('petType', pt.value)}
                      className="sr-only"
                    />
                    <span className="text-2xl">{pt.emoji}</span>
                    <span className="text-xs font-medium" style={{ color: selected ? 'var(--color-primary)' : 'var(--text-secondary)' }}>
                      {pt.label}
                    </span>
                  </label>
                )
              })}
            </div>
          </fieldset>
        </div>
      </div>
    </div>
  )
}
