'use client'

import { useCallback, useEffect, useState } from 'react'
import { collection, doc, getDoc, getDocs, query, where, orderBy, limit as fsLimit } from 'firebase/firestore'
import { AlertTriangle, Package, Send } from 'lucide-react'
import { PageHeader, DataCard, EmptyState, ErrorState, LoadingState } from '@/components/ui'
import { db } from '@/firebase/db'
import { auth } from '@/firebase/config'
import { isLowStock, MAX_NOTE_LENGTH } from '@/lib/zoneSupplies'
import { useFetchWalkersByZone, type ZoneWalker } from '@/lib/useZoneWalkers'

/**
 * Suministros de mi zona: cuánto queda, y entregarle a un paseador.
 *
 * El stock lo fija y lo reabastece administración; aquí sólo se baja, y sólo
 * a través de /api/zone/supplies/deliver -- una transacción que nunca lo deja
 * en negativo. El aviso de "queda poco" es visual, no un push: hay que abrir
 * esta pantalla para verlo.
 */

const HISTORY_LIMIT = 20
const SUPPLIES_LIMIT = 100

interface SupplyRow {
  id: string
  zoneId: string
  zoneName: string
  itemName: string
  unit: string
  stock: number
  lowStockThreshold: number
}

interface DeliveryRow {
  id: string
  itemName: string
  quantity: number
  walkerName: string
  deliveredAt: number | null
  note: string
}

type PanelState = 'loading' | 'ready' | 'error' | 'no-zones'

function timestampMs(value: unknown): number | null {
  return value && typeof value === 'object' && typeof (value as { seconds?: unknown }).seconds === 'number'
    ? (value as { seconds: number }).seconds * 1000
    : null
}

