import type { Metadata } from 'next'
import LazyTicketsList from './LazyTicketsList'

export const metadata: Metadata = { title: 'Tickets internos | PET Ap', robots: { index: false, follow: false } }
export default function AdminTicketsPage() { return <LazyTicketsList /> }

