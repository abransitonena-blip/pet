import type { Metadata } from 'next'
import LazyPrintingLab from './LazyPrintingLab'

export const metadata: Metadata = {
  title: 'Laboratorio de impresión | PET Ap',
  robots: { index: false, follow: false },
}

export default function AdminPrintingLabPage() {
  return <LazyPrintingLab />
}
