/**
 * Suministros por zona (fase 37): lo que un administrador de zona entrega a
 * los paseadores, con existencias reales -- no una bitácora sin número.
 *
 * El stock lo fija y lo reabastece administración. El administrador de zona
 * sólo lo baja, nunca lo sube, y nunca lo deja en negativo: entregar más de
 * lo que hay no vacía el inventario, lo rechaza.
 */

export const MAX_DELIVERY_QUANTITY = 1000
export const MAX_NOTE_LENGTH = 240

export interface DeliveryRequest {
  quantity: number
}

export type DeliveryValidation =
  | { ok: true }
  | { ok: false; code: 'invalid-quantity' | 'insufficient-stock' }

/** Entero positivo, dentro de un tope razonable -- nunca se infiere, siempre se pide. */
export function isValidQuantity(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= MAX_DELIVERY_QUANTITY
}

export function validateDelivery(quantity: unknown, currentStock: number): DeliveryValidation {
  if (!isValidQuantity(quantity)) return { ok: false, code: 'invalid-quantity' }
  if (quantity > currentStock) return { ok: false, code: 'insufficient-stock' }
  return { ok: true }
}

/** Para el aviso visual en el panel: nunca push, nadie lo vigila si nadie abre la pantalla. */
export function isLowStock(stock: number, lowStockThreshold: number): boolean {
  return stock <= lowStockThreshold
}
