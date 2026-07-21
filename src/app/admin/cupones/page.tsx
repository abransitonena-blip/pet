'use client'

import AdminCoupons from '@/components/AdminCoupons'

export default function AdminCuponesPage() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Cupones de Descuento
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Crea y gestiona cupones de descuento para tus clientes
        </p>
      </div>
      <AdminCoupons />
    </div>
  )
}
