'use client'

import { useParams } from 'next/navigation'
import WalkReportEditor from '@/components/walker/WalkReportEditor'
import WalkRouteMap from '@/components/walks/WalkRouteMap'

/**
 * La bitácora del paseo y, debajo, el recorrido que quedó registrado.
 *
 * El paseador es quien caminó: si su teléfono no alcanzó a mandar lecturas, o si
 * el recorrido se salió de la zona, aquí lo ve -- en el mapa, no en una lista de
 * coordenadas. Es el mismo mapa que ve la familia en su reporte.
 */
export default function WalkerReportPage() {
  const params = useParams<{ sessionId: string }>()
  return (
    <div className="space-y-3">
      <WalkReportEditor sessionId={params.sessionId} />
      <WalkRouteMap sessionId={params.sessionId} />
    </div>
  )
}
