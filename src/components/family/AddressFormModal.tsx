'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { db, auth } from '@/firebase/config'
import {
  collection, query, where, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, limit,
} from 'firebase/firestore'
import { MapPin, X, Check, Loader2, Home, Building2 } from 'lucide-react'
import type { Address } from '@/types'
import { usePostalCodeLookup } from '@/lib/usePostalCodeLookup'
import { normalizePostalCode, zoneForPostalCode } from '@/lib/zoneMatching'
import { getWhatsAppLink } from '@/lib/utils'

/**
 * El alta y la edición de una dirección.
 *
 * Vivía dentro de Mis direcciones, y con ella se cargaban el buscador de código
 * postal y una escucha en vivo de las zonas activas -- para una pantalla en la
 * que casi siempre sólo se mira lo guardado. Ahora todo eso llega cuando alguien
 * toca Agregar o Editar.
 */

const ALIAS_OPTIONS = [
  { value: 'Casa', icon: Home },
  { value: 'Trabajo', icon: Building2 },
  { value: 'Otro', icon: MapPin },
]

const EMPTY_FORM = {
  alias: 'Casa',
  street: '',
  exterior: '',
  interior: '',
  colony: '',
  city: '',
  state: '',
  zip: '',
  references: '',
  instructions: '',
  contactName: '',
  contactPhone: '',
  pickupInstructions: '',
  deliveryInstructions: '',
  zoneId: '',
}


