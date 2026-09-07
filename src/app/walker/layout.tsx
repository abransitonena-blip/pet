import type { Metadata } from 'next'
import { PRIVATE_METADATA } from '@/lib/seoMetadata'
import WalkerLayoutClient from './WalkerLayoutClient'

export const metadata: Metadata = PRIVATE_METADATA

export default function WalkerLayout({ children }: { children: React.ReactNode }) {
  return <WalkerLayoutClient>{children}</WalkerLayoutClient>
}
