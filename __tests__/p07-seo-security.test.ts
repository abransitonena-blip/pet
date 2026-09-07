/** @jest-environment node */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import robots from '../src/app/robots'
import sitemap from '../src/app/sitemap'
import { PRIVATE_METADATA, publicPageMetadata } from '../src/lib/seoMetadata'

const root = join(__dirname, '..')
const read = (path: string) => readFileSync(join(root, path), 'utf8')

function filesUnder(path: string): string[] {
  const absolute = join(root, path)
  return readdirSync(absolute).flatMap((entry) => {
    const full = join(absolute, entry)
    return statSync(full).isDirectory() ? filesUnder(relative(root, full)) : [relative(root, full)]
  })
}

describe('P0.7 canonical SEO sources', () => {
  test('robots and sitemap each have one Next.js source', () => {
    expect(existsSync(join(root, 'src/app/robots.ts'))).toBe(true)
    expect(existsSync(join(root, 'src/app/sitemap.ts'))).toBe(true)
    for (const obsolete of ['src/app/robots.txt', 'public/robots.txt', 'src/app/sitemap.xml', 'public/sitemap.xml']) {
      expect(existsSync(join(root, obsolete))).toBe(false)
    }
  })

  test('robots excludes private, auth, legacy and API routes', () => {
    const result = robots()
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules]
    const disallow = rules.flatMap((rule) => rule.disallow || [])
    expect(disallow).toEqual(expect.arrayContaining([
      '/admin', '/familia', '/walker', '/supervisor', '/equipo', '/login', '/cancelar', '/api/', '/__/auth/',
    ]))
  })

  test('sitemap contains only real public indexable routes and no invented dates', () => {
    const urls = sitemap().map((entry) => new URL(entry.url).pathname)
    expect(urls).toEqual(['/', '/nosotros', '/preguntas-frecuentes', '/privacidad', '/terminos'])
    expect(urls.some((path) => ['/admin', '/familia', '/walker', '/supervisor', '/login', '/equipo', '/cancelar'].some((prefix) => path.startsWith(prefix)))).toBe(false)
    expect(sitemap().every((entry) => entry.lastModified === undefined)).toBe(true)
  })

  test('public metadata has a page-specific canonical independent of query parameters', () => {
    const metadata = publicPageMetadata({ path: '/nosotros', title: 'Cómo trabajamos', description: 'Descripción' })
    expect(String(metadata.alternates?.canonical)).toMatch(/\/nosotros$/)
    expect(String(metadata.alternates?.canonical)).not.toContain('?')
  })

  test('private metadata is noindex and private route layouts use it', () => {
    expect(PRIVATE_METADATA.robots).toMatchObject({ index: false, follow: false })
    for (const route of ['admin', 'familia', 'walker', 'supervisor']) {
      expect(read(`src/app/${route}/layout.tsx`)).toContain('PRIVATE_METADATA')
    }
    expect(read('src/app/login/layout.tsx')).toContain('PRIVATE_METADATA')
    expect(read('src/app/cancelar/layout.tsx')).toContain('PRIVATE_METADATA')
    expect(read('src/app/equipo/page.tsx')).toContain('PRIVATE_METADATA')
  })

  test('every indexable public page declares its own canonical', () => {
    const sources = {
      '/': read('src/app/page.tsx'),
      '/nosotros': read('src/app/nosotros/page.tsx'),
      '/preguntas-frecuentes': read('src/app/preguntas-frecuentes/page.tsx'),
      '/privacidad': read('src/app/privacidad/page.tsx'),
      '/terminos': read('src/app/terminos/page.tsx'),
    }
    for (const [path, source] of Object.entries(sources)) {
      expect(source).toContain('publicPageMetadata')
      expect(source).toContain(`path: '${path}'`)
    }
    expect(read('src/app/layout.tsx')).not.toContain('rel="canonical"')
  })
})

