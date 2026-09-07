export const PRODUCTION_SITE_URL = 'https://pet-euhz.vercel.app'
export const LOCAL_SITE_URL = 'http://localhost:3000'

function fallbackSiteUrl(environment?: string): string {
  return environment === 'production' ? PRODUCTION_SITE_URL : LOCAL_SITE_URL
}

export function normalizeSiteUrl(value?: string, environment = process.env.NODE_ENV): string {
  const fallback = fallbackSiteUrl(environment)
  const candidate = value?.trim()
  if (!candidate) return fallback

  try {
    const parsed = new URL(candidate)
    if (parsed.username || parsed.password) return fallback

    const localHttp = parsed.protocol === 'http:' && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')
    const developmentLocalUrl = environment !== 'production' && localHttp
    if (parsed.protocol !== 'https:' && !developmentLocalUrl) return fallback

    return parsed.origin
  } catch {
    return fallback
  }
}

export const SITE_URL = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL, process.env.NODE_ENV)

export function absoluteUrl(pathname = '/', siteUrl = SITE_URL): string {
  return new URL(pathname, `${siteUrl}/`).toString()
}
