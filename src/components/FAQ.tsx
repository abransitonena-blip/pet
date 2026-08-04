'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, HelpCircle } from 'lucide-react'
import { useConfig } from '@/context/ConfigContext'
import { DEFAULT_CONFIG } from '@/lib/defaultConfig'

const DEFAULT_FAQS = DEFAULT_CONFIG.faq.map((f) => ({ q: f.question, a: f.answer }))

export default function FAQ() {
  const { config } = useConfig()
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const faqs = config.faq.length > 0 ? config.faq.map((f: { question: string; answer: string }) => ({ q: f.question, a: f.answer })) : DEFAULT_FAQS

  return (
    <section id="faq" className="relative py-24 sm:py-32">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.32 }}
          className="text-center mb-16"
        >
          <span className="text-primary-hover text-sm uppercase tracking-widest font-medium">
            Resolvemos tus dudas
          </span>
          <h2 className="section-title mt-3">
            Preguntas <span className="gradient-text">frecuentes</span>
          </h2>
        </motion.div>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                aria-expanded={openIndex === i}
                aria-controls={`faq-answer-${i}`}
                className="w-full glass-card p-4 sm:p-5 text-left flex items-center justify-between gap-4 transition-all hover:bg-ink/5"
              >
                <span className="flex items-center gap-3 text-sm sm:text-base font-medium" style={{ color: 'var(--text-primary)' }}>
                  <HelpCircle className="text-primary shrink-0" size={14} />
                  {faq.q}
                </span>
                <motion.div
                  animate={{ rotate: openIndex === i ? 180 : 0 }}
                  transition={{ duration: 0.22 }}
                  className="shrink-0"
                >
                  <ChevronDown style={{ color: 'var(--text-muted)' }} size={12} />
                </motion.div>
              </button>
              <AnimatePresence>
                {openIndex === i && (
                  <motion.div
                    id={`faq-answer-${i}`}
                    role="region"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 sm:px-5 pb-4 pt-2 text-sm leading-relaxed border-t mx-4 sm:mx-5" style={{ color: 'var(--text-secondary)', borderColor: 'var(--border)' }}>
                      {faq.a}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
