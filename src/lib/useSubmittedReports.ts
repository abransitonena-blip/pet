'use client'

import { useEffect, useState } from 'react'
import { collection, getDocs, limit, query, where } from 'firebase/firestore'
import { db } from '@/firebase/db'
import { FEATURE_FLAGS } from '@/lib/featureFlags'

/**
 * Cuáles de estos paseos ya tienen su reporte enviado.
 *
 * El paseo no guarda si su reporte salió: eso vive en `walkReports`. Sin esta
 * consulta, el panel llamaba "pendientes" a los completados recientes aunque su
 * reporte ya se hubiera mandado.
 *
 * La regla deja listar al paseador sólo sus propios reportes, así que la
 * consulta filtra por `walkerId`. Pregunta por diez paseos como máximo, el mismo
 * tope que usa Insights para `in`.
 *
 * Si la consulta falla, el estado es `unknown`: la pantalla no debe afirmar que
 * falta un reporte que no pudo comprobar.
 */
export const REPORT_LOOKUP_LIMIT = 10

export type SubmittedReports =
  | { state: 'loading' }
  | { state: 'ready'; submitted: ReadonlySet<string> }
  | { state: 'unknown' }

export function useSubmittedReports(walkerId: string, sessionIds: readonly string[]): SubmittedReports {
  const ids = sessionIds.slice(0, REPORT_LOOKUP_LIMIT)
  const key = ids.join('|')
  const [result, setResult] = useState<SubmittedReports>({ state: 'loading' })

  useEffect(() => {
    if (!FEATURE_FLAGS.WALK_REPORTS_ENABLED || !walkerId) {
      setResult({ state: 'unknown' })
      return
    }
    const wanted = key ? key.split('|') : []
    if (wanted.length === 0) {
      setResult({ state: 'ready', submitted: new Set() })
      return
    }
    let active = true
    setResult({ state: 'loading' })
    getDocs(query(
      collection(db, 'walkReports'),
      where('walkerId', '==', walkerId),
      where('walkSessionId', 'in', wanted),
      limit(REPORT_LOOKUP_LIMIT),
    ))
      .then((snapshot) => {
        if (!active) return
        const submitted = new Set<string>()
        snapshot.docs.forEach((reportDoc) => {
          const data = reportDoc.data()
          if (data.status === 'submitted' && typeof data.walkSessionId === 'string') submitted.add(data.walkSessionId)
        })
        setResult({ state: 'ready', submitted })
      })
      .catch(() => {
        if (active) setResult({ state: 'unknown' })
      })
    return () => { active = false }
  }, [walkerId, key])

  return result
}
