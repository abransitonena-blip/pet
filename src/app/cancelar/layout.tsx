import type { Metadata } from 'next'
import { PRIVATE_METADATA } from '@/lib/seoMetadata'

export const metadata: Metadata = {
  ...PRIVATE_METADATA,
  title: 'Ayuda con una cancelación',
}

export default function CancellationLayout({ children }: { children: React.ReactNode }) {
  return children
}