export default function ZonaSuministrosPanel() {
  const fetchWalkersByZone = useFetchWalkersByZone()
  const [state, setState] = useState<PanelState>('loading')
  const [supplies, setSupplies] = useState<SupplyRow[]>([])
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([])
  const [walkersByZone, setWalkersByZone] = useState<Map<string, ZoneWalker[]>>(new Map())
  const [form, setForm] = useState<Record<string, { walkerId: string; quantity: string; note: string }>>({})
  const [sending, setSending] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')
  const [actionNotice, setActionNotice] = useState('')

  const load = useCallback(async () => {
    setState('loading')
    try {
      const uid = auth.currentUser?.uid
      if (!uid) throw new Error('auth-required')
      const profileSnapshot = await getDoc(doc(db, 'zoneAdminProfiles', uid))
      const zones: string[] = Array.isArray(profileSnapshot.data()?.zones)
        ? (profileSnapshot.data()?.zones as unknown[]).filter((zone): zone is string => typeof zone === 'string')
        : []
      if (zones.length === 0) {
        setState('no-zones')
        return
      }

      const zoneDocs = await Promise.all(zones.map((id) => getDoc(doc(db, 'zones', id))))
      const zoneNames = new Map(zoneDocs.map((item, index) => [zones[index], (item.data()?.name as string) || zones[index]]))

      const [suppliesSnapshot, deliveriesSnapshot, byZone] = await Promise.all([
        getDocs(query(collection(db, 'zoneSupplies'), where('zoneId', 'in', zones), fsLimit(SUPPLIES_LIMIT))),
        getDocs(query(collection(db, 'zoneSupplyDeliveries'), where('zoneId', 'in', zones), orderBy('deliveredAt', 'desc'), fsLimit(HISTORY_LIMIT))),
        fetchWalkersByZone(zones),
      ])

      setSupplies(suppliesSnapshot.docs.map((item) => {
        const data = item.data()
        return {
          id: item.id,
          zoneId: String(data.zoneId ?? ''),
          zoneName: zoneNames.get(String(data.zoneId ?? '')) ?? String(data.zoneId ?? ''),
          itemName: String(data.itemName ?? 'Suministro'),
          unit: String(data.unit ?? 'unidades'),
          stock: typeof data.stock === 'number' ? data.stock : 0,
          lowStockThreshold: typeof data.lowStockThreshold === 'number' ? data.lowStockThreshold : 0,
        }
      }))
      setDeliveries(deliveriesSnapshot.docs.map((item) => {
        const data = item.data()
        return {
          id: item.id,
          itemName: String(data.itemName ?? 'Suministro'),
          quantity: typeof data.quantity === 'number' ? data.quantity : 0,
          walkerName: String(data.walkerName ?? 'Paseador'),
          deliveredAt: timestampMs(data.deliveredAt),
          note: String(data.note ?? ''),
        }
      }))
      setWalkersByZone(byZone)
      setState('ready')
    } catch {
      setState('error')
    }
  }, [fetchWalkersByZone])

  useEffect(() => { void load() }, [load])

  const handleDeliver = async (supply: SupplyRow) => {
    const entry = form[supply.id]
    const quantity = Number(entry?.quantity)
    if (!entry?.walkerId || !Number.isFinite(quantity) || quantity <= 0) return
    setSending(supply.id)
    setActionError('')
    setActionNotice('')
    try {
      const idToken = await auth.currentUser?.getIdToken()
      if (!idToken) throw new Error('auth-required')
      const response = await fetch('/api/zone/supplies/deliver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ supplyId: supply.id, walkerId: entry.walkerId, quantity, note: entry.note ?? '' }),
      })
      const result = await response.json().catch(() => ({})) as { code?: string }
      if (!response.ok) throw new Error(result.code ?? 'deliver-failed')
      setActionNotice(`Entrega registrada: ${quantity} ${supply.unit} de ${supply.itemName}.`)
      setForm({ ...form, [supply.id]: { walkerId: '', quantity: '', note: '' } })
      await load()
    } catch (cause) {
      setActionError(messageForDeliverError(cause instanceof Error ? cause.message : ''))
    } finally {
      setSending(null)
    }
  }

  if (state === 'loading') return <LoadingState message="Consultando suministros…" rows={3} />
  if (state === 'error') return <ErrorState description="No pudimos consultar los suministros." onRetry={() => void load()} />
  if (state === 'no-zones') {
    return (
      <EmptyState
        icon={<Package size={24} />}
        title="Todavía no tienes zonas asignadas"
        description="Administración debe asignarte al menos una zona antes de que haya suministros que mostrar."
      />
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Suministros"
        description="Lo que hay en tu zona, y a quién se le entregó."
        icon={<Package size={20} />}
      />

      {actionError && <p role="alert" className="rounded-xl bg-danger-500/10 px-3 py-2 text-xs text-red-700">{actionError}</p>}
      {actionNotice && <p role="status" className="rounded-xl bg-success/10 px-3 py-2 text-xs font-medium text-success-700">{actionNotice}</p>}

      <section className="space-y-3">
        {supplies.length === 0 ? (
          <p className="text-sm text-muted">Administración todavía no registró suministros para tu zona.</p>
        ) : (
          <div className="space-y-3">
            {supplies.map((supply) => {
              const eligible = walkersByZone.get(supply.zoneId) ?? []
              const low = isLowStock(supply.stock, supply.lowStockThreshold)
              const entry = form[supply.id] ?? { walkerId: '', quantity: '', note: '' }
              return (
                <DataCard key={supply.id} padded>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                        {supply.itemName}
                        {low && (
                          <span className="flex items-center gap-1 rounded-full bg-danger-500/10 px-2 py-0.5 text-2xs font-medium text-red-700">
                            <AlertTriangle size={11} aria-hidden="true" /> Queda poco
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">{supply.zoneName} · {supply.stock} {supply.unit} disponibles</p>
                    </div>
                  </div>

                  {eligible.length === 0 ? (
                    <p className="mt-2 text-xs text-muted">Ningún paseador activo cubre esta zona.</p>
                  ) : (
                    <div className="mt-3 flex flex-wrap items-end gap-2">
                      <select
                        value={entry.walkerId}
                        onChange={(e) => setForm({ ...form, [supply.id]: { ...entry, walkerId: e.target.value } })}
                        className="input-field min-h-9 text-xs"
                        aria-label={`Paseador que recibe ${supply.itemName}`}
                      >
                        <option value="">Paseador…</option>
                        {eligible.map((walker) => (
                          <option key={walker.id} value={walker.id}>{walker.name}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={1}
                        max={supply.stock}
                        value={entry.quantity}
                        onChange={(e) => setForm({ ...form, [supply.id]: { ...entry, quantity: e.target.value } })}
                        placeholder="Cantidad"
                        aria-label={`Cantidad de ${supply.itemName} a entregar`}
                        className="input-field min-h-9 w-24 text-xs"
                      />
                      <input
                        value={entry.note}
                        onChange={(e) => setForm({ ...form, [supply.id]: { ...entry, note: e.target.value.slice(0, MAX_NOTE_LENGTH) } })}
                        placeholder="Nota (opcional)"
                        aria-label={`Nota de la entrega de ${supply.itemName}`}
                        className="input-field min-h-9 flex-1 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => void handleDeliver(supply)}
                        disabled={sending === supply.id || !entry.walkerId || !entry.quantity}
                        className="flex min-h-9 items-center gap-1.5 rounded-full bg-primary px-3 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        <Send size={13} aria-hidden="true" /> {sending === supply.id ? 'Entregando…' : 'Entregar'}
                      </button>
                    </div>
                  )}
                </DataCard>
              )
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-ink">Últimas entregas</h2>
        {deliveries.length === 0 ? (
          <p className="text-sm text-muted">Todavía no se ha registrado ninguna entrega.</p>
        ) : (
          <ul className="space-y-1.5">
            {deliveries.map((delivery) => (
              <li key={delivery.id} className="rounded-xl bg-ink/[0.03] px-3 py-2 text-xs text-ink">
                <span className="font-semibold">{delivery.quantity} {delivery.itemName}</span> a {delivery.walkerName}
                {delivery.deliveredAt && <span className="text-muted"> · {new Date(delivery.deliveredAt).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>}
                {delivery.note && <span className="text-muted"> · {delivery.note}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function messageForDeliverError(code: string): string {
  if (code === 'insufficient-stock') return 'No queda suficiente stock para esa cantidad.'
  if (code === 'invalid-quantity') return 'La cantidad no es válida.'
  if (code === 'walker-not-active') return 'Ese paseador ya no está activo.'
  if (code === 'not-found') return 'Este suministro ya no existe o no es de tu zona. Actualiza la página.'
  return 'No pudimos registrar la entrega. Intenta de nuevo.'
}
