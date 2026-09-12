import { normalizePostalCode } from '@/lib/zoneMatching'

/**
 * Los códigos postales que la gente preguntó en la página pública.
 *
 * Antes, quien escribía su CP y leía "todavía no llegamos" se iba sin dejar
 * rastro: la demanda de una colonia sin cobertura no existía en ningún lado.
 * Ahora cada consulta suma en el documento de ese CP, así que abrir una zona
 * deja de ser una corazonada -- se ve cuántas familias la pidieron.
 *
 * Se guarda el código postal y nada más: ni nombre, ni correo, ni teléfono. Es
 * un contador por colonia, no una lista de personas.
 */

/** A partir de aquí, un CP sin cobertura se marca como urgente. */
export const COVERAGE_URGENT_REQUESTS = 5

export type CoverageRequestStatus = 'cubierto' | 'sin_cobertura' | 'urgente'

export interface CoverageRequestRow {
  postalCode: string
  count: number
  lastRequestedAt: number | null
}

export interface CoverageRequestSummary extends CoverageRequestRow {
  status: CoverageRequestStatus
  /** El nombre de la zona que lo cubre, cuando alguna lo cubre. */
  zoneName: string
}

export const COVERAGE_STATUS_LABELS: Record<CoverageRequestStatus, string> = {
  cubierto: 'Ya lo cubrimos',
  sin_cobertura: 'Sin cobertura',
  urgente: 'Urgente',
}

interface ZoneCoverage {
  name: string
  active?: boolean
  postalCodes?: readonly string[]
}

/**
 * Ordena lo que hay que atender primero: lo urgente, luego lo que nadie cubre,
 * y al final lo que ya está resuelto. Dentro de cada grupo, lo más pedido.
 */
export function summarizeCoverageRequests(
  rows: readonly CoverageRequestRow[],
  zones: readonly ZoneCoverage[],
): CoverageRequestSummary[] {
  const covered = new Map<string, string>()
  for (const zone of zones) {
    if (zone.active === false) continue
    for (const code of zone.postalCodes ?? []) {
      const clean = normalizePostalCode(code)
      if (clean) covered.set(clean, zone.name)
    }
  }

  const rank: Record<CoverageRequestStatus, number> = { urgente: 0, sin_cobertura: 1, cubierto: 2 }

  return rows
    .map((row): CoverageRequestSummary => {
      const zoneName = covered.get(row.postalCode) ?? ''
      const status: CoverageRequestStatus = zoneName
        ? 'cubierto'
        : row.count >= COVERAGE_URGENT_REQUESTS ? 'urgente' : 'sin_cobertura'
      return { ...row, status, zoneName }
    })
    .sort((a, b) => rank[a.status] - rank[b.status] || b.count - a.count || a.postalCode.localeCompare(b.postalCode))
}

/** Cuántas familias preguntaron por colonias que todavía no cubrimos. */
export function pendingCoverageCount(rows: readonly CoverageRequestSummary[]): number {
  return rows.filter((row) => row.status !== 'cubierto').reduce((total, row) => total + row.count, 0)
}
