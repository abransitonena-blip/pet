import type { Metadata } from 'next'
import { publicPageMetadata } from '@/lib/seoMetadata'
import TerminosContent from './TerminosContent'

export const metadata: Metadata = publicPageMetadata({ path: '/terminos', title: 'Términos y condiciones', description: 'Borrador operativo de términos para solicitudes, cancelaciones, privacidad y prestación de paseos.' })

export default function TerminosPage() {
  return <TerminosContent />
}
