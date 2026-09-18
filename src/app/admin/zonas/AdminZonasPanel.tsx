'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import {
  collection, query, onSnapshot, updateDoc, deleteDoc, doc, limit,
} from 'firebase/firestore'
import { db } from '@/firebase/db'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MapPinned, Plus, Pencil, Trash2,
  Eye, EyeOff, Search,
} from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import EmptyState from '@/components/ui/EmptyState'
import { Button, ConfirmDialog } from '@/components/ui'
import { useToast } from '@/context/ToastContext'
import { type Zone } from '@/types'
import ZoneMap from '@/components/map/ZoneMap'
import CoverageRequestsPanel from '@/components/admin/CoverageRequestsPanel'
import { duplicatedPostalCodes } from '@/lib/zoneMatching'

// El formulario de una zona son trescientas líneas y un segundo mapa: llega
// cuando alguien va a crear o editar, no al abrir el panel.
const ZoneFormModal = dynamic(() => import('@/components/admin/ZoneFormModal'), { ssr: false })



export default function AdminZonasPage() {
  const [zones, setZones] = useState<Zone[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Zone | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [search, setSearch] = useState('')
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
    setShowForm(true)
  }

  const openEdit = (zone: Zone) => {
    setEditing(zone)
    setShowForm(true)
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
        {showForm && <ZoneFormModal zone={editing} zones={zones} onClose={() => setShowForm(false)} />}
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
