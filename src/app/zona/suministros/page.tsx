'use client'

import dynamic from 'next/dynamic'
import PanelFallback from '@/components/layout/PanelFallback'

const ZonaSuministrosPanel = dynamic(() => import('./ZonaSuministrosPanel'), {
  ssr: false,
  loading: () => <PanelFallback />,
})

export default function Page() {
  return <ZonaSuministrosPanel />
}
