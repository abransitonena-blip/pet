import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const walkerId = request.nextUrl.searchParams.get('walkerId')
    if (!walkerId) {
      return NextResponse.json({ error: 'walkerId required' }, { status: 400 })
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true })
  }
}
