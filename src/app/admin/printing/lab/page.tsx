import type { Metadata } from 'next'
import PrintingLab from '@/components/admin/PrintingLab'

export const metadata: Metadata = {
  title: 'Laboratorio de impresión | PET Ap',
  robots: { index: false, follow: false },
}

export default function AdminPrintingLabPage() {
  return <PrintingLab />
}
