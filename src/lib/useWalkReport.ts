'use client'

import { useEffect, useState } from 'react'
import { doc, getDoc, onSnapshot, runTransaction, serverTimestamp, type DocumentData, type DocumentSnapshot, type FirestoreError } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { FEATURE_FLAGS } from '@/lib/featureFlags'
import {
  WALK_REPORT_SCHEMA_VERSION,
  validateWalkReportContent,
  walkReportId,
  type WalkReport,
  type WalkReportContent,
} from '@/lib/walkReports'

export type WalkReportReadState = 'loading' | 'empty' | 'success' | 'permission-denied' | 'network-error' | 'unavailable'

function readError(error: FirestoreError): WalkReportReadState {
  return error.code === 'permission-denied' ? 'permission-denied' : 'network-error'
}

export function useWalkReport(sessionId: string, mode: 'once' | 'live' = 'once') {
  const [report, setReport] = useState<WalkReport | null>(null)
  const [state, setState] = useState<WalkReportReadState>(FEATURE_FLAGS.WALK_REPORTS_ENABLED ? 'loading' : 'unavailable')

  useEffect(() => {
    if (!FEATURE_FLAGS.WALK_REPORTS_ENABLED || !sessionId) {
      setState('unavailable')
      setReport(null)
      return
    }
    const reportRef = doc(db, 'walkReports', walkReportId(sessionId))
    const applySnapshot = (snapshot: DocumentSnapshot<DocumentData>) => {
      setReport(snapshot.exists() ? (snapshot.data() as WalkReport) : null)
      setState(snapshot.exists() ? 'success' : 'empty')
    }
    const applyError = (error: FirestoreError) => {
      setReport(null)
      setState(readError(error))
    }
    setState('loading')
    if (mode === 'live') return onSnapshot(reportRef, applySnapshot, applyError)
    let active = true
    void getDoc(reportRef).then((snapshot) => {
      if (active) applySnapshot(snapshot)
    }).catch((error: FirestoreError) => {
      if (active) applyError(error)
    })
    return () => { active = false }
  }, [mode, sessionId])

  return { report, state }
}

export async function persistWalkReport(input: {
  sessionId: string
  content: WalkReportContent
  mode: 'draft' | 'submit'
}): Promise<'draft' | 'submitted'> {
  if (!FEATURE_FLAGS.WALK_REPORTS_ENABLED) throw new Error('walk-reports-unavailable')
  const errors = validateWalkReportContent(input.content, input.mode)
  if (errors.length > 0) throw new Error(errors[0])

  const sessionId = walkReportId(input.sessionId)
  const reportRef = doc(db, 'walkReports', sessionId)
  const sessionRef = doc(db, 'walkSessions', sessionId)
  return runTransaction(db, async (transaction) => {
    const [sessionSnapshot, reportSnapshot] = await Promise.all([
      transaction.get(sessionRef),
      transaction.get(reportRef),
    ])
    if (!sessionSnapshot.exists()) throw new Error('walk-session-not-found')
    if (reportSnapshot.exists() && reportSnapshot.data().status === 'submitted') {
      throw new Error('walk-report-already-submitted')
    }
    if (input.mode === 'submit' && sessionSnapshot.data().status !== 'completed') {
      throw new Error('walk-session-not-completed')
    }

    const session = sessionSnapshot.data()
    const timestamp = serverTimestamp()
    const stable = {
      walkSessionId: sessionId,
      orderId: session.orderId,
      customerId: session.customerId,
      walkerId: session.walkerId,
      dogIds: session.dogIds,
      createdBy: session.walkerId,
      schemaVersion: WALK_REPORT_SCHEMA_VERSION,
    }
    const status: 'draft' | 'submitted' = input.mode === 'submit' ? 'submitted' : 'draft'
    const mutable = {
      ...input.content,
      mediaReferences: [],
      status,
      updatedAt: timestamp,
      submittedAt: input.mode === 'submit' ? timestamp : null,
    }
    if (reportSnapshot.exists()) transaction.update(reportRef, mutable)
    else transaction.set(reportRef, { ...stable, ...mutable, createdAt: timestamp })
    return mutable.status
  })
}