export default function AddressFormModal({ address, isFirst, onClose, onSaved }: {
  address: Address | null
  /** Sin otras direcciones guardadas, la nueva queda como predeterminada. */
  isFirst: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState(address ? {
    alias: address.alias || 'Casa',
    street: address.street || '',
    exterior: address.exterior || '',
    interior: address.interior || '',
    colony: address.colony || '',
    city: address.city || '',
    state: address.state || '',
    zip: address.zip || '',
    references: address.references || '',
    instructions: address.instructions || '',
    contactName: address.contactName || '',
    contactPhone: address.contactPhone || '',
    pickupInstructions: address.pickupInstructions || '',
    deliveryInstructions: address.deliveryInstructions || '',
    zoneId: address.zoneId || '',
  } : EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [zones, setZones] = useState<Array<{ id: string; name: string; active: boolean; postalCodes: string[] }>>([])

  const { suggestion: postalSuggestion, loading: postalLoading } = usePostalCodeLookup(form.zip)

  // Only fills what is still blank: a postal code lookup must never overwrite
  // an address the person already typed by hand.
  useEffect(() => {
    if (!postalSuggestion) return
    setForm((current) => {
      const state = current.state.trim() ? current.state : postalSuggestion.state
      const city = current.city.trim() ? current.city : postalSuggestion.city
      const colony = current.colony.trim() || postalSuggestion.places.length !== 1
        ? current.colony
        : postalSuggestion.places[0]
      return state === current.state && city === current.city && colony === current.colony
        ? current
        : { ...current, state, city, colony }
    })
  }, [postalSuggestion])

  // El código postal elige la zona, como en las apps de reparto. Solo cuando
  // todavía no hay una elegida: si la familia escogió otra a propósito, se
  // respeta. El CP no dibuja un borde; solo dice a qué zona pertenece.
  const zoneForZip = zoneForPostalCode(zones, form.zip)
  const typedPostalCode = normalizePostalCode(form.zip)

  useEffect(() => {
    if (!zoneForZip) return
    setForm((current) => (current.zoneId ? current : { ...current, zoneId: zoneForZip.id }))
  }, [zoneForZip])

  useEffect(() => {
    const zonesQuery = query(collection(db, 'zones'), where('active', '==', true), limit(100))
    return onSnapshot(zonesQuery, (snapshot) => {
      setZones(snapshot.docs.map((item) => {
        const data = item.data()
        return {
          id: item.id,
          name: String(data.name || item.id),
          active: data.active !== false,
          postalCodes: Array.isArray(data.postalCodes)
            ? data.postalCodes.filter((code: unknown): code is string => typeof code === 'string')
            : [],
        }
      }))
    }, () => setSaveError('No pudimos consultar las zonas disponibles.'))
  }, [])

  const handleSave = async () => {
    if (!form.street.trim() || !form.colony.trim() || !form.city.trim() || !form.zoneId) {
      setSaveError('Completa calle, colonia, ciudad y selecciona una zona disponible.')
      return
    }
    const user = auth.currentUser
    if (!user) return
    setSaving(true)
    setSaveError('')
    try {
      const data = {
        ownerId: user.uid,
        alias: form.alias,
        street: form.street.trim(),
        exterior: form.exterior.trim(),
        interior: form.interior.trim(),
        colony: form.colony.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        zip: form.zip.trim(),
        references: form.references.trim(),
        instructions: form.instructions.trim(),
        contactName: form.contactName.trim(),
        contactPhone: form.contactPhone.trim(),
        pickupInstructions: form.pickupInstructions.trim(),
        deliveryInstructions: form.deliveryInstructions.trim(),
        lat: 0,
        lng: 0,
        zoneId: form.zoneId,
        isDefault: isFirst,
      }
      if (address) {
        await updateDoc(doc(db, 'addresses', address.id), data)
      } else {
        await addDoc(collection(db, 'addresses'), { ...data, createdAt: serverTimestamp() })
      }
      onSaved()
    } catch (err) {
      const code = err && typeof err === 'object' && 'code' in err ? String((err as { code?: unknown }).code) : ''
      setSaveError(code.includes('permission-denied')
        ? 'Tu sesión no tiene permiso para guardar esta dirección.'
        : code.includes('unavailable') ? 'No pudimos conectar. Intenta nuevamente.' : 'No pudimos guardar la dirección.')
    }
    setSaving(false)
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
              className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-2xl p-5 space-y-4"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                  {address ? 'Editar dirección' : 'Nueva dirección'}
                </h2>
                <button onClick={() => onClose()} className="h-11 w-11 rounded-lg flex items-center justify-center hover:bg-ink/5" style={{ color: 'var(--text-muted)' }} aria-label="Cerrar formulario">
                  <X size={14} />
                </button>
              </div>

              <div>
                <label htmlFor="address-zone" className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Zona disponible *</label>
                <select id="address-zone" value={form.zoneId} onChange={(event) => setForm({ ...form, zoneId: event.target.value })} className="input-field min-h-11 w-full" required>
                  <option value="">Selecciona una zona</option>
                  {/* Con los CP a la vista, la familia entiende por qué una zona
                      le toca o no, en lugar de adivinar entre nombres. */}
                  {zones.map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      {zone.name}
                      {zone.postalCodes.length > 0
                        ? ` · CP ${zone.postalCodes.slice(0, 3).join(', ')}${zone.postalCodes.length > 3 ? '…' : ''}`
                        : ''}
                    </option>
                  ))}
                </select>
                {zones.length === 0 && <p className="mt-1 text-xs text-warning">Aún no hay zonas activas disponibles. Contacta a PET Ap para confirmar cobertura.</p>}
                {zoneForZip && (
                  <p className="mt-1 text-xs text-muted">
                    Tu código postal {typedPostalCode} corresponde a la zona <strong>{zoneForZip.name}</strong>.
                  </p>
                )}
                {!zoneForZip && typedPostalCode && zones.length > 0 && (
                  <p className="mt-1 text-xs text-warning">
                    Todavía no tenemos una zona para el código postal {typedPostalCode}. Elige la más cercana para guardar tu dirección, o{' '}
                    <a
                      href={getWhatsAppLink(`Hola, soy familia de PET Ap. Mi código postal es ${typedPostalCode} y no aparece en las zonas disponibles. ¿Me confirman si hay cobertura?`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold underline underline-offset-2"
                    >
                      pregúntanos por WhatsApp
                    </a>{' '}
                    si tu colonia debería estar cubierta.
                  </p>
                )}
              </div>

              {/* Alias */}
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Tipo</label>
                <div className="flex gap-2">
                  {ALIAS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setForm({ ...form, alias: opt.value })}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        form.alias === opt.value
                          ? 'bg-brand-500/15 text-brand-600 border border-brand-500/30'
                          : 'border border-ink/15 hover:border-ink/20'
                      }`}
                      style={form.alias !== opt.value ? { color: 'var(--text-muted)' } : undefined}
                    >
                      <opt.icon size={12} /> {opt.value}
                    </button>
                  ))}
                </div>
              </div>

              {/* Street */}
              <div>
                <label htmlFor="addr-street" className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Calle *</label>
                <input
                  id="addr-street"
                  type="text"
                  value={form.street}
                  onChange={(e) => setForm({ ...form, street: e.target.value })}
                  placeholder="Av. Insurgentes Sur"
                  className="w-full px-4 py-2.5 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-primary/30"
                  style={{ background: 'var(--glass-bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
              </div>

              {/* Numbers */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="addr-exterior" className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Núm. Exterior</label>
                  <input
                    id="addr-exterior"
                    type="text"
                    value={form.exterior}
                    onChange={(e) => setForm({ ...form, exterior: e.target.value })}
                    placeholder="123"
                    className="w-full px-4 py-2.5 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-primary/30"
                    style={{ background: 'var(--glass-bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label htmlFor="addr-interior" className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Núm. Interior</label>
                  <input
                    id="addr-interior"
                    type="text"
                    value={form.interior}
                    onChange={(e) => setForm({ ...form, interior: e.target.value })}
                    placeholder="A"
                    className="w-full px-4 py-2.5 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-primary/30"
                    style={{ background: 'var(--glass-bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              {/* Colony + City */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="addr-colony" className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Colonia *</label>
                  <input
                    id="addr-colony"
                    type="text"
                    value={form.colony}
                    onChange={(e) => setForm({ ...form, colony: e.target.value })}
                    placeholder="Del Valle"
                    className="w-full px-4 py-2.5 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-primary/30"
                    style={{ background: 'var(--glass-bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  />
                  {postalSuggestion && postalSuggestion.places.length > 1 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {postalSuggestion.places.map((place) => (
                        <button
                          key={place}
                          type="button"
                          onClick={() => setForm({ ...form, colony: place })}
                          className={`min-h-9 rounded-full border px-2.5 text-2xs font-medium transition-colors ${form.colony === place ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted hover:text-primary'}`}
                        >
                          {place}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label htmlFor="addr-city" className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Ciudad *</label>
                  <input
                    id="addr-city"
                    type="text"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    placeholder="CDMX"
                    className="w-full px-4 py-2.5 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-primary/30"
                    style={{ background: 'var(--glass-bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              {/* State + Zip */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="addr-state" className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Estado</label>
                  <input
                    id="addr-state"
                    type="text"
                    value={form.state}
                    onChange={(e) => setForm({ ...form, state: e.target.value })}
                    placeholder="CDMX"
                    className="w-full px-4 py-2.5 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-primary/30"
                    style={{ background: 'var(--glass-bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label htmlFor="addr-zip" className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Código Postal</label>
                  <input
                    id="addr-zip"
                    type="text"
                    value={form.zip}
                    onChange={(e) => setForm({ ...form, zip: e.target.value })}
                    placeholder="03100"
                    inputMode="numeric"
                    maxLength={5}
                    className="w-full px-4 py-2.5 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-primary/30"
                    style={{ background: 'var(--glass-bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  />
                  <p className="mt-1.5 text-2xs" style={{ color: 'var(--text-muted)' }} role="status">
                    {postalLoading
                      ? 'Buscando colonias…'
                      : postalSuggestion
                        ? `${postalSuggestion.places.length} colonia${postalSuggestion.places.length === 1 ? '' : 's'} encontrada${postalSuggestion.places.length === 1 ? '' : 's'}`
                        : 'Escribe 5 dígitos para sugerir colonia y estado'}
                  </p>
                </div>
              </div>

              {/* References */}
              <div>
                <label htmlFor="addr-references" className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Referencias</label>
                <textarea
                  id="addr-references"
                  value={form.references}
                  onChange={(e) => setForm({ ...form, references: e.target.value })}
                  rows={2}
                  placeholder="Frente al parque, casa azul..."
                  className="w-full px-4 py-2.5 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                  style={{ background: 'var(--glass-bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
              </div>

              {/* Contact */}
              <div className="border-t pt-4 space-y-3" style={{ borderColor: 'var(--border)' }}>
                <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Contacto en la dirección</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="addr-contact-name" className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Nombre</label>
                    <input
                      id="addr-contact-name"
                      type="text"
                      value={form.contactName}
                      onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                      placeholder="Quién recibe"
                      className="w-full px-4 py-2.5 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-primary/30"
                      style={{ background: 'var(--glass-bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                    />
                  </div>
                  <div>
                    <label htmlFor="addr-contact-phone" className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Teléfono</label>
                    <input
                      id="addr-contact-phone"
                      type="tel"
                      value={form.contactPhone}
                      onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                      placeholder="5512345678"
                      className="w-full px-4 py-2.5 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-primary/30"
                      style={{ background: 'var(--glass-bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                    />
                  </div>
                </div>
              </div>

              {/* Instructions */}
              <div className="border-t pt-4 space-y-3" style={{ borderColor: 'var(--border)' }}>
                <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Instrucciones</p>
                <div>
                  <label htmlFor="addr-pickup-instructions" className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Indicaciones de recolección</label>
                  <textarea
                    id="addr-pickup-instructions"
                    value={form.pickupInstructions}
                    onChange={(e) => setForm({ ...form, pickupInstructions: e.target.value })}
                    rows={2}
                    placeholder="Tocar timbre, esperar en lobby..."
                    className="w-full px-4 py-2.5 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                    style={{ background: 'var(--glass-bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label htmlFor="addr-delivery-instructions" className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Indicaciones de entrega</label>
                  <textarea
                    id="addr-delivery-instructions"
                    value={form.deliveryInstructions}
                    onChange={(e) => setForm({ ...form, deliveryInstructions: e.target.value })}
                    rows={2}
                    placeholder="Dejar con portero, entregar en departamento..."
                    className="w-full px-4 py-2.5 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                    style={{ background: 'var(--glass-bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              {/* Actions */}
              {saveError && <p className="rounded-xl bg-danger/10 p-3 text-sm text-danger" role="alert">{saveError}</p>}
              <div className="flex gap-3 pt-2">
                <button onClick={() => onClose()} className="min-h-11 flex-1 rounded-xl text-sm font-medium transition-colors hover:bg-ink/5" style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !form.street.trim() || !form.colony.trim() || !form.city.trim() || !form.zoneId}
                  className="min-h-11 flex-1 rounded-xl text-sm font-semibold bg-primary text-white hover:bg-primary-hover transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? <><Loader2 className="animate-spin" size={12} /> Guardando...</> : <><Check size={12} /> {address ? 'Actualizar' : 'Guardar'}</>}
                </button>
              </div>
      </motion.div>
    </motion.div>
  )
}
