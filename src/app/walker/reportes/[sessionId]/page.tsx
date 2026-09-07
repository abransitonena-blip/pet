'use client'

import { useParams } from 'next/navigation'
import WalkReportEditor from '@/components/walker/WalkReportEditor'

export default function WalkerReportPage() {
  const params = useParams<{ sessionId: string }>()
  return <WalkReportEditor sessionId={params.sessionId} />
}
