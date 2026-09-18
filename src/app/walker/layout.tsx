import type { Metadata } from 'next'
import { PRIVATE_METADATA } from '@/lib/seoMetadata'
import LazyWalkerLayout from './LazyWalkerLayout'

export const metadata: Metadata = PRIVATE_METADATA

export default function WalkerLayout({ children }: { children: React.ReactNode }) {
  return <LazyWalkerLayout>{children}</LazyWalkerLayout>
}
