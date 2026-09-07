import type { MetadataRoute } from 'next'
import { absoluteUrl, SITE_URL } from '@/lib/siteUrl'

export function createRobots(siteUrl = SITE_URL): MetadataRoute.Robots {
  return {
    rules: [{
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin', '/admin/', '/familia', '/familia/', '/walker', '/walker/',
        '/supervisor', '/supervisor/', '/equipo', '/login', '/cancelar',
        '/api/', '/mi-cuenta', '/mi-cuenta/', '/paseador', '/paseador/',
        '/__/auth/', '/auth/',
      ],
    }],
    sitemap: absoluteUrl('/sitemap.xml', siteUrl),
    host: siteUrl,
  }
}

export default function robots(): MetadataRoute.Robots {
  return createRobots()
}
