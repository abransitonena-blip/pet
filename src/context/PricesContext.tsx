'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { SERVICES } from '@/lib/services'

const DEFAULT_PRICES = Object.fromEntries(SERVICES.map((s) => [s.name, s.price]))

interface PricesContextType {
  prices: Record<string, number>
  savePrices: (newPrices: Record<string, number>) => Promise<void>
}

const PricesContext = createContext<PricesContextType>({
  prices: DEFAULT_PRICES,
  savePrices: async () => {},
})

export function PricesProvider({ children }: { children: ReactNode }) {
  const [prices, setPrices] = useState<Record<string, number>>(DEFAULT_PRICES)

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'admin', 'prices'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Record<string, number>
        setPrices((prev) => ({ ...prev, ...data }))
      }
    })
    return unsub
  }, [])

  const savePrices = async (newPrices: Record<string, number>) => {
    await setDoc(doc(db, 'admin', 'prices'), newPrices)
    setPrices(newPrices)
  }

  return (
    <PricesContext.Provider value={{ prices, savePrices }}>
      {children}
    </PricesContext.Provider>
  )
}

export function usePrices() {
  return useContext(PricesContext)
}

export { DEFAULT_PRICES }
