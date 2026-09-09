export const BRAND = {
  name: 'PET Ap',
  email: 'ap9871888@gmail.com',
  whatsapp: '525538231235',
  whatsappRaw: '5538231235',
  displayPhone: '+52 55 3823 1235',
  whatsappUrl: 'https://wa.me/525538231235',
  telUrl: 'tel:+525538231235',
  logoPath: '/brand/pet-ap-dog-logo.png',
  // Same silhouette with a real alpha channel and no white margin, used as a
  // CSS mask so the mark takes the brand colour instead of being black.
  markPath: '/brand/pet-ap-dog-mark.png',
  tagline: 'Bienestar para tu perro. Tranquilidad para ti.',
  description: 'Solicitudes y seguimiento de paseos caninos programados.',
} as const

export { BRAND as brand }
export const WHATSAPP_NUMBER = BRAND.whatsapp
