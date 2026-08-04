'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { doc, onSnapshot, setDoc, serverTimestamp, type DocumentSnapshot, type DocumentData } from 'firebase/firestore'
import { db, auth } from '@/firebase/config'
import { DEFAULT_CONFIG, type SiteConfig } from '@/lib/defaultConfig'
import { brand } from '@/lib/brand'

export const CONFIG_STALE_MESSAGE = 'Los precios y config del sitio están desactualizados'

interface ConfigContextType {
  config: SiteConfig
  updateConfig: (partial: Partial<SiteConfig>) => Promise<void>
  saving: boolean
  configError: string | null
}

const ConfigContext = createContext<ConfigContextType>({
  config: DEFAULT_CONFIG,
  updateConfig: async () => {},
  saving: false,
  configError: null,
})

function normalizeConfig(raw: Partial<SiteConfig>): SiteConfig {
  const merged = { ...DEFAULT_CONFIG, ...raw }
  const whatsapp = String(merged.whatsapp || merged.whatsappE164 || brand.whatsapp).replace(/\D/g, '')
  const whatsappE164 = whatsapp.length === 12 ? whatsapp : brand.whatsapp
  const displayPhone = merged.displayPhone || `55 ${whatsappE164.slice(5, 9)} ${whatsappE164.slice(9)}`
  return {
    ...merged,
    whatsapp: whatsappE164,
    whatsappE164,
    displayPhone,
    contactEmail: merged.contactEmail || brand.email,
    brandName: merged.brandName || brand.name,
    instagram: merged.instagram || merged.instagramUrl || DEFAULT_CONFIG.instagram,
    instagramUrl: merged.instagramUrl || merged.instagram || DEFAULT_CONFIG.instagram,
    schemaVersion: 2,
    analyticsEnabled: merged.analyticsEnabled !== false,
  }
}

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<SiteConfig>(DEFAULT_CONFIG)
  const [saving, setSaving] = useState(false)
  const [configError, setConfigError] = useState<string | null>(null)

  useEffect(() => {
    let unsub: () => void = () => {}
    let cancelled = false

    const onSnap = (snap: DocumentSnapshot<DocumentData>) => {
      if (cancelled) return
      if (snap.exists()) {
        setConfig(normalizeConfig(snap.data() as Partial<SiteConfig>))
        setConfigError(null)
      } else {
        setConfigError(CONFIG_STALE_MESSAGE)
      }
    }

    try {
      unsub = onSnapshot(doc(db, 'appSettings', 'public'), onSnap, (err) => {
        console.error('Error loading appSettings/public:', err)
        if (!cancelled) setConfigError(CONFIG_STALE_MESSAGE)
      })
    } catch (err) {
      console.error('Error subscribing to appSettings/public:', err)
      setConfigError(CONFIG_STALE_MESSAGE)
    }

    return () => {
      cancelled = true
      unsub()
    }
  }, [])

  const updateConfig = useCallback(
    async (partial: Partial<SiteConfig>) => {
      setSaving(true)
      try {
        const next = normalizeConfig({ ...config, ...partial })
        await setDoc(doc(db, 'appSettings', 'public'), {
          ...next,
          updatedAt: serverTimestamp(),
          updatedBy: auth.currentUser?.uid ?? null,
        })
        setConfig(next)
        setConfigError(null)
      } catch (e) {
        console.error('Error updating config:', e)
      }
      setSaving(false)
    },
    [config]
  )

  return (
    <ConfigContext.Provider value={{ config, updateConfig, saving, configError }}>
      {children}
    </ConfigContext.Provider>
  )
}

export function useConfig() {
  return useContext(ConfigContext)
}
