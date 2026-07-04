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

const siteUrl = 'https://pet-euhz.vercel.app'

export const metadata: Metadata = {
  title: {
    default: 'Paseos Quebrada | Paseos caninos en Zona Quebrada, Cuautitlán',
    template: '%s | Paseos Quebrada',
  },
  description:
    '🐾 Paseos supervisados para perros en Zona Quebrada, Cuautitlán. Precios accesibles desde $80, horario flexible Lunes a Sábado. Ejercicio y diversión para tu mejor amigo.',
  keywords: [
    'paseos para perros',
    'Cuautitlán',
    'zona quebrada',
    'paseos caninos',
    'cuidado de perros',
    'paseador de perros',
    'paseo canino cuautitlan',
    'cuautitlan izcalli',
    'paseos quebrada',
  ],
  authors: [{ name: 'Paseos Quebrada' }],
  metadataBase: new URL(siteUrl),
  openGraph: {
    title: 'Paseos Quebrada | Paseos caninos en Zona Quebrada',
    description:
      '🐾 Paseos supervisados para perros en Zona Quebrada, Cuautitlán. Desde $80. Ejercicio y diversión garantizados.',
    url: siteUrl,
    siteName: 'Paseos Quebrada',
    locale: 'es_MX',
    type: 'website',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Paseos Quebrada | Paseos caninos en Zona Quebrada',
    description:
      '🐾 Paseos supervisados para perros en Zona Quebrada, Cuautitlán. Desde $80.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className={`${inter.variable} ${playfair.variable}`} data-theme="dark">
      <head>
        <link rel="canonical" href={siteUrl} />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#e67e22" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Paseos Q" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="geo.region" content="MX-MEX" />
        <meta name="geo.placename" content="Cuautitlán" />
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-HQTMCZX66M" />
        <script dangerouslySetInnerHTML={{
          __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','G-HQTMCZX66M');`
        }} />
      </head>
      <body className="min-h-screen overflow-x-hidden" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
        {children}
      </body>
    </html>
  )
}
