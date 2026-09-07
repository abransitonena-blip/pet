'use client'

import { useState, useEffect, useCallback } from 'react'
import { collection, doc, getDocs, limit as firestoreLimit, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { auth } from '@/firebase/config'
import { FEATURE_FLAGS } from '@/lib/featureFlags'

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

export type WalletTransactionsResult =
  | { status: 'success'; transactions: WalletTransaction[] }
  | { status: 'unavailable' | 'permission-denied' | 'network-error'; transactions: null }

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
        setError('No pudimos consultar tus Créditos PET')
      }
    )

    return unsub
  }, [])

  const getTransactions = useCallback(async (maxResults = 20): Promise<WalletTransactionsResult> => {
    const user = auth.currentUser
    if (!user) return { status: 'permission-denied', transactions: null }
    try {
      const snapshot = await getDocs(query(
        collection(db, 'wallets', user.uid, 'transactions'),
        orderBy('createdAt', 'desc'),
        firestoreLimit(Math.min(Math.max(maxResults, 1), 50))
      ))
      return {
        status: 'success',
        transactions: snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as WalletTransaction)),
      }
    } catch (cause) {
      const code = typeof cause === 'object' && cause && 'code' in cause ? String(cause.code) : ''
      return {
        status: code.includes('permission-denied') ? 'permission-denied' : code.includes('unavailable') ? 'network-error' : 'unavailable',
        transactions: null,
      }
    }
  }, [])

  const deduct = useCallback(async (amount: number, concept: string, reservationId?: string): Promise<boolean> => {
    void amount
    void concept
    void reservationId
    if (!FEATURE_FLAGS.WALLET_MUTATIONS_ENABLED) return false
    throw new Error('Wallet mutations require a trusted backend')
  }, [])

  return { wallet, loading, error, getTransactions, deduct }
}
