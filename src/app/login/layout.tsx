import type { Metadata } from 'next'
import { PRIVATE_METADATA } from '@/lib/seoMetadata'

export const metadata: Metadata = {
  ...PRIVATE_METADATA,
  title: 'Acceso a Familia PET',
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children
}
