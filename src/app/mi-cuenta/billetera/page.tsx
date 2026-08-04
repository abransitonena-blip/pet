'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Wallet, ArrowUpRight, ArrowDownRight, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { useWallet, WalletTransaction } from '@/lib/useWallet'

function TransactionRow({ tx }: { tx: WalletTransaction }) {
  const isTopup = tx.type === 'topup'
  const date = tx.createdAt
    ? new Date(tx.createdAt.seconds * 1000).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : ''

  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
          isTopup ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
        }`}>
          {isTopup ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
        </div>
        <div>
          <p className="text-sm font-medium text-ink">{tx.concept}</p>
          <p className="text-2xs text-muted">{date}</p>
        </div>
      </div>
      <span className={`text-sm font-semibold ${isTopup ? 'text-success' : 'text-warning'}`}>
        {isTopup ? '+' : ''}{tx.amount.toLocaleString('es-MX')} MXN
      </span>
    </div>
  )
}

export default function BilleteraPage() {
  const { wallet, loading, error, getTransactions } = useWallet()
  const [transactions, setTransactions] = useState<WalletTransaction[]>([])
  const [txLoading, setTxLoading] = useState(true)

  useEffect(() => {
    getTransactions(30).then((txs) => {
      setTransactions(txs)
      setTxLoading(false)
    })
  }, [getTransactions])

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/mi-cuenta" className="w-9 h-9 rounded-xl card flex items-center justify-center text-muted hover:text-ink transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-ink">Billetera</h1>
          <p className="text-sm text-muted">Saldo y movimientos</p>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="card p-6 mb-6"
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-2xl bg-trust/10 flex items-center justify-center text-trust">
            <Wallet size={24} />
          </div>
          <div>
            <p className="text-sm text-muted">Saldo disponible</p>
            {loading ? (
              <div className="skeleton h-8 w-28 mt-1" />
            ) : (
              <p className="text-3xl font-bold text-ink">
                ${(wallet?.balance ?? 0).toLocaleString('es-MX')}
              </p>
            )}
          </div>
        </div>
        <p className="text-xs text-muted mt-2">MXN · Las cargas se reflejan inmediatamente</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="card p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-ink">Movimientos</h2>
          <button
            onClick={() => { setTxLoading(true); getTransactions(30).then(setTransactions).finally(() => setTxLoading(false)) }}
            className="text-xs text-primary-hover transition-colors flex items-center gap-1"
          >
            <RefreshCw size={12} />
            Actualizar
          </button>
        </div>

        {txLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="skeleton w-9 h-9 rounded-xl shrink-0" />
                <div className="flex-1">
                  <div className="skeleton h-4 w-32 mb-1" />
                  <div className="skeleton h-3 w-20" />
                </div>
                <div className="skeleton h-4 w-16" />
              </div>
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-8">
            <Wallet size={32} className="mx-auto text-muted mb-2" />
            <p className="text-sm text-muted">Sin movimientos aún</p>
            <p className="text-xs text-muted mt-1">Los movimientos aparecerán aquí cuando cargues o uses saldo.</p>
          </div>
        ) : (
          <div>
            {transactions.map((tx) => (
              <TransactionRow key={tx.id} tx={tx} />
            ))}
          </div>
        )}
      </motion.div>

      {error && (
        <div className="mt-4 p-3 rounded-xl bg-error/10 text-sm text-error">{error}</div>
      )}
    </div>
  )
}
