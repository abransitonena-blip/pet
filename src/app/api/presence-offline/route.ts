import { NextRequest, NextResponse } from 'next/server'
import { collection, doc, getDocs, writeBatch, serverTimestamp, query, where } from 'firebase/firestore'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'private, no-store, max-age=0', 'X-Robots-Tag': 'noindex, nofollow' },
  })
}

// En cola de sync para walkers offline — fetch local buffer, sube en lote, limpia tras éxito
//
// PROTECCIÓN (P0.8): el Bearer token es un ID token de Firebase Auth verificado con
// firebase-admin. La autorización se decide por el custom claim `role` del token
// (walker), nunca por un documento ni por parámetros del cliente. Falla cerrado.
export async function GET(request: NextRequest) {
  const from = request.nextUrl.searchParams.get('from') || undefined
  const to = request.nextUrl.searchParams.get('to') || undefined

  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return privateJson({ error: 'Unauthorized' }, 401)
    }

    const { verifyWalkerToken } = await import('@/lib/serverAuth')
    const uid = await verifyWalkerToken(authHeader.slice('Bearer '.length))
    if (!uid) {
      return privateJson({ error: 'Forbidden: walker only' }, 403)
    }

    const { db } = await import('@/firebase/db')
    const base = collection(db, 'presenceOffline')
    let q = query(base, where('processed', '==', false), where('walkerId', '==', uid))

    if (from && to) {
      q = query(q, where('timestamp', '>=', from), where('timestamp', '<=', to))
    }

    const snapshot = await getDocs(q)
    if (snapshot.empty) {
      return privateJson({ message: 'no pending offline items', synced: 0 })
    }

    const batch = writeBatch(db)
    snapshot.forEach(d => {
      const data = d.data()
      // Movemos a presenceHistory (conservando estado original) y marcamos como procesado
      const histRef = doc(collection(db, 'presenceHistory'))
      batch.set(histRef, {
        walkerId: data.walkerId,
        latitude: data.latitude,
        longitude: data.longitude,
        timestamp: data.timestamp,
        source: 'offline_sync',
        processedAt: serverTimestamp(),
        syncedAt: serverTimestamp(),
      })
      // Marcar original como procesado para no volver a subirlo
      batch.update(d.ref, { processed: true, syncedAt: serverTimestamp() })
    })

    await batch.commit()

    const synced = snapshot.size
    return privateJson({ synced, walkerId: uid })
  } catch {
    return privateJson({ error: 'Sync failed' }, 500)
  }
}
