import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Providers from '@/components/Providers'
import { BUSINESS_HOURS } from '@/lib/defaultConfig'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://pet-euhz.vercel.app'
const siteName = 'PET Ap'
const siteDescription = '🐾 Paseos supervisados con fotos, mapa y reporte en tiempo real. Tu perro merece más que un paseo. Zona Quebrada, Cuautitlán.'
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  name: 'Paseos Quebrada',
  description: siteDescription,
  url: siteUrl,
  telephone: '+525523053772',
  image: `${siteUrl}/og-image.png`,
  areaServed: {
    '@type': 'City',
    name: 'Cuautitlán',
    sameAs: 'https://es.wikipedia.org/wiki/Cuautitl%C3%A1n',
  },
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Cuautitlán',
    addressRegion: 'Estado de México',
    addressCountry: 'MX',
  },
  openingHoursSpecification: [
    { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], opens: BUSINESS_HOURS.lunes!.open, closes: BUSINESS_HOURS.lunes!.close },
    { '@type': 'OpeningHoursSpecification', dayOfWeek: 'Saturday', opens: BUSINESS_HOURS.sabado!.open, closes: BUSINESS_HOURS.sabado!.close },
  ],
  priceRange: '$$',
  sameAs: [
    'https://www.instagram.com/pet___ap',
  ],
}

export const metadata: Metadata = {
  title: {
    default: 'PET Ap | Paseos caninos con tecnología en Cuautitlán',
    template: '%s | PET Ap',
  },
  description: siteDescription,
  keywords: [
    'paseos para perros',
    'Cuautitlán',
    'zona quebrada',
    'paseos caninos',
    'cuidado de perros',
    'paseador de perros',
    'paseo canino cuautitlan',
    'pet ap',
    'paseos quebrada',
  ],
  authors: [{ name: 'PET Ap' }],
  metadataBase: new URL(siteUrl),
  openGraph: {
    title: 'PET Ap | Tu perro merece más que un paseo',
    description: '🐾 Paseos supervisados con fotos, mapa y reporte en tiempo real. Desde $30.',
    url: siteUrl,
    siteName: 'PET Ap',
    locale: 'es_MX',
    type: 'website',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PET Ap | Tu perro merece más que un paseo',
    description: '🐾 Paseos supervisados con fotos, mapa y reporte en tiempo real.',
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
    <html lang="es" className={inter.variable} data-theme="dark">
      <head>
        <link rel="canonical" href={siteUrl} />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" type="image/svg+xml" href="/icons/icon-192.svg" />
        <meta name="theme-color" content="#D97706" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="PET Ap" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="geo.region" content="MX-MEX" />
        <meta name="geo.placename" content="Cuautitlán" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-HQTMCZX66M" />
        <script dangerouslySetInnerHTML={{
          __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','G-HQTMCZX66M');`
        }} />
      </head>
      <body className="min-h-screen overflow-x-hidden" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
