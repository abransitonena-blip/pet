import { twMerge } from 'tailwind-merge'
import clsx from 'clsx'
import { BRAND as brand, WHATSAPP_NUMBER as whatsappNumber } from './brand'

export function cn(...inputs: (string | number | bigint | undefined | null | boolean | Record<string, boolean>)[]): string {
  return twMerge(clsx(inputs.filter(Boolean)))
}

export { brand }

export function formatDate(date: Date) {
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

export function generateId() {
  return Math.random().toString(36).substring(2, 10)
}

export const WHATSAPP_NUMBER = whatsappNumber

export function getWhatsAppLink(message: string) {
  return `https://wa.me/${brand.whatsapp}?text=${encodeURIComponent(message)}`
}

export function normalizeWhatsAppRecipient(recipient: string): string {
  const digits = recipient.replace(/\D/g, '')
  if (/^521\d{10}$/.test(digits)) return `52${digits.slice(3)}`
  if (/^52\d{10}$/.test(digits)) return digits
  if (/^\d{10}$/.test(digits)) return `52${digits}`
  return digits
}

export function confirmWhatsAppShare(recipient: string, message: string): boolean {
  if (typeof window === 'undefined') return false
  const safeRecipient = normalizeWhatsAppRecipient(recipient)
  const recipientLabel = safeRecipient || 'Se elegirá en WhatsApp'
  const approved = window.confirm(
    `Se abrirá WhatsApp.\n\nDestinatario: ${recipientLabel}\nMensaje exacto:\n${message}\n\nNo se agregarán automáticamente dirección, salud, notas privadas ni datos financieros. ¿Continuar?`,
  )
  if (!approved) return false
  window.open(`https://wa.me/${safeRecipient}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer')
  return true
}

export function formatDisplayPhone(e164: string): string {
  const digits = String(e164).replace(/\D/g, '')
  const local = digits.length >= 12 ? digits.slice(-10) : digits
  if (local.length !== 10) return digits
  return `+52 ${local.slice(0, 2)} ${local.slice(2, 6)} ${local.slice(6)}`
}
