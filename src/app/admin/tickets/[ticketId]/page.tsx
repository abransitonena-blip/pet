'use client'

import { useParams } from 'next/navigation'
import AdminTicketDetail from '@/components/admin/AdminTicketDetail'

export default function AdminTicketPage() {
  const params = useParams<{ ticketId: string }>()
  return <AdminTicketDetail ticketId={params.ticketId} />
}

