'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { DEFAULT_CONFIG, type SiteConfig } from '@/lib/defaultConfig'

interface ConfigContextType {
  config: SiteConfig
  updateConfig: (partial: Partial<SiteConfig>) => Promise<void>
  saving: boolean
}

const ConfigContext = createContext<ConfigContextType>({
  config: DEFAULT_CONFIG,
  updateConfig: async () => {},
  saving: false,
})

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<SiteConfig>(DEFAULT_CONFIG)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    try {
      const unsub = onSnapshot(doc(db, 'admin', 'config'), (snap) => {
        if (snap.exists()) {
          setConfig((prev) => ({ ...prev, ...snap.data() } as SiteConfig))
        }
      })
      return unsub
    } catch { return () => {} }
  }, [])

  const updateConfig = async (partial: Partial<SiteConfig>) => {
    setSaving(true)
    try {
      await setDoc(doc(db, 'admin', 'config'), { ...config, ...partial })
      setConfig((prev) => ({ ...prev, ...partial }))
    } catch (e) { console.error('Error updating config:', e) }
    setSaving(false)
  }

  return (
    <ConfigContext.Provider value={{ config, updateConfig, saving }}>
      {children}
    </ConfigContext.Provider>
  )
}

export function useConfig() {
  return useContext(ConfigContext)
}
