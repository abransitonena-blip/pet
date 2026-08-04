'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { doc, onSnapshot, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db, auth } from '@/firebase/config'
import { DEFAULT_CONFIG, type SiteConfig } from '@/lib/defaultConfig'
import { brand } from '@/lib/brand'

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

  useEffect(() => {
    let unsub: () => void = () => {}
    let cancelled = false

    const fallbackToLegacy = async () => {
      try {
        const legacy = await getDoc(doc(db, 'admin', 'config'))
        if (!cancelled && legacy.exists()) {
          setConfig(normalizeConfig(legacy.data() as Partial<SiteConfig>))
        }
      } catch {
        // no legacy config available — keep defaults
      }
    }

    try {
      unsub = onSnapshot(
        doc(db, 'appSettings', 'public'),
        (snap) => {
          if (snap.exists()) {
            setConfig(normalizeConfig(snap.data() as Partial<SiteConfig>))
          } else {
            void fallbackToLegacy()
          }
        },
        (err) => {
          console.error('Error loading appSettings/public:', err)
          void fallbackToLegacy()
        }
      )
    } catch {
      void fallbackToLegacy()
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
      } catch (e) {
        console.error('Error updating config:', e)
      }
      setSaving(false)
    },
    [config]
  )

  return (
    <ConfigContext.Provider value={{ config, updateConfig, saving }}>
      {children}
    </ConfigContext.Provider>
  )
}

export function useConfig() {
  return useContext(ConfigContext)
}
