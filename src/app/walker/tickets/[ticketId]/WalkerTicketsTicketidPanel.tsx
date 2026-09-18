'use client'

import { useParams } from 'next/navigation'
import TicketReadOnlyPage from '@/components/tickets/TicketReadOnlyPage'

export default function WalkerTicketPage() {
  const params = useParams<{ ticketId: string }>()
  return <TicketReadOnlyPage ticketId={params.ticketId} backHref="/walker/historial" />
}

