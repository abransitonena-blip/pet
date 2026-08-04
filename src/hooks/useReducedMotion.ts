'use client'

import { useEffect, useState } from 'react'
import { useReducedMotion as useFramerReducedMotion } from 'framer-motion'

export function useReducedMotion(): boolean {
  const framerReduced = useFramerReducedMotion()
  const [systemReduced, setSystemReduced] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setSystemReduced(mq.matches)
    const handler = (e: MediaQueryListEvent) => setSystemReduced(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return framerReduced || systemReduced
}