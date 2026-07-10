'use client'

import { motion } from 'framer-motion'
import { useRef, type ReactNode } from 'react'

const container = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12 },
  },
}

const child = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
}

export function SectionContainer({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef(null)
  return (
    <motion.div
      ref={ref}
      variants={container}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-80px' }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export function SectionChild({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <motion.div variants={child} className={className}>
      {children}
    </motion.div>
  )
}
