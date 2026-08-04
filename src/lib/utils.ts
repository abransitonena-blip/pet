import { brand } from '@/lib/brand'

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

export const WHATSAPP_NUMBER = brand.whatsapp

export function getWhatsAppLink(message: string) {
  return `https://wa.me/${brand.whatsapp}?text=${encodeURIComponent(message)}`
}

export function formatDisplayPhone(e164: string): string {
  const digits = String(e164).replace(/\D/g, '')
  const local = digits.length >= 12 ? digits.slice(-10) : digits
  if (local.length !== 10) return digits
  return `+52 ${local.slice(0, 2)} ${local.slice(2, 6)} ${local.slice(6)}`
}
