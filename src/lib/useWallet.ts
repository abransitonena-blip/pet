'use client'

import { useState, useEffect, useCallback } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { auth } from '@/firebase/config'
import { getFunctions, httpsCallable } from 'firebase/functions'

export interface WalletData {
  balance: number
  totalTopUp: number
  totalDeducted: number
  status: string
}

export interface WalletTransaction {
  id: string
  type: 'topup' | 'deduction'
  amount: number
  balanceBefore: number
  balanceAfter: number
  concept: string
  reservationId?: string
  createdBy: string
  createdAt: { seconds: number; nanoseconds: number } | null
}

const functions = getFunctions()

export function useWallet() {
  const [wallet, setWallet] = useState<WalletData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const user = auth.currentUser
    if (!user) {
      setLoading(false)
      return
    }

    const unsub = onSnapshot(
      doc(db, 'wallets', user.uid),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as WalletData
          setWallet(data)
        } else {
          setWallet({ balance: 0, totalTopUp: 0, totalDeducted: 0, status: 'active' })
        }
        setLoading(false)
      },
      () => {
        setLoading(false)
        setError('Error al cargar billetera')
      }
    )

    return unsub
  }, [])

  const getTransactions = useCallback(async (limit = 20): Promise<WalletTransaction[]> => {
    try {
      const fn = httpsCallable(functions, 'getWalletTransactions')
      const result = await fn({ limit })
      return (result.data as { transactions: WalletTransaction[] }).transactions
    } catch {
      return []
    }
  }, [])

  const deduct = useCallback(async (amount: number, concept: string, reservationId?: string): Promise<boolean> => {
    try {
      const fn = httpsCallable(functions, 'deductFromWallet')
      const result = await fn({ amount, concept, reservationId: reservationId || '' })
      return (result.data as { success: boolean }).success
    } catch {
      return false
    }
  }, [])

  return { wallet, loading, error, getTransactions, deduct }
}
