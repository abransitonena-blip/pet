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
  title: 'Paseos Quebrada | Paseos caninos en Zona Quebrada, Cuautitlán',
  description:
    'Paseos supervisados para perros en Zona Quebrada, Cuautitlán. Precios accesibles, horario flexible. Ejercicio y diversión para tu mejor amigo.',
  keywords: [
    'paseos para perros',
    'Cuautitlán',
    'zona quebrada',
    'paseos caninos',
    'cuidado de perros',
    'paseador de perros',
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
