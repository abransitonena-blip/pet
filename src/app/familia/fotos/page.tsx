'use client'

import { useRouter } from 'next/navigation'
import { Camera } from 'lucide-react'
import { Button, Card, EmptyState } from '@/components/ui'

export default function FotosPage() {
  const router = useRouter()
  return (
    <Card>
      <EmptyState
        icon={<Camera size={28} />}
        title="Fotos de paseos"
        description="Las fotos de los paseos de tu peludo aparecerán aquí."
        action={<Button size="sm" onClick={() => router.push('/familia/nueva-reserva')}>Reservar un paseo</Button>}
      />
    </Card>
  )
}
