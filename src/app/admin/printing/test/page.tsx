import type { Metadata } from 'next'
import LazyTicketPrintTool from './LazyTicketPrintTool'

export const metadata: Metadata = {
  title: 'Prueba de impresión | PET Ap',
  robots: { index: false, follow: false },
}

export default function AdminPrintingTestPage() {
  return <LazyTicketPrintTool />
}
