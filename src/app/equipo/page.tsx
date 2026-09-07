import type { Metadata } from 'next'
import EquipoClient from './EquipoClient'
import { PRIVATE_METADATA } from '@/lib/seoMetadata'

export const metadata: Metadata = {
  ...PRIVATE_METADATA,
  title: 'Acceso al equipo',
}

export default function EquipoPage() {
  return <EquipoClient />
}
