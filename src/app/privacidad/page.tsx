import type { Metadata } from 'next'
import { publicPageMetadata } from '@/lib/seoMetadata'
import PrivacidadContent from './PrivacidadContent'

export const metadata: Metadata = publicPageMetadata({ path: '/privacidad', title: 'Aviso de privacidad', description: 'Borrador operativo sobre datos, finalidades, proveedores, retención y solicitudes ARCO de PET Ap.' })

export default function PrivacidadPage() {
  return <PrivacidadContent />
}
