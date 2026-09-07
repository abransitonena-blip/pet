import { readFileSync } from 'node:fs'

describe('MP-007: secondary modules never download a full collection', () => {
  test('PetAhoraRequestForm bounds its dogs/addresses lookups', () => {
    const source = readFileSync('src/components/PetAhoraRequestForm.tsx', 'utf8')
    expect(source).toContain("collection(db, 'dogs'), where('ownerId', '==', u.uid), limit(50)")
    expect(source).toContain("collection(db, 'addresses'), where('ownerId', '==', u.uid), limit(50)")
  })

  test('usePetAhoraDispatch bounds both walker-candidate lookups', () => {
    const source = readFileSync('src/lib/usePetAhoraDispatch.ts', 'utf8')
    const matches = source.match(/collection\(db, 'walkers'\).*?limit\(50\)\)\)/g) || []
    expect(matches.length).toBe(2)
  })
})
