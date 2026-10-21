'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  addDoc, collection, increment, limit as fsLimit, onSnapshot, orderBy, query, serverTimestamp, updateDoc, doc,
} from 'firebase/firestore'
import { Package, Plus } from 'lucide-react'
import { PageHeader, DataCard, EmptyState, LoadingState } from '@/components/ui'
import { db } from '@/firebase/db'
import { auth } from '@/firebase/config'
import { isLowStock } from '@/lib/zoneSupplies'
import type { Zone } from '@/types'

/**
 * Reabasto de suministros por zona.
 *
 * Aquí se fija el stock; el administrador de zona sólo lo baja al entregar
 * (vía /api/zone/supplies/deliver, nunca con un updateDoc directo -- las
 * reglas no se lo permiten). Esta pantalla sí escribe directo, como ya hace
 * Zonas: administración no necesita la transacción con tope porque no hay
 * límite que proteger de sí misma.
 */

const MAX_SUPPLIES = 100

interface SupplyRow {
  id: string
  zoneId: string
  itemName: string
  unit: string
  stock: number
  lowStockThreshold: number
}

export default function AdminSuministrosPanel() {
  const [zones, setZones] = useState<Zone[]>([])
  const [supplies, setSupplies] = useState<SupplyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ zoneId: '', itemName: '', unit: 'unidades', stock: '', lowStockThreshold: '' })
  const [topUp, setTopUp] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => onSnapshot(collection(db, 'zones'), (snapshot) => {
    setZones(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Zone))
  }), [])

  useEffect(() => onSnapshot(
    query(collection(db, 'zoneSupplies'), orderBy('zoneId'), fsLimit(MAX_SUPPLIES)),
    (snapshot) => {
      setSupplies(snapshot.docs.map((item) => {
        const data = item.data()
        return {
          id: item.id,
          zoneId: String(data.zoneId ?? ''),
          itemName: String(data.itemName ?? 'Suministro'),
          unit: String(data.unit ?? 'unidades'),
          stock: typeof data.stock === 'number' ? data.stock : 0,
          lowStockThreshold: typeof data.lowStockThreshold === 'number' ? data.lowStockThreshold : 0,
        }
      }))
      setLoading(false)
    },
    () => setLoading(false),
  ), [])

  const zoneNames = useMemo(() => new Map(zones.map((zone) => [zone.id, zone.name])), [zones])

  const handleCreate = async () => {
    setError('')
    setNotice('')
    const stock = Number(form.stock)
    const lowStockThreshold = Number(form.lowStockThreshold)
    if (!form.zoneId || !form.itemName.trim() || !Number.isFinite(stock) || stock < 0 || !Number.isFinite(lowStockThreshold) || lowStockThreshold < 0) {
      setError('Completa zona, nombre, existencias y umbral de aviso (números, cero o más).')
      return
    }
    try {
      await addDoc(collection(db, 'zoneSupplies'), {
        zoneId: form.zoneId,
        itemName: form.itemName.trim(),
        unit: form.unit.trim() || 'unidades',
        stock,
        lowStockThreshold,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.uid ?? '',
      })
      setForm({ zoneId: '', itemName: '', unit: 'unidades', stock: '', lowStockThreshold: '' })
      setNotice('Suministro registrado.')
    } catch {
      setError('No pudimos registrar el suministro.')
    }
  }

  const handleTopUp = async (supplyId: string) => {
    const amount = Number(topUp[supplyId])
    if (!Number.isFinite(amount) || amount <= 0) return
    try {
      await updateDoc(doc(db, 'zoneSupplies', supplyId), {
        stock: increment(amount),
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.uid ?? '',
      })
      setTopUp({ ...topUp, [supplyId]: '' })
      setNotice('Existencias actualizadas.')
    } catch {
      setError('No pudimos actualizar las existencias.')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Suministros"
        description="Lo que hay en cada zona, para que el administrador de zona lo entregue. Aquí se reabastece."
        icon={<Package size={20} />}
      />

      {error && <p role="alert" className="rounded-xl bg-danger-500/10 px-3 py-2 text-xs text-red-700">{error}</p>}
      {notice && <p role="status" className="rounded-xl bg-success/10 px-3 py-2 text-xs font-medium text-success-700">{notice}</p>}

      <DataCard title="Nuevo suministro" padded>
        <div className="grid gap-2 sm:grid-cols-5">
          <select aria-label="Zona del suministro" value={form.zoneId} onChange={(e) => setForm({ ...form, zoneId: e.target.value })} className="input-field text-xs">
            <option value="">Zona…</option>
            {zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}
          </select>
          <input aria-label="Nombre del artículo" value={form.itemName} onChange={(e) => setForm({ ...form, itemName: e.target.value })} placeholder="Artículo" className="input-field text-xs" />
          <input aria-label="Unidad del artículo" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="Unidad" className="input-field text-xs" />
          <input aria-label="Existencias iniciales" type="number" min={0} value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} placeholder="Existencias" className="input-field text-xs" />
          <input aria-label="Avisar cuando queden menos de" type="number" min={0} value={form.lowStockThreshold} onChange={(e) => setForm({ ...form, lowStockThreshold: e.target.value })} placeholder="Avisar si queda" className="input-field text-xs" />
        </div>
        <button
          type="button"
          onClick={() => void handleCreate()}
          className="mt-3 flex min-h-9 items-center gap-1.5 rounded-full bg-primary px-3 text-xs font-semibold text-white"
        >
          <Plus size={13} aria-hidden="true" /> Agregar
        </button>
      </DataCard>

      {loading ? (
        <LoadingState message="Consultando suministros…" rows={3} />
      ) : supplies.length === 0 ? (
        <EmptyState icon={<Package size={24} />} title="Todavía no hay suministros registrados" description="Agrega el primero arriba." />
      ) : (
        <div className="space-y-2">
          {supplies.map((supply) => (
            <DataCard key={supply.id} padded>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink">
                    {supply.itemName}
                    {isLowStock(supply.stock, supply.lowStockThreshold) && (
                      <span className="ml-2 rounded-full bg-danger-500/10 px-2 py-0.5 text-2xs font-medium text-red-700">Queda poco</span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">{zoneNames.get(supply.zoneId) ?? supply.zoneId} · {supply.stock} {supply.unit}</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={topUp[supply.id] ?? ''}
                    onChange={(e) => setTopUp({ ...topUp, [supply.id]: e.target.value })}
                    placeholder="+ cantidad"
                    aria-label={`Agregar existencias a ${supply.itemName}`}
                    className="input-field min-h-9 w-24 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => void handleTopUp(supply.id)}
                    disabled={!topUp[supply.id]}
                    className="min-h-9 rounded-full bg-ink/5 px-3 text-xs font-semibold text-ink disabled:opacity-50"
                  >
                    Reabastecer
                  </button>
                </div>
              </div>
            </DataCard>
          ))}
        </div>
      )}
    </div>
  )
}