describe('P0.7 CSP, headers and private caching', () => {
  const security = read('security-headers.js')
  const nextConfig = read('next.config.js')
  // CommonJS is intentional because Next loads the same module from next.config.js.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const productionCsp = (require('../security-headers') as { PRODUCTION_CSP: string }).PRODUCTION_CSP

  test('CSP is Report-Only locally and proposed production policy has no unsafe-eval', () => {
    expect(nextConfig).toContain('GLOBAL_SECURITY_HEADERS')
    expect(security).toContain('Content-Security-Policy-Report-Only')
    expect(productionCsp).not.toContain("'unsafe-eval'")
    expect(productionCsp).not.toMatch(/(?:^|\s)\*(?:\s|;|$)/)
    expect(productionCsp).toContain("object-src 'none'")
    expect(productionCsp).toContain("frame-ancestors 'none'")
    expect(productionCsp).toContain("base-uri 'self'")
    expect(productionCsp).toContain("form-action 'self'")
  })

  test('Google popup/GIS and Firebase hosts remain narrowly allowed', () => {
    for (const host of ['https://accounts.google.com', 'https://apis.google.com', 'https://www.gstatic.com', 'https://identitytoolkit.googleapis.com', 'https://securetoken.googleapis.com', 'https://firestore.googleapis.com']) {
      expect(productionCsp).toContain(host)
    }
    expect(security).toContain('same-origin-allow-popups')
  })

  test('retired hosts are absent from active hosting and security configuration', () => {
    const config = `${security}\n${nextConfig}\n${read('vercel.json')}`
    for (const host of ['placedog.net', 'pravatar', 'cloudfunctions.net', 'api.cloudinary.com', 'fonts.googleapis.com', 'fonts.gstatic.com', 'firebase-messaging-sw.js']) {
      expect(config).not.toContain(host)
    }
  })

  test('security headers and production-only HSTS are configured', () => {
    for (const header of ['X-Content-Type-Options', 'Referrer-Policy', 'Permissions-Policy', 'Cross-Origin-Opener-Policy', 'X-Frame-Options']) {
      expect(security).toContain(header)
    }
    expect(nextConfig).toContain("process.env.NODE_ENV === 'production'")
    expect(nextConfig).toContain('Strict-Transport-Security')
    expect(nextConfig).toContain('private, no-store, max-age=0')
  })

  test('private APIs explicitly return no-store responses', () => {
    expect(read('src/app/api/presence-offline/route.ts')).toContain('private, no-store, max-age=0')
    expect(read('src/app/api/version/route.ts')).toContain('private, no-store, max-age=0')
  })
})

describe('P0.7 routes, active content and PWA', () => {
  test('service worker does not cache navigation, query URLs, APIs or private HTML', () => {
    const worker = read('public/sw.js')
    expect(worker).toContain("e.request.mode === 'navigate'")
    expect(worker).toContain('url.search')
    expect(worker).toContain("'/api/'")
    expect(worker).toContain("'/familia'")
    expect(worker).not.toMatch(/const ASSETS = \[\s*'\/'/)
  })

  test('manifest has no shortcuts to disabled features and has explicit scope', () => {
    const manifest = JSON.parse(read('public/manifest.json')) as Record<string, unknown>
    expect(manifest.scope).toBe('/')
    expect(manifest.start_url).toBe('/')
    expect(manifest).not.toHaveProperty('shortcuts')
    expect(JSON.stringify(manifest)).not.toMatch(/PET Ahora|billetera|wallet|FCM/i)
  })

  test('active source contains no forbidden legacy place name', () => {
    const forbidden = ['Zona', 'Quebrada'].join(' ')
    const activeFiles = [...filesUnder('src'), ...filesUnder('public'), 'next.config.js', 'vercel.json', 'security-headers.js']
      .filter((path) => !path.includes('__tests__'))
    const matches = activeFiles.filter((path) => read(path).includes(forbidden))
    expect(matches).toEqual([])
  })

  test('literal internal links point to existing pages', () => {
    const appPages = filesUnder('src/app').filter((path) => path.endsWith('/page.tsx') || path === 'src/app/page.tsx')
    const routes = new Set(appPages.map((path) => {
      const route = path.replace(/^src\/app/, '').replace(/\/page\.tsx$/, '')
      return route || '/'
    }))
    const sourceFiles = filesUnder('src').filter((path) => /\.(ts|tsx)$/.test(path) && !path.includes('__tests__'))
    const missing = new Set<string>()
    const patterns = [/href\s*=\s*["'](\/[^"']*)["']/g, /href\s*:\s*["'](\/[^"']*)["']/g, /router\.(?:push|replace)\(\s*["'](\/[^"']*)["']/g]
    for (const path of sourceFiles) {
      const source = read(path)
      for (const pattern of patterns) {
        for (const match of Array.from(source.matchAll(pattern))) {
          const target = match[1].split(/[?#]/)[0] || '/'
          if (target.startsWith('/api/') || target.startsWith('/icons/') || target.startsWith('/brand/') || target === '/manifest.json') continue
          if (!routes.has(target)) missing.add(`${path} -> ${target}`)
        }
      }
    }
    expect(Array.from(missing)).toEqual([])
  })

  test('public pages have one meaningful h1 and schema has no simulated ratings or search', () => {
    const publicEntrySources = [
      `${read('src/app/HomeClient.tsx')}\n${read('src/components/Hero.tsx')}`,
      read('src/app/nosotros/page.tsx'),
      `${read('src/app/preguntas-frecuentes/page.tsx')}\n${read('src/app/preguntas-frecuentes/PublicFAQ.tsx')}`,
      read('src/app/privacidad/page.tsx'),
      read('src/app/terminos/page.tsx'),
    ]
    for (const source of publicEntrySources) expect(source.match(/<h1\b|<motion\.h1\b/g)).toHaveLength(1)
    const rootLayout = read('src/app/layout.tsx')
    expect(rootLayout).not.toMatch(/AggregateRating|SearchAction|ratingValue|reviewCount/)
  })

  test('version endpoint is provider-neutral and omits deployment URL and project ID', () => {
    const route = read('src/app/api/version/route.ts')
    expect(route).not.toContain('pet-euhz.vercel.app')
    expect(route).not.toContain('projectId')
    expect(route).not.toContain('deployUrl')
  })
})
