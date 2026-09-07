import type { Metadata } from 'next'
import PublicFAQ from './PublicFAQ'
import { publicPageMetadata } from '@/lib/seoMetadata'

export const metadata: Metadata = publicPageMetadata({ path: '/preguntas-frecuentes', title: 'Preguntas frecuentes', description: 'Información sobre solicitudes, horarios, pagos y operación de los paseos programados.' })

export default function PreguntasFrecuentesPage() {
  return <PublicFAQ />
}
