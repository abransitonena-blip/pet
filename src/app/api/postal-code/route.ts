import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

/**
 * Autocompletado de código postal mexicano.
 *
 * The lookup runs here rather than in the browser for two reasons: the page's
 * Content-Security-Policy allows `connect-src 'self'` only, so a direct call
 * from the client would be blocked; and routing it through the server means
 * the visitor's browser never contacts the third party, so only a bare postal
 * code leaves this deployment -- no identity, no address, no session.
 *
 * The source is Zippopotam.us, which is free and needs no account or tax ID.
 * It is a convenience: every failure returns an empty result so the address
 * form falls back to plain typing instead of blocking the customer.
 */

const POSTAL_CODE_PATTERN = /^\d{5}$/
const UPSTREAM_TIMEOUT_MS = 4000

export interface PostalCodeLookup {
  readonly postalCode: string
  readonly city: string
  readonly state: string
  readonly places: readonly string[]
}

export async function GET(request: Request) {
  const postalCode = new URL(request.url).searchParams.get('cp')?.trim() ?? ''
  if (!POSTAL_CODE_PATTERN.test(postalCode)) {
    return NextResponse.json({ code: 'invalid-postal-code' }, { status: 400 })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)
  try {
    const response = await fetch(`https://api.zippopotam.us/MX/${postalCode}`, {
      signal: controller.signal,
      // Postal codes never change mid-session; a day of caching keeps the
      // upstream call rare without the data going stale in any practical way.
      next: { revalidate: 86_400 },
    })
    if (!response.ok) {
      return NextResponse.json({ code: 'not-found', postalCode, places: [] }, { status: 404 })
    }

    const data = await response.json() as {
      places?: Array<{ 'place name'?: unknown; state?: unknown }>
    }
    const places = (data.places ?? [])
      .map((place) => (typeof place['place name'] === 'string' ? place['place name'] : ''))
      .filter((name): name is string => name.length > 0)
    const state = data.places?.map((place) => place.state).find((value): value is string => typeof value === 'string') ?? ''

    const result: PostalCodeLookup = {
      postalCode,
      // Zippopotam returns colonias in `place name` for Mexico; the municipio
      // is not a separate field, so we do not invent one.
      city: '',
      state,
      places,
    }
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ code: 'lookup-unavailable', postalCode, places: [] }, { status: 503 })
  } finally {
    clearTimeout(timeout)
  }
}
