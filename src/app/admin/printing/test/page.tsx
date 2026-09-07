import type { Metadata } from 'next'
import TicketPrintTool from '@/components/admin/TicketPrintTool'

export const metadata: Metadata = {
  title: 'Prueba de impresión | PET Ap',
  robots: { index: false, follow: false },
}

export default function AdminPrintingTestPage() {
  return <TicketPrintTool />
}
