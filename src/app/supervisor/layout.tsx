import type { Metadata } from 'next'
import { PRIVATE_METADATA } from '@/lib/seoMetadata'
import SupervisorLayoutClient from './SupervisorLayoutClient'

export const metadata: Metadata = PRIVATE_METADATA

export default function SupervisorLayout({ children }: { children: React.ReactNode }) {
  return <SupervisorLayoutClient>{children}</SupervisorLayoutClient>
}
