import type { Metadata } from 'next'
import { PRIVATE_METADATA } from '@/lib/seoMetadata'
import LazySupervisorLayoutClient from './LazySupervisorLayoutClient'

export const metadata: Metadata = PRIVATE_METADATA

export default function SupervisorLayout({ children }: { children: React.ReactNode }) {
  return <LazySupervisorLayoutClient>{children}</LazySupervisorLayoutClient>
}
