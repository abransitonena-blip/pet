import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const sha = process.env.GIT_COMMIT_SHA || process.env.CF_PAGES_COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_GIT_SHA || 'unknown'
  const environment = process.env.DEPLOYMENT_ENV || process.env.CF_PAGES_BRANCH || process.env.VERCEL_ENV || process.env.NODE_ENV || 'development'

  return NextResponse.json({
    version: '2026.08.08',
    commit: sha,
    environment,
    timestamp: new Date().toISOString(),
  }, {
    headers: { 'Cache-Control': 'private, no-store, max-age=0', 'X-Robots-Tag': 'noindex, nofollow' },
  })
}
