'use client'

import { createContext, useContext, type ReactNode } from 'react'

export interface WalkerPanelProfile {
  name: string
  email: string
  phone: string
  status: string
  zones: string[]
  schedule: Record<string, { start: string; end: string }[]>
  maxDaily: number | null
  maxWeekly: number | null
  forcePasswordChange: boolean
}

interface WalkerPanelContextValue {
  uid: string
  profile: WalkerPanelProfile
  updateLocalProfile: (changes: Partial<WalkerPanelProfile>) => void
}

const WalkerPanelContext = createContext<WalkerPanelContextValue | null>(null)

export function WalkerPanelProvider({ value, children }: { value: WalkerPanelContextValue; children: ReactNode }) {
  return <WalkerPanelContext.Provider value={value}>{children}</WalkerPanelContext.Provider>
}

export function useWalkerPanel(): WalkerPanelContextValue {
  const value = useContext(WalkerPanelContext)
  if (!value) throw new Error('useWalkerPanel must be used inside WalkerPanelProvider')
  return value
}
