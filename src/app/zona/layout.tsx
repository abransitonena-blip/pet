import type { Metadata } from 'next'
import { PRIVATE_METADATA } from '@/lib/seoMetadata'
import LazyZonaLayoutClient from './LazyZonaLayoutClient'

export const metadata: Metadata = PRIVATE_METADATA

export default function ZonaLayout({ children }: { children: React.ReactNode }) {
  return <LazyZonaLayoutClient>{children}</LazyZonaLayoutClient>
}
