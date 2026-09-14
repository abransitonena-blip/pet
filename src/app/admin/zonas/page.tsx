'use client'

import { useState, useEffect } from 'react'
import {
  collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, limit,
} from 'firebase/firestore'
import { db } from '@/firebase/config'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MapPinned, Plus, Pencil, Trash2, X, Check,
  Eye, EyeOff, Search,
} from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import EmptyState from '@/components/ui/EmptyState'
import { Button, ConfirmDialog } from '@/components/ui'
import { useToast } from '@/context/ToastContext'
import { type Zone, type ZoneSpot } from '@/types'
import ZoneMap from '@/components/map/ZoneMap'
import CoverageRequestsPanel from '@/components/admin/CoverageRequestsPanel'
import { ZONE_SPOT_KINDS, ZONE_SPOT_LABELS, duplicatedPostalCodes, parsePostalCodes } from '@/lib/zoneMatching'

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

export default function AdminZonasPage() {
  const [zones, setZones] = useState<Zone[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Zone | null>(null)
  const [form, setForm] = useState<ZoneForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [search, setSearch] = useState('')
  const [spotDraft, setSpotDraft] = useState(EMPTY_SPOT)
  const { toast } = useToast()

  useEffect(() => {
    const q = query(collection(db, 'zones'), limit(100))
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Zone))
      setZones(docs)
      setLoading(false)
    }, () => setLoading(false))
    return unsub
  }, [])

  const filtered = zones.filter((z) => z.name.toLowerCase().includes(search.toLowerCase()))

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  const openEdit = (zone: Zone) => {
    setEditing(zone)
    setForm({
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
    })
    setShowForm(true)
  }

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
        walkerIds: editing?.walkerIds || [],
        basePrice: parseFloat(form.basePrice) || 0,
        fixedAdjustment: parseFloat(form.fixedAdjustment) || 0,
        percentAdjustment: parseFloat(form.percentAdjustment) || 0,
        transitIncluded: form.transitIncluded,
        coverageRadius: parseFloat(form.coverageRadius) || 5,
        minOrder: parseFloat(form.minOrder) || 0,
        availableHours: editing?.availableHours || {},
        stats: editing?.stats || { totalClients: 0, totalWalks: 0, avgDemand: 0 },
      }

      if (editing) {
        await updateDoc(doc(db, 'zones', editing.id), data)
      } else {
        await addDoc(collection(db, 'zones'), { ...data, createdAt: serverTimestamp() })
      }
      setShowForm(false)
      setEditing(null)
      setForm(EMPTY_FORM)
      toast(editing ? 'Zona actualizada' : 'Zona creada')
    } catch (err) {
      console.error('Error saving zone:', err)
      toast('No pudimos guardar la zona', 'error')
    }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    setDeleting(true)
    try {
      await deleteDoc(doc(db, 'zones', id))
      setConfirmDelete(null)
      toast('Zona eliminada')
    } catch (err) {
      console.error('Error deleting zone:', err)
      toast('No pudimos eliminar la zona', 'error')
    }
    setDeleting(false)
  }

  const toggleActive = async (zone: Zone) => {
    try {
      await updateDoc(doc(db, 'zones', zone.id), { active: !zone.active })
    } catch (err) {
      console.error('Error toggling zone active state:', err)
      toast('No pudimos actualizar la zona', 'error')
    }
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
      <PageHeader
        title="Zonas"
        description={`${zones.length} zona${zones.length !== 1 ? 's' : ''} · ${zones.filter((z) => z.active).length} activa${zones.filter((z) => z.active).length !== 1 ? 's' : ''}`}
        actions={
          <Button size="sm" onClick={openCreate} leftIcon={<Plus size={12} />}>
            Agregar zona
          </Button>
        }
      />

      {/* Lo que la gente pide va antes que lo que ya existe: es la razón para
          abrir la siguiente zona. */}
      <CoverageRequestsPanel zones={zones} />

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={12} style={{ color: 'var(--text-muted)' }} />
        <input
          type="search"
          aria-label="Buscar una zona por nombre"
          placeholder="Buscar zona..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field pl-9"
        />
      </div>

      {zones.length > 0 && (
        <ZoneMap label="Mapa de todas las zonas" zones={zones} height={280} />
      )}

      {duplicatedPostalCodes(zones).length > 0 && (
        <p role="alert" className="rounded-xl bg-warning/10 px-4 py-3 text-sm text-amber-900">
          Estos códigos postales están en más de una zona activa: {duplicatedPostalCodes(zones).join(', ')}.
          Mientras se repitan, una dirección con ese CP puede caer en cualquiera de las dos.
        </p>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={<MapPinned size={24} />}
          title={search ? 'Sin resultados' : 'No hay zonas configuradas'}
          action={!search ? (
            <Button size="sm" onClick={openCreate} leftIcon={<Plus size={12} />}>
              Crear primera zona
            </Button>
          ) : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((zone, i) => (
            <motion.div
              key={zone.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, delay: i * 0.03 }}
              className="rounded-xl border border-ink/10 bg-surface p-4 shadow-sm transition-all hover:bg-ink/5"
              style={{ opacity: zone.active ? 1 : 0.6 }}
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${zone.active ? 'bg-success-500/10' : 'bg-ink/5'}`}>
                    <MapPinned size={14} className={zone.active ? 'text-success-400' : 'text-muted'} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{zone.name}</p>
                    <p className="text-2xs" style={{ color: 'var(--text-muted)' }}>
                      {zone.active ? 'Activa' : 'Inactiva'}
                      {zone.postalCodes?.length ? ` · ${zone.postalCodes.length} CP` : ' · sin CP'}
                      {zone.spots?.length ? ` · ${zone.spots.length} lugar${zone.spots.length === 1 ? '' : 'es'}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="icon" onClick={() => toggleActive(zone)} aria-label={zone.active ? 'Desactivar' : 'Activar'}>
                    {zone.active ? <Eye size={12} /> : <EyeOff size={12} />}
                  </Button>
                  <Button variant="icon" onClick={() => openEdit(zone)} aria-label="Editar zona">
                    <Pencil size={12} />
                  </Button>
                  <Button variant="icon" onClick={() => setConfirmDelete(zone.id)} className="hover:bg-danger-500/10 hover:text-danger-400" aria-label="Eliminar zona">
                    <Trash2 size={12} />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg py-2" style={{ background: 'var(--glass-bg)' }}>
                  <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{zone.stats?.totalClients || 0}</p>
                  <p className="text-2xs" style={{ color: 'var(--text-muted)' }}>Clientes</p>
                </div>
                <div className="rounded-lg py-2" style={{ background: 'var(--glass-bg)' }}>
                  <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{zone.stats?.totalWalks || 0}</p>
                  <p className="text-2xs" style={{ color: 'var(--text-muted)' }}>Paseos</p>
                </div>
                <div className="rounded-lg py-2" style={{ background: 'var(--glass-bg)' }}>
                  <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{zone.walkerIds?.length || 0}</p>
                  <p className="text-2xs" style={{ color: 'var(--text-muted)' }}>Paseadores</p>
                </div>
              </div>
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
              className="w-full max-w-md rounded-xl border border-ink/10 bg-surface p-5 space-y-4 shadow-elevated"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                  {editing ? `Editar ${editing.name}` : 'Nueva zona'}
                </h2>
                <Button variant="icon" onClick={() => setShowForm(false)} aria-label="Cerrar formulario">
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
                  zones={zones.filter((zone) => zone.id !== editing?.id)}
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
                <label htmlFor="zone-radius" className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Radio (km)</label>
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
                <Button variant="secondary" className="flex-1" onClick={() => setShowForm(false)}>
                  Cancelar
                </Button>
                <Button className="flex-1" onClick={handleSave} disabled={!form.name.trim()} isLoading={saving} leftIcon={<Check size={14} />}>
                  {editing ? 'Guardar' : 'Crear zona'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Eliminar zona"
        description="Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        danger
        loading={deleting}
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  )
}
