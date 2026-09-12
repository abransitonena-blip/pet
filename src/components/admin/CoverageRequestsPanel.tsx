'use client'

import { useEffect, useMemo, useState } from 'react'
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import { Mailbox } from 'lucide-react'
import { db } from '@/firebase/config'
import {
  COVERAGE_STATUS_LABELS,
  COVERAGE_URGENT_REQUESTS,
  summarizeCoverageRequests,
  type CoverageRequestRow,
} from '@/lib/coverageRequests'
import type { Zone } from '@/types'

/**
 * Qué colonias nos están pidiendo.
 *
 * Cada vez que alguien escribe su código postal en la página pública, suma aquí.
 * Lo que importa está arriba: los CP que nadie cubre y que ya pidieron varias
 * familias. Abrir una zona deja de ser una corazonada.
 *
 * Sólo se guarda el código postal -- ni nombre, ni correo, ni teléfono.
 */

// firestore.rules limita esta lista a 100 (validListLimit).
const MAX_REQUESTS = 100

function formatDate(at: number | null): string {
  if (at === null) return 'Sin fecha'
  return new Date(at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

export default function CoverageRequestsPanel({ zones }: { zones: readonly Zone[] }) {
  const [rows, setRows] = useState<CoverageRequestRow[]>([])
  const [denied, setDenied] = useState(false)

  useEffect(() => onSnapshot(
    query(collection(db, 'coverageRequests'), orderBy('count', 'desc'), limit(MAX_REQUESTS)),
    (snapshot) => {
      setDenied(false)
      setRows(snapshot.docs.map((item) => {
        const data = item.data()
        const at = data.lastRequestedAt as { seconds?: unknown } | undefined
        return {
          postalCode: typeof data.postalCode === 'string' ? data.postalCode : item.id,
          count: typeof data.count === 'number' ? data.count : 0,
          lastRequestedAt: typeof at?.seconds === 'number' ? at.seconds * 1000 : null,
        }
      }))
    },
    () => setDenied(true),
  ), [])

  const summary = useMemo(
    () => summarizeCoverageRequests(rows, zones.map((zone) => ({
      name: zone.name,
      active: zone.active,
      postalCodes: zone.postalCodes ?? [],
    }))),
    [rows, zones],
  )

  // Mientras nadie haya preguntado, no hay nada que mostrar ni que explicar.
  if (denied || summary.length === 0) return null

  return (
    <section className="space-y-3">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Mailbox size={15} className="text-primary" aria-hidden="true" /> Códigos postales que nos preguntaron
        </h2>
        <p className="mt-0.5 text-xs text-muted">
          Cada vez que alguien escribe su CP en la página pública, suma aquí. Un CP sin cobertura se
          marca urgente a partir de {COVERAGE_URGENT_REQUESTS} preguntas.
        </p>
      </div>

      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {summary.map((row) => (
          <li
            key={row.postalCode}
            className={`flex items-center gap-3 rounded-2xl border p-3 ${
              row.status === 'urgente' ? 'border-danger-500/40 bg-danger-500/[0.04]' : 'border-ink/10 bg-surface'
            }`}
          >
            <span
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl font-mono text-2xs font-bold ${
                row.status === 'cubierto' ? 'bg-success-500/10 text-success-600'
                  : row.status === 'urgente' ? 'bg-danger-500/10 text-red-700'
                    : 'bg-ink/[0.04] text-muted'
              }`}
              aria-hidden="true"
            >
              CP
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-mono text-sm font-semibold tabular-nums text-ink">{row.postalCode}</p>
              <p className="text-2xs text-muted">
                {row.count} pregunta{row.count === 1 ? '' : 's'} · {formatDate(row.lastRequestedAt)}
              </p>
            </div>
            <span
              className={`text-2xs shrink-0 rounded-full px-2 py-0.5 font-medium ${
                row.status === 'cubierto' ? 'bg-success-500/10 text-success-600'
                  : row.status === 'urgente' ? 'bg-danger-500/10 text-red-700'
                    : 'bg-ink/5 text-muted'
              }`}
            >
              {row.status === 'cubierto' ? row.zoneName || COVERAGE_STATUS_LABELS.cubierto : COVERAGE_STATUS_LABELS[row.status]}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
