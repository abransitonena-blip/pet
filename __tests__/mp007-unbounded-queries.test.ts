import { readFileSync } from 'node:fs'

describe('MP-007: secondary modules never download a full collection', () => {
  test('PetAhoraRequestForm bounds its dogs/addresses lookups', () => {
    const source = readFileSync('src/components/PetAhoraRequestForm.tsx', 'utf8')
    expect(source).toContain("collection(db, 'dogs'), where('ownerId', '==', u.uid), limit(50)")
    expect(source).toContain("collection(db, 'addresses'), where('ownerId', '==', u.uid), limit(50)")
  })

  test('usePetAhoraDispatch bounds both walker-candidate lookups', () => {
    const source = readFileSync('src/lib/usePetAhoraDispatch.ts', 'utf8')
    // Source is walkerProfiles, not the `walkers` collection this used to
    // read: nothing ever wrote to that one, so dispatch always came back empty.
    const matches = source.match(/collection\(db, 'walkerProfiles'\).*?limit\(50\)\)\)/g) || []
    expect(matches.length).toBe(2)
    expect(source).not.toContain("collection(db, 'walkers')")
  })
})
