import type { Metadata } from 'next'
import HomeClient from './HomeClient'
import { publicPageMetadata } from '@/lib/seoMetadata'

export const metadata: Metadata = publicPageMetadata({
  path: '/',
  title: 'Paseos caninos personalizados',
  description: 'Conoce los paseos programados de PET Ap y gestiona tus solicitudes desde Familia PET.',
})

export default function HomePage() {
  return <HomeClient />
}
