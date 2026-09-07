import type { Metadata } from 'next'
import AdminTicketsList from '@/components/admin/AdminTicketsList'

export const metadata: Metadata = { title: 'Tickets internos | PET Ap', robots: { index: false, follow: false } }
export default function AdminTicketsPage() { return <AdminTicketsList /> }

