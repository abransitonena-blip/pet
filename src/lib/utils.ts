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

export const WHATSAPP_NUMBER = '5215523053772'

export function getWhatsAppLink(message: string) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`
}
