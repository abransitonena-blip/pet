// Dedup by stable id for lists assembled from multiple sources or pagination.
// Never replaces fixing the write path: a snapshot should be set wholesale.
export function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const item of items) {
    if (!seen.has(item.id)) {
      seen.add(item.id)
      out.push(item)
    }
  }
  return out
}
