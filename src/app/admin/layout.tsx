import type { Metadata } from 'next'
import { PRIVATE_METADATA } from '@/lib/seoMetadata'
import AdminLayoutClient from './AdminLayoutClient'

export const metadata: Metadata = PRIVATE_METADATA

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminLayoutClient>{children}</AdminLayoutClient>
}
