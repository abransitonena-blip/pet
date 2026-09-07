'use client'

import { Wallet, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react'
import { useWallet } from '@/lib/useWallet'
import Link from 'next/link'

export default function WalletCard({ compact = false }: { compact?: boolean }) {
  const { wallet, loading } = useWallet()

  if (loading) {
    return (
      <div className="card p-4">
        <div className="skeleton h-5 w-24 mb-2" />
        <div className="skeleton h-8 w-32" />
      </div>
    )
  }

  if (!wallet) return null

  const formatCredits = (amount: number) => `${amount.toLocaleString('es-MX')} créditos`

  if (compact) {
    return (
      <Link href="/familia/billetera" className="card card-interactive p-4 flex items-center justify-between group">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-trust/10 flex items-center justify-center text-trust">
            <Wallet size={18} />
          </div>
          <div>
            <p className="text-xs text-muted">Créditos PET</p>
            <p className="text-lg font-bold text-ink">{formatCredits(wallet.balance)}</p>
          </div>
        </div>
        <ArrowRight size={16} className="text-muted group-hover:text-primary transition-colors" />
      </Link>
    )
  }

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-trust/10 flex items-center justify-center text-trust">
            <Wallet size={24} />
          </div>
          <div>
            <p className="text-sm text-muted">Créditos PET disponibles</p>
            <p className="text-2xl font-bold text-ink">{formatCredits(wallet.balance)}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-xl bg-success/5 flex items-center gap-2">
          <TrendingUp size={14} className="text-success shrink-0" />
          <div>
            <p className="text-2xs text-muted">Créditos registrados</p>
            <p className="text-sm font-semibold text-ink">{formatCredits(wallet.totalTopUp)}</p>
          </div>
        </div>
        <div className="p-3 rounded-xl bg-warning/5 flex items-center gap-2">
          <TrendingDown size={14} className="text-warning shrink-0" />
          <div>
            <p className="text-2xs text-muted">Créditos utilizados</p>
            <p className="text-sm font-semibold text-ink">{formatCredits(wallet.totalDeducted)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
