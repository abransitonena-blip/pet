import { createRobots } from '@/app/robots'
import { createSitemap } from '@/app/sitemap'
import {
  LOCAL_SITE_URL,
  normalizeSiteUrl,
  PRODUCTION_SITE_URL,
} from '@/lib/siteUrl'

describe('P0 canonical production URL', () => {
  test('uses and normalizes a valid HTTPS production variable', () => {
    expect(normalizeSiteUrl('  https://pet-euhz.vercel.app//private?source=preview#section  ', 'production'))
      .toBe(PRODUCTION_SITE_URL)
  })

  test('uses the approved production fallback when the variable is absent', () => {
    expect(normalizeSiteUrl(undefined, 'production')).toBe(PRODUCTION_SITE_URL)
    expect(normalizeSiteUrl('', 'production')).toBe(PRODUCTION_SITE_URL)
  })

  test('keeps localhost only in local development', () => {
    expect(normalizeSiteUrl(undefined, 'development')).toBe(LOCAL_SITE_URL)
    expect(normalizeSiteUrl('http://localhost:3000/path?draft=1', 'development')).toBe(LOCAL_SITE_URL)
    expect(normalizeSiteUrl('http://localhost:3000', 'production')).toBe(PRODUCTION_SITE_URL)
  })

  test('fails closed for invalid, insecure or credentialed production URLs', () => {
    for (const value of [
      'not-a-url',
      'http://pet-euhz.vercel.app',
      'https://user:password@pet-euhz.vercel.app',
    ]) {
      expect(normalizeSiteUrl(value, 'production')).toBe(PRODUCTION_SITE_URL)
    }
  })

  test('publishes the exact production host and sitemap URL in robots', () => {
    const result = createRobots(PRODUCTION_SITE_URL)

    expect(result.host).toBe(PRODUCTION_SITE_URL)
    expect(result.sitemap).toBe(`${PRODUCTION_SITE_URL}/sitemap.xml`)
  })

  test('keeps private routes out of the production sitemap', () => {
    const urls = createSitemap(PRODUCTION_SITE_URL).map((entry) => entry.url)

    expect(urls.length).toBeGreaterThan(0)
    expect(urls.every((url) => url.startsWith(PRODUCTION_SITE_URL))).toBe(true)
    expect(urls.join('\n')).not.toMatch(/\/(admin|familia|walker|supervisor|equipo|login|api)(?:\/|$)/)
  })

  test('cannot emit localhost in production SEO artifacts', () => {
    const productionUrl = normalizeSiteUrl(undefined, 'production')
    const artifacts = JSON.stringify({
      metadataBase: productionUrl,
      robots: createRobots(productionUrl),
      sitemap: createSitemap(productionUrl),
    })

    expect(artifacts).not.toContain('localhost')
    expect(artifacts).not.toContain('127.0.0.1')
  })
})
