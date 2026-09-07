import type { Metadata, Viewport } from 'next'
import { Inter, Manrope } from 'next/font/google'
import './globals.css'
import Providers from '@/components/Providers'
import ConfigErrorBanner from '@/components/ConfigErrorBanner'
import PWARegister from '@/components/PWARegister'
import { SITE_URL } from '@/lib/siteUrl'

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const siteName = 'PET Ap'
const siteDescription = 'Solicita paseos caninos programados y consulta su estado desde Familia PET.'
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${SITE_URL}/#website`,
  url: SITE_URL,
  name: siteName,
  description: siteDescription,
  inLanguage: 'es-MX',
}

export const metadata: Metadata = {
  title: {
    default: 'PET Ap | Paseos caninos con tecnología',
    template: '%s | PET Ap',
  },
  description: siteDescription,
  keywords: [
    'paseos para perros',
    'paseos caninos',
    'cuidado de perros',
    'paseador de perros',
    'pet ap',
    'bienestar canino',
    'paseo canino',
  ],
  authors: [{ name: 'PET Ap' }],
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Paseos caninos programados',
    description: siteDescription,
    siteName: 'PET Ap',
    locale: 'es_MX',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Paseos caninos programados',
    description: siteDescription,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#FFF8F1',
  colorScheme: 'light',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es-MX" className={`${manrope.variable} ${inter.variable}`}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" type="image/png" href="/brand/pet-ap-dog-logo.png" />
        <meta name="theme-color" content="#FFF8F1" />
        <meta name="color-scheme" content="light only" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="PET Ap" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="geo.region" content="MX" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </head>
      <body className="min-h-screen overflow-x-hidden">
         <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[var(--z-overlay)] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-brand-500 focus:text-white focus:outline-none">
          Saltar al contenido principal
        </a>
        <Providers>
          <ConfigErrorBanner />
          <PWARegister />
          <main id="main-content">{children}</main>
        </Providers>
      </body>
    </html>
  )
}
