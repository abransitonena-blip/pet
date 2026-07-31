import type { Metadata } from 'next'
import PublicFAQ from './PublicFAQ'

export const metadata: Metadata = {
  title: 'Preguntas Frecuentes',
  description: 'Resuelve tus dudas sobre paseos caninos, reservas, pagos y más. Horarios, cancelaciones, requisitos y todo lo que necesitas saber.',
  openGraph: {
    title: 'Preguntas Frecuentes | PET Ap',
    description: 'Resuelve tus dudas sobre paseos caninos, reservas, pagos y más.',
  },
}

export default function PreguntasFrecuentesPage() {
  return <PublicFAQ />
}
