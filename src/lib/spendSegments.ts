/**
 * Feature K — Panel de segmentos de gasto de clientes.
 *
 * Clasifica clientes en segmentos según umbrales de gasto en pesos (MXN)
 * configurados explícitamente por el admin. SIN valores por defecto:
 * si no hay umbrales configurados, el panel muestra un estado vacío.
 *
 * Restricciones de negocio:
 * - Los umbrales los define el admin, nunca el agente/código.
 * - Esta clasificación es SOLO para analítica interna del admin.
 * - No se expone a clientes ni se usa para decisiones automatizadas.
 * - No implica precios diferenciados ni reglas de negocio.
 */

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

/**
 * Configuración de segmentos guardada en appSettings/public bajo
 * la llave `spendSegments`. Si no existe o está vacía, el panel
 * muestra EmptyState pidiendo configurar los umbrales.
 */
export interface SpendSegmentsConfig {
  /**
   * Umbrales en pesos MXN (centavos completos, igual que el resto del dominio).
   * Array de N-1 valores para N segmentos, ordenado ascendente.
   * Ej: [150000, 300000] → tres segmentos: <$1,500 | $1,500-$3,000 | >$3,000
   * Vacío o ausente → sin segmentos configurados.
   */
  thresholdsCents: number[]
  /**
   * Etiquetas para cada segmento, en el mismo orden.
   * Si está vacío, se generan etiquetas numéricas automáticas (Segmento 1, 2…).
   */
  labels: string[]
  /** Última modificación — para mostrar cuándo se configuró. */
  updatedAt?: { seconds: number }
}

/** Un segmento calculado con su conteo de clientes. */
export interface SpendSegmentResult {
  /** Etiqueta del segmento (definida por el admin o generada). */
  label: string
  /** Límite inferior en centavos (inclusive). 0 para el primer segmento. */
  minCents: number
  /** Límite superior en centavos (exclusivo). null para el último segmento. */
  maxCents: number | null
  /** Cantidad de clientes en este segmento. */
  count: number
  /** IDs de los clientes en este segmento (para depuración, no para UI pública). */
  customerUids: string[]
}

// ---------------------------------------------------------------------------
// Validación de config
// ---------------------------------------------------------------------------

/**
 * Devuelve true si la configuración tiene al menos un umbral válido.
 * El admin debe configurar umbrales antes de que el panel sea útil.
 */
export function isSpendSegmentsConfigured(config: SpendSegmentsConfig | null | undefined): boolean {
  if (!config) return false
  if (!Array.isArray(config.thresholdsCents) || config.thresholdsCents.length === 0) return false
  // Todos los umbrales deben ser enteros positivos y estar ordenados ascendente
  return config.thresholdsCents.every((v, i, arr) => {
    if (!Number.isInteger(v) || v <= 0) return false
    if (i > 0 && v <= arr[i - 1]) return false
    return true
  })
}

// ---------------------------------------------------------------------------
// Clasificación
// ---------------------------------------------------------------------------

/**
 * Clasifica una lista de clientes en segmentos según los umbrales configurados.
 *
 * @param customers - Lista de clientes con su gasto total en centavos
 * @param config - Configuración de umbrales definida por el admin
 * @returns Segmentos con conteo de clientes, o [] si no hay config válida
 */
export function classifyCustomersBySpend(
  customers: { uid: string; spentCents: number }[],
  config: SpendSegmentsConfig | null | undefined,
): SpendSegmentResult[] {
  if (!isSpendSegmentsConfigured(config)) return []

  const thresholds = config!.thresholdsCents
  const n = thresholds.length + 1 // N-1 umbrales → N segmentos

  // Construir segmentos vacíos
  const segments: SpendSegmentResult[] = Array.from({ length: n }, (_, i) => {
    const minCents = i === 0 ? 0 : thresholds[i - 1]
    const maxCents = i < thresholds.length ? thresholds[i] : null
    const rawLabel = config!.labels?.[i]
    const label = typeof rawLabel === 'string' && rawLabel.trim()
      ? rawLabel.trim()
      : `Segmento ${i + 1}`
    return { label, minCents, maxCents, count: 0, customerUids: [] }
  })

  // Clasificar cada cliente
  for (const customer of customers) {
    const spent = typeof customer.spentCents === 'number' && isFinite(customer.spentCents)
      ? Math.max(0, customer.spentCents)
      : 0

    // Buscar el segmento correspondiente (último si supera todos los umbrales)
    let segIdx = segments.length - 1
    for (let i = 0; i < thresholds.length; i++) {
      if (spent < thresholds[i]) {
        segIdx = i
        break
      }
    }
    segments[segIdx].count += 1
    segments[segIdx].customerUids.push(customer.uid)
  }

  return segments
}

// ---------------------------------------------------------------------------
// Formateo de rangos (para mostrar en la UI)
// ---------------------------------------------------------------------------

/**
 * Formatea el rango de un segmento como texto legible.
 * Ej: "Hasta $1,500" / "$1,500 – $3,000" / "Más de $3,000"
 */
export function formatSegmentRange(segment: SpendSegmentResult): string {
  const fmt = (cents: number) =>
    `$${Math.round(cents / 100).toLocaleString('es-MX')}`

  if (segment.minCents === 0 && segment.maxCents !== null) {
    return `Hasta ${fmt(segment.maxCents)}`
  }
  if (segment.minCents > 0 && segment.maxCents !== null) {
    return `${fmt(segment.minCents)} – ${fmt(segment.maxCents)}`
  }
  return `Más de ${fmt(segment.minCents)}`
}
