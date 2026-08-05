'use client'

/* eslint-disable react-refresh/only-export-components */

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { doc, onSnapshot, setDoc, serverTimestamp, type DocumentSnapshot, type DocumentData } from 'firebase/firestore'
import { db, auth } from '@/firebase/config'
import {
  DEFAULT_BRAND_DOC,
  normalizeBrandDoc,
  normalizePreset,
  applyBrandPreset,
  type BrandDoc,
  type BrandPreset,
} from '@/lib/brandPresets'

interface BrandContextValue {
  published: BrandPreset
  draft: BrandPreset | null
  editing: BrandPreset
  previewing: boolean
  publishedVersion: number
  draftVersion: number
  saving: boolean
  hasUnpublishedChanges: boolean
  updateDraft: (partial: Partial<BrandPreset>) => void
  saveDraft: () => Promise<void>
  publish: () => Promise<void>
  discardDraft: () => Promise<void>
  togglePreview: () => void
}

const BrandContext = createContext<BrandContextValue>({
  published: DEFAULT_BRAND_DOC.published,
  draft: null,
  editing: DEFAULT_BRAND_DOC.published,
  previewing: false,
  publishedVersion: 1,
  draftVersion: 0,
  saving: false,
  hasUnpublishedChanges: false,
  updateDraft: () => {},
  saveDraft: async () => {},
  publish: async () => {},
  discardDraft: async () => {},
  togglePreview: () => {},
})

export function BrandProvider({ children }: { children: ReactNode }) {
  const [published, setPublished] = useState<BrandPreset>(DEFAULT_BRAND_DOC.published)
  const [draft, setDraft] = useState<BrandPreset | null>(null)
  const [editing, setEditing] = useState<BrandPreset>(DEFAULT_BRAND_DOC.published)
  const [previewing, setPreviewing] = useState(false)
  const [publishedVersion, setPublishedVersion] = useState(1)
  const [draftVersion, setDraftVersion] = useState(0)
  const [saving, setSaving] = useState(false)

  // Subscribe to appSettings/public.brand
  useEffect(() => {
    let unsub: () => void = () => {}
    let cancelled = false

    const onSnap = (snap: DocumentSnapshot<DocumentData>) => {
      if (cancelled) return
      const raw = snap.exists() ? snap.data()?.brand : null
      const doc = raw ? normalizeBrandDoc(raw) : DEFAULT_BRAND_DOC
      setPublished(doc.published)
      setDraft(doc.draft)
      setPublishedVersion(doc.publishedVersion)
      setDraftVersion(doc.draftVersion)
      setEditing(doc.draft || doc.published)
    }

    try {
      unsub = onSnapshot(doc(db, 'appSettings', 'public'), onSnap, (err) => {
        console.error('Error loading brand settings:', err)
      })
    } catch (err) {
      console.error('Error subscribing to brand settings:', err)
    }

    return () => {
      cancelled = true
      unsub()
    }
  }, [])

  // Apply effective preset (published normally, editing while previewing)
  const applied = previewing ? editing : published
  useEffect(() => {
    applyBrandPreset(applied)
  }, [applied])

  const persist = useCallback(async (brand: Partial<BrandDoc>) => {
    setSaving(true)
    try {
      await setDoc(
        doc(db, 'appSettings', 'public'),
        { brand, updatedAt: serverTimestamp(), updatedBy: auth.currentUser?.uid ?? null },
        { merge: true }
      )
    } catch (e) {
      console.error('Error saving brand settings:', e)
    }
    setSaving(false)
  }, [])

  const updateDraft = useCallback((partial: Partial<BrandPreset>) => {
    setEditing((prev) => normalizePreset({ ...prev, ...partial }))
  }, [])

  const saveDraft = useCallback(async () => {
    setDraft(editing)
    await persist({ draft: editing, draftVersion: draftVersion + 1 })
  }, [editing, draftVersion, persist])

  const publish = useCallback(async () => {
    const nextVersion = Math.max(draftVersion, publishedVersion) + 1
    setPublished(editing)
    setDraft(null)
    setDraftVersion(0)
    setPreviewing(false)
    await persist({ published: editing, publishedVersion: nextVersion, draft: null, draftVersion: 0 })
  }, [editing, draftVersion, publishedVersion, persist])

  const discardDraft = useCallback(async () => {
    setEditing(published)
    setDraft(null)
    setDraftVersion(0)
    setPreviewing(false)
    await persist({ draft: null, draftVersion: 0 })
  }, [published, persist])

  const togglePreview = useCallback(() => {
    setPreviewing((prev) => !prev)
  }, [])

  const hasUnpublishedChanges = !draft ? false : JSON.stringify(draft) !== JSON.stringify(published)

  return (
    <BrandContext.Provider
      value={{
        published,
        draft,
        editing,
        previewing,
        publishedVersion,
        draftVersion,
        saving,
        hasUnpublishedChanges,
        updateDraft,
        saveDraft,
        publish,
        discardDraft,
        togglePreview,
      }}
    >
      {applied.font === 'inter' && (
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" />
      )}
      {children}
    </BrandContext.Provider>
  )
}

export function useBrand() {
  return useContext(BrandContext)
}
