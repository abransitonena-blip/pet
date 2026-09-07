import type { MetadataRoute } from 'next'
import { absoluteUrl, SITE_URL } from '@/lib/siteUrl'

const PUBLIC_PATHS = ['/', '/nosotros', '/preguntas-frecuentes', '/privacidad', '/terminos'] as const

export function createSitemap(siteUrl = SITE_URL): MetadataRoute.Sitemap {
  return PUBLIC_PATHS.map((path) => ({
    url: absoluteUrl(path, siteUrl),
    changeFrequency: path === '/' ? 'weekly' : 'monthly',
    priority: path === '/' ? 1 : path === '/privacidad' || path === '/terminos' ? 0.4 : 0.7,
  }))
}

export default function sitemap(): MetadataRoute.Sitemap {
  return createSitemap()
}
