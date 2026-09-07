import type { Metadata } from 'next'
import { PRIVATE_METADATA } from '@/lib/seoMetadata'
import FamilyLayoutClient from './FamilyLayoutClient'

export const metadata: Metadata = PRIVATE_METADATA

export default function FamilyLayout({ children }: { children: React.ReactNode }) {
  return <FamilyLayoutClient>{children}</FamilyLayoutClient>
}
