import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_GIT_SHA || 'unknown'
  const env = process.env.VERCEL_ENV || process.env.NODE_ENV || 'development'
  const url = process.env.VERCEL_URL || 'localhost:3000'

  return NextResponse.json({
    version: '2026.07.29',
    commit: sha,
    environment: env,
    deployUrl: env === 'production' ? 'https://pet-euhz.vercel.app' : `https://${url}`,
    timestamp: new Date().toISOString(),
    projectId: 'pet-1cb0b',
  })
}
