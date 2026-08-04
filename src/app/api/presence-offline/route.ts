import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/firebase/config'
import { collection, doc, getDocs, writeBatch, serverTimestamp, query, where } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { Role } from '@/types'

// En cola de sync para walkers offline — fetch local buffer, sube en lote, limpia tras éxito
export async function GET(request: NextRequest) {
  const syncAll = request.nextUrl.searchParams.get('sync') === 'true'
  const from = request.nextUrl.searchParams.get('from') || undefined
  const to = request.nextUrl.searchParams.get('to') || undefined

  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.split(' ')[1]
    const decodedToken = await auth.verifyIdToken(token)
    const uid = decodedToken.uid

    const userDoc = await import('firebase/firestore').then(({ doc, getDoc }) => getDoc(doc(db, 'users', uid)))
    if (!userDoc.exists() || userDoc.data().role !== 'walker') {
      return NextResponse.json({ error: 'Forbidden: walker only' }, { status: 403 })
    }

    // Buffer local: 'presenceOffline' -> cola por walkerId + timestamp
    const base = collection(db, 'presenceOffline')
    let q = query(base, where('processed', '==', false), where('walkerId', '==', uid))

    if (from && to) {
      q = query(q, where('timestamp', '>=', from), where('timestamp', '<=', to))
    }

    const snapshot = await getDocs(q)
    if (snapshot.empty) {
      return NextResponse.json({ message: 'no pending offline items', synced: 0 })
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
    return NextResponse.json({ synced, walkerId: uid })
  } catch (e) {
    console.error('Presence offline sync error:', e)
    return NextResponse.json({ error: 'sync_failed' }, { status: 500 })
  }
}
