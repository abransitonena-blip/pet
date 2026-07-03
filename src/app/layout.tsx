import type { Metadata } from 'next'
import { Inter, Playfair_Display } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'PetCare Quebrada | Reserva el mejor cuidado para tu mascota',
  description:
    'Servicios profesionales de cuidado para mascotas en Zona Quebrada, Cuautitlán. Baño, corte, guardería y más. Precios accesibles.',
  keywords: [
    'cuidado de mascotas',
    'baño para perros',
    'Cuautitlán',
    'zona quebrada',
    'pet care',
    'reservas mascotas',
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className={`${inter.variable} ${playfair.variable}`}>
      <body className="min-h-screen bg-dark overflow-x-hidden">
        {children}
      </body>
    </html>
  )
}
