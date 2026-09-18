'use client'

import AdminCoupons from '@/components/AdminCoupons'
import PageHeader from '@/components/ui/PageHeader'

export default function AdminCuponesPage() {
  return (
    <div>
      <PageHeader
        title="Cupones de Descuento"
        description="Crea y gestiona cupones de descuento para tus clientes"
      />
      <AdminCoupons />
    </div>
  )
}
