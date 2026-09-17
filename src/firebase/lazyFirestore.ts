/**
 * Firestore, cargado cuando hace falta y no antes.
 *
 * Los tres contextos que envuelven TODA la app (configuración, marca y precios)
 * escuchan un documento público. Al importar Firestore de forma estática metían
 * su SDK -- unos 90 kB comprimidos -- en la primera carga de cada pantalla,
 * incluidas las públicas, que es la que ve alguien que entra por primera vez.
 *
 * Con esto el SDK llega en segundo plano: la pantalla ya se dibujó con los
 * valores por omisión y se actualiza cuando el documento llega.
 */
export async function loadFirestore() {
  const [{ db }, firestore] = await Promise.all([
    import('@/firebase/db'),
    import('firebase/firestore'),
  ])
  return { db, ...firestore }
}

/**
 * Escucha un documento y avisa de sus cambios. Devuelve la función para dejar
 * de escuchar, que funciona también si se llama antes de que el SDK cargue.
 */
export function watchDocument(
  path: [string, string],
  onData: (data: Record<string, unknown> | null) => void,
  onError: (error: unknown) => void,
): () => void {
  let unsub: (() => void) | undefined
  let cancelled = false
  void loadFirestore()
    .then(({ db, doc, onSnapshot }) => {
      if (cancelled) return
      unsub = onSnapshot(doc(db, path[0], path[1]), (snapshot) => {
        if (!cancelled) onData(snapshot.exists() ? snapshot.data() : null)
      }, (error) => {
        if (!cancelled) onError(error)
      })
    })
    .catch(onError)
  return () => {
    cancelled = true
    unsub?.()
  }
}
