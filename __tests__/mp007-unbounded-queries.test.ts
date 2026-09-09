import { readFileSync } from 'node:fs'

describe('MP-007: secondary modules never download a full collection', () => {
  test('PetAhoraRequestForm bounds its dogs/addresses lookups', () => {
    const source = readFileSync('src/components/PetAhoraRequestForm.tsx', 'utf8')
    expect(source).toContain("collection(db, 'dogs'), where('ownerId', '==', u.uid), limit(50)")
    expect(source).toContain("collection(db, 'addresses'), where('ownerId', '==', u.uid), limit(50)")
  })

  test('el despacho de PET Ahora acota sus candidatos y no corre en el navegador', () => {
    // Matching moved to the server: the Firestore rules never allowed a
    // customer's browser to create an offer, so the client-side dispatch could
    // only ever strand the request. The bound still has to exist, now on the
    // privileged read.
    const client = readFileSync('src/lib/usePetAhoraDispatch.ts', 'utf8')
    const server = readFileSync('src/lib/petAhora/dispatchServer.ts', 'utf8')

    expect(client).not.toMatch(/collection\(db, 'walkers'\)|collection\(db, 'walkerProfiles'\)/)
    expect(client).not.toContain("collection(db, 'petAhoraOffers')")
    expect(client).toContain("'/api/pet-ahora/dispatch'")
    expect(server).toContain(".collection('walkerProfiles')")
    expect(server).toContain('.limit(MAX_CANDIDATES)')
    expect(server).toContain('const MAX_CANDIDATES = 50')
  })
})
