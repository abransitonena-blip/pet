'use client'

import { useEffect, useRef } from 'react'

export function useEscapeKey(handler: () => void, enabled = true) {
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    if (!enabled) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handlerRef.current()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [enabled])
}
