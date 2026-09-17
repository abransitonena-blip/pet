/* eslint-disable react-refresh/only-export-components */
'use client'

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react'
import { auth } from '@/firebase/config'
import { loadFirestore, watchDocument } from '@/firebase/lazyFirestore'
import { DEFAULT_CONFIG, type SiteConfig } from '@/lib/defaultConfig'
import { brand } from '@/lib/brand'
import { withoutUndefined } from '@/lib/withoutUndefined'

export const CONFIG_STALE_MESSAGE = 'Los precios y config del sitio están desactualizados'

interface ConfigContextType {
  config: SiteConfig
  updateConfig: (partial: Partial<SiteConfig>) => Promise<void>
  saving: boolean
  configError: string | null
  saveError: string | null
  saved: boolean
}

const ConfigContext = createContext<ConfigContextType>({
  config: DEFAULT_CONFIG,
  updateConfig: async () => {},
  saving: false,
  configError: null,
  saveError: null,
  saved: false,
})

function normalizeConfig(raw: Partial<SiteConfig>): SiteConfig {
  const merged = { ...DEFAULT_CONFIG, ...raw }
  // El contacto comercial es identidad de marca, no configuración operativa remota.
  // Esto evita que un appSettings/public antiguo vuelva a publicar un número obsoleto.
  const whatsappE164 = brand.whatsapp
  const displayPhone = brand.displayPhone

  const reservedSubtitles = ['RESERVA', 'reserva', 'RESERVAS', 'Reserva', 'Paseos', 'Servicios', 'FAQ', 'Contacto']
  if (reservedSubtitles.includes(merged.heroSubtitle?.trim() || '')) {
    merged.heroSubtitle = DEFAULT_CONFIG.heroSubtitle
  }
  if ((merged.heroSubtitle?.length ?? 0) < 10) {
    merged.heroSubtitle = DEFAULT_CONFIG.heroSubtitle
  }

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
    analyticsEnabled: merged.analyticsEnabled === true,
  }
}

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<SiteConfig>(DEFAULT_CONFIG)
  const [saving, setSaving] = useState(false)
  const [configError, setConfigError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const saveLocked = useRef(false)

  useEffect(() => {
    return watchDocument(['appSettings', 'public'], (data) => {
      if (!data) {
        setConfigError(CONFIG_STALE_MESSAGE)
        return
      }
      setConfig(normalizeConfig(data as Partial<SiteConfig>))
      setConfigError(null)
    }, (err) => {
      console.error('Error loading appSettings/public:', err)
      setConfigError(CONFIG_STALE_MESSAGE)
    })
  }, [])

  const updateConfig = useCallback(
    async (partial: Partial<SiteConfig>) => {
      if (saveLocked.current) return
      saveLocked.current = true
      setSaving(true)
      setSaveError(null)
      setSaved(false)
      try {
        if (!auth.currentUser) throw new Error('auth-required')
        const { db, doc, setDoc, serverTimestamp } = await loadFirestore()
        const next = normalizeConfig({ ...config, ...partial })
        // Only replace explicitly edited top-level fields. A stale local copy
        // must not overwrite another administrator's unrelated sections.
        const normalized = withoutUndefined(next)
        const patch = Object.fromEntries(Object.keys(partial)
          .filter((key) => Object.hasOwn(normalized, key))
          .map((key) => [key, normalized[key as keyof typeof normalized]]))
        await setDoc(doc(db, 'appSettings', 'public'), {
          ...patch,
          updatedAt: serverTimestamp(),
          updatedBy: auth.currentUser.uid,
        }, { mergeFields: [...Object.keys(patch), 'updatedAt', 'updatedBy'] })
        // The listener remains the source of truth; do not replace its newer data.
        setSaved(true)
      } catch (e) {
        const code = e && typeof e === 'object' && 'code' in e ? e.code : null
        setSaveError(code === 'permission-denied'
          ? 'No tienes permiso para guardar esta configuración. No se guardaron los cambios.'
          : 'No pudimos guardar la configuración. Conserva tus cambios y vuelve a intentarlo.')
      } finally {
        saveLocked.current = false
        setSaving(false)
      }
    },
    [config]
  )

  return (
    <ConfigContext.Provider value={{ config, updateConfig, saving, configError, saveError, saved }}>
      {children}
    </ConfigContext.Provider>
  )
}

export function useConfig() {
  return useContext(ConfigContext)
}
