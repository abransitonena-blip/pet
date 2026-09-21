'use client'

import { useState } from 'react'
import {
  collection, addDoc, updateDoc, doc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/firebase/db'
import { motion } from 'framer-motion'
import { Plus, Trash2, X, Check } from 'lucide-react'
import { Button } from '@/components/ui'
import { useToast } from '@/context/ToastContext'
import { type Zone, type ZoneSpot } from '@/types'
import ZoneMap from '@/components/map/ZoneMap'
import { ZONE_SPOT_KINDS, ZONE_SPOT_LABELS, parsePostalCodes } from '@/lib/zoneMatching'

/**
 * El alta y la edición de una zona: su centro, su radio, sus códigos postales,
 * sus lugares para pasear y sus ajustes de precio.
 *
 * Vivía dentro del panel de Zonas -- trescientas líneas y un segundo mapa --
 * y se cargaba aunque alguien entrara sólo a mirar la cobertura.
 */

interface ZoneForm {
  name: string
  centerLat: string
  centerLng: string
  radius: string
  /** Texto libre: "06700, 06600 06140". Se limpia al guardar. */
  postalCodes: string
  spots: ZoneSpot[]
  basePrice: string
  fixedAdjustment: string
  percentAdjustment: string
  transitIncluded: boolean
  coverageRadius: string
  minOrder: string
}

const EMPTY_FORM: ZoneForm = {
  name: '', centerLat: '', centerLng: '', radius: '3',
  postalCodes: '', spots: [],
  basePrice: '0', fixedAdjustment: '0', percentAdjustment: '0',
  transitIncluded: true, coverageRadius: '5', minOrder: '0',
}

const EMPTY_SPOT = { name: '', kind: 'parque' as ZoneSpot['kind'], lat: '', lng: '', note: '' }

export default function ZoneFormModal({ zone, zones, onClose }: {
  zone: Zone | null
  /** Las demás zonas, para verlas en el mapa mientras se fija ésta. */
  zones: Zone[]
  onClose: () => void
}) {
  const [form, setForm] = useState<ZoneForm>(zone ? {
    name: zone.name,
  centerLat: String(zone.center?.lat || ''),
  centerLng: String(zone.center?.lng || ''),
  radius: String(zone.radius || '3'),
  postalCodes: (zone.postalCodes ?? []).join(', '),
  spots: zone.spots ?? [],
  basePrice: String(zone.basePrice || '0'),
  fixedAdjustment: String(zone.fixedAdjustment || '0'),
  percentAdjustment: String(zone.percentAdjustment || '0'),
  transitIncluded: zone.transitIncluded ?? true,
  coverageRadius: String(zone.coverageRadius || '5'),
    minOrder: String(zone.minOrder || '0'),
  } : EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [spotDraft, setSpotDraft] = useState(EMPTY_SPOT)
  const { toast } = useToast()

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const data = {
        name: form.name.trim(),
        center: {
          lat: parseFloat(form.centerLat) || 0,
          lng: parseFloat(form.centerLng) || 0,
        },
        radius: parseFloat(form.radius) || 3,
        // El CP decide a qué zona pertenece una dirección; el círculo de
        // arriba sigue siendo el límite que dispara el aviso de salida.
        postalCodes: parsePostalCodes(form.postalCodes),
        spots: form.spots,
        active: true,
        walkerIds: zone?.walkerIds || [],
        basePrice: parseFloat(form.basePrice) || 0,
        fixedAdjustment: parseFloat(form.fixedAdjustment) || 0,
        percentAdjustment: parseFloat(form.percentAdjustment) || 0,
        transitIncluded: form.transitIncluded,
        coverageRadius: parseFloat(form.coverageRadius) || 5,
        minOrder: parseFloat(form.minOrder) || 0,
        availableHours: zone?.availableHours || {},
        stats: zone?.stats || { totalClients: 0, totalWalks: 0, avgDemand: 0 },
      }

      if (zone) {
        await updateDoc(doc(db, 'zones', zone.id), data)
      } else {
        await addDoc(collection(db, 'zones'), { ...data, createdAt: serverTimestamp() })
      }
      toast(zone ? 'Zona actualizada' : 'Zona creada')
      onClose()
    } catch (err) {
      console.error('Error saving zone:', err)
      toast('No pudimos guardar la zona', 'error')
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
              className="w-full max-w-md rounded-xl border border-ink/10 bg-surface p-5 space-y-4 shadow-elevated"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                  {zone ? `Editar ${zone.name}` : 'Nueva zona'}
                </h2>
                <Button variant="icon" onClick={() => onClose()} aria-label="Cerrar formulario">
                  <X size={14} />
                </Button>
              </div>

              <div>
                <label htmlFor="zone-name" className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Nombre</label>
                <input
                  id="zone-name"
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ej: Centro, Polanco, Roma Norte..."
                  className="w-full px-4 py-2.5 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-primary/30"
                  style={{ background: 'var(--glass-bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
              </div>

              <div className="space-y-1.5">
                <ZoneMap
                  label="Toca el mapa para fijar el centro de la zona"
                  zones={zones.filter((other) => other.id !== zone?.id)}
                  draft={{
                    center: form.centerLat && form.centerLng && Number.isFinite(parseFloat(form.centerLat)) && Number.isFinite(parseFloat(form.centerLng))
                      ? { lat: parseFloat(form.centerLat), lng: parseFloat(form.centerLng) }
                      : null,
                    radiusKm: parseFloat(form.radius) || 0,
                  }}
                  onPick={(picked) => setForm((current) => ({ ...current, centerLat: picked.lat.toFixed(6), centerLng: picked.lng.toFixed(6) }))}
                  height={220}
                />
                <p className="text-2xs text-muted">Toca el mapa para fijar el centro; el círculo punteado muestra el radio. Si un paseador sale de este círculo durante un paseo, administración recibe un aviso.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="zone-lat" className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Latitud</label>
                  <input
                    id="zone-lat"
                    type="number"
                    step="any"
                    value={form.centerLat}
                    onChange={(e) => setForm({ ...form, centerLat: e.target.value })}
                    placeholder="19.4326"
                    className="w-full px-4 py-2.5 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-primary/30"
                    style={{ background: 'var(--glass-bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label htmlFor="zone-lng" className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Longitud</label>
                  <input
                    id="zone-lng"
                    type="number"
                    step="any"
                    value={form.centerLng}
                    onChange={(e) => setForm({ ...form, centerLng: e.target.value })}
                    placeholder="-99.1332"
                    className="w-full px-4 py-2.5 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-primary/30"
                    style={{ background: 'var(--glass-bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="zone-radius" className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Radio del área recomendada (km)</label>
                <input
                  id="zone-radius"
                  type="number"
                  step="0.5"
                  value={form.radius}
                  onChange={(e) => setForm({ ...form, radius: e.target.value })}
                  placeholder="3"
                  className="w-full px-4 py-2.5 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-primary/30"
                  style={{ background: 'var(--glass-bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
              </div>

              <div className="border-t border-ink/10 pt-4 space-y-2">
                <label htmlFor="zone-postal-codes" className="text-xs font-semibold block" style={{ color: 'var(--text-secondary)' }}>
                  Códigos postales que cubre
                </label>
                <input
                  id="zone-postal-codes"
                  type="text"
                  inputMode="numeric"
                  value={form.postalCodes}
                  onChange={(e) => setForm({ ...form, postalCodes: e.target.value })}
                  placeholder="06700, 06600, 06140"
                  className="w-full px-4 py-2.5 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-primary/30"
                  style={{ background: 'var(--glass-bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
                <div className="flex flex-wrap gap-1">
                  {parsePostalCodes(form.postalCodes).map((code) => (
                    <span key={code} className="text-2xs rounded-full bg-success-500/10 px-2 py-0.5 text-success-600">{code}</span>
                  ))}
                </div>
                <p className="text-2xs text-muted">
                  Con esto la dirección de una familia cae sola en esta zona al escribir su CP. No dibuja un borde:
                  el aviso de que el paseador salió sigue usando el círculo de arriba.
                </p>
              </div>

              <div className="border-t border-ink/10 pt-4 space-y-2">
                <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Parques y lugares para pasear</p>
                {form.spots.length > 0 && (
                  <ul className="space-y-1.5">
                    {form.spots.map((spot) => (
                      <li key={spot.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs" style={{ background: 'var(--glass-bg)' }}>
                        <span className="min-w-0">
                          <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{spot.name}</span>
                          <span className="block text-2xs" style={{ color: 'var(--text-muted)' }}>
                            {ZONE_SPOT_LABELS[spot.kind]} · {spot.lat.toFixed(4)}, {spot.lng.toFixed(4)}{spot.note ? ` · ${spot.note}` : ''}
                          </span>
                        </span>
                        <Button
                          variant="icon"
                          onClick={() => setForm({ ...form, spots: form.spots.filter((item) => item.id !== spot.id) })}
                          aria-label={`Quitar ${spot.name}`}
                          className="hover:bg-danger-500/10 hover:text-danger-400"
                        >
                          <Trash2 size={11} />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={spotDraft.name}
                    onChange={(e) => setSpotDraft({ ...spotDraft, name: e.target.value })}
                    placeholder="Nombre del lugar"
                    aria-label="Nombre del lugar"
                    className="px-3 py-2 rounded-lg text-xs border"
                    style={{ background: 'var(--glass-bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  />
                  <select
                    value={spotDraft.kind}
                    onChange={(e) => setSpotDraft({ ...spotDraft, kind: e.target.value as ZoneSpot['kind'] })}
                    aria-label="Tipo de lugar"
                    className="px-3 py-2 rounded-lg text-xs border"
                    style={{ background: 'var(--glass-bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  >
                    {ZONE_SPOT_KINDS.map((kind) => <option key={kind} value={kind}>{ZONE_SPOT_LABELS[kind]}</option>)}
                  </select>
                  <input
                    type="number"
                    step="any"
                    value={spotDraft.lat}
                    onChange={(e) => setSpotDraft({ ...spotDraft, lat: e.target.value })}
                    placeholder="Latitud"
                    aria-label="Latitud del lugar"
                    className="px-3 py-2 rounded-lg text-xs border"
                    style={{ background: 'var(--glass-bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  />
                  <input
                    type="number"
                    step="any"
                    value={spotDraft.lng}
                    onChange={(e) => setSpotDraft({ ...spotDraft, lng: e.target.value })}
                    placeholder="Longitud"
                    aria-label="Longitud del lugar"
                    className="px-3 py-2 rounded-lg text-xs border"
                    style={{ background: 'var(--glass-bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setSpotDraft({ ...spotDraft, lat: form.centerLat, lng: form.centerLng })}
                    disabled={!form.centerLat || !form.centerLng}
                  >
                    Usar el centro de la zona
                  </Button>
                  <Button
                    size="sm"
                    leftIcon={<Plus size={12} />}
                    disabled={!spotDraft.name.trim() || !Number.isFinite(parseFloat(spotDraft.lat)) || !Number.isFinite(parseFloat(spotDraft.lng))}
                    onClick={() => {
                      setForm({
                        ...form,
                        spots: [...form.spots, {
                          id: `spot-${Date.now()}`,
                          name: spotDraft.name.trim(),
                          kind: spotDraft.kind,
                          lat: parseFloat(spotDraft.lat),
                          lng: parseFloat(spotDraft.lng),
                          ...(spotDraft.note.trim() ? { note: spotDraft.note.trim() } : {}),
                        }],
                      })
                      setSpotDraft(EMPTY_SPOT)
                    }}
                  >
                    Agregar lugar
                  </Button>
                </div>
                <p className="text-2xs text-muted">El paseador ve estos lugares cuando le toca un paseo en esta zona.</p>
              </div>

              <div className="border-t border-ink/10 pt-4 space-y-3">
                <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Precios por zona</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="zone-fixed-adjustment" className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Ajuste fijo ($)</label>
                    <input
                      id="zone-fixed-adjustment"
                      type="number"
                      step="1"
                      value={form.fixedAdjustment}
                      onChange={(e) => setForm({ ...form, fixedAdjustment: e.target.value })}
                      placeholder="0"
                      className="w-full px-4 py-2.5 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-primary/30"
                      style={{ background: 'var(--glass-bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                    />
                  </div>
                  <div>
                    <label htmlFor="zone-percent-adjustment" className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Ajuste %</label>
                    <input
                      id="zone-percent-adjustment"
                      type="number"
                      step="1"
                      value={form.percentAdjustment}
                      onChange={(e) => setForm({ ...form, percentAdjustment: e.target.value })}
                      placeholder="0"
                      className="w-full px-4 py-2.5 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-primary/30"
                      style={{ background: 'var(--glass-bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="zone-min-order" className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Cobertura mínima ($)</label>
                    <input
                      id="zone-min-order"
                      type="number"
                      step="1"
                      value={form.minOrder}
                      onChange={(e) => setForm({ ...form, minOrder: e.target.value })}
                      placeholder="0"
                      className="w-full px-4 py-2.5 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-primary/30"
                      style={{ background: 'var(--glass-bg)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-6">
                    <input
                      type="checkbox"
                      checked={form.transitIncluded}
                      onChange={(e) => setForm({ ...form, transitIncluded: e.target.checked })}
                      className="rounded"
                      id="transitIncluded"
                    />
                    <label htmlFor="transitIncluded" className="text-xs" style={{ color: 'var(--text-secondary)' }}>Traslado incluido</label>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="secondary" className="flex-1" onClick={() => onClose()}>
                  Cancelar
                </Button>
                <Button className="flex-1" onClick={handleSave} disabled={!form.name.trim()} isLoading={saving} leftIcon={<Check size={14} />}>
                  {zone ? 'Guardar' : 'Crear zona'}
                </Button>
              </div>
      </motion.div>
    </motion.div>
  )
}
