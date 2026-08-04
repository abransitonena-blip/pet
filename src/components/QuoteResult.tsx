'use client'

import { motion } from 'framer-motion'
import { ArrowLeft, CheckCircle, Clock, Info, ArrowRight, Zap } from 'lucide-react'
import { Quote } from '@/lib/services'
import { getCategory } from '@/lib/services'
import { WHATSAPP_NUMBER } from '@/lib/utils'
import { Events } from '@/lib/analytics'

interface QuoteResultProps {
  quote: Quote
  onBack: () => void
}

export default function QuoteResult({ quote, onBack }: QuoteResultProps) {
  const category = getCategory(quote.categoryId)
  const validUntil = new Date(quote.validUntil)

  const formatCurrency = (amount: number) =>
    `$${amount.toLocaleString('es-MX')}`

  return (
    <section aria-label="Cotización" id="cotizar" className="relative py-24 sm:py-32">
      <div className="section-container max-w-lg mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.32 }}
          className="text-center mb-10"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            className="w-16 h-16 rounded-2xl bg-success/10 flex items-center justify-center mx-auto mb-4"
          >
            <CheckCircle className="text-success" size={32} />
          </motion.div>
          <h2 className="section-title">Tu cotización</h2>
          <p className="section-subtitle">
            {category?.name || 'Paseo'} · Válida hasta {validUntil.toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="card p-6 sm:p-8"
        >
          {/* Total */}
          <div className="text-center mb-8">
            <p className="text-sm text-muted mb-1">Total estimado</p>
            <p className="text-4xl sm:text-5xl font-bold text-primary">
              {formatCurrency(quote.total)}
            </p>
            <p className="text-xs text-muted mt-2">{quote.currency} · IVA incluido</p>
          </div>

          {/* Breakdown */}
          <div className="space-y-3 mb-6">
            <div className="flex justify-between text-sm">
              <span className="text-muted">Subtotal</span>
              <span className="text-ink font-medium">{formatCurrency(quote.subtotal)}</span>
            </div>

            {quote.adjustments.map((adj, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-muted">{adj.concept}</span>
                <span className="text-ink font-medium">
                  {adj.amount > 0 ? '+' : ''}{formatCurrency(adj.amount)}
                </span>
              </div>
            ))}

            {quote.discount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-success">Descuento</span>
                <span className="text-success font-medium">-{formatCurrency(quote.discount)}</span>
              </div>
            )}

            <div className="flex justify-between text-sm">
              <span className="text-muted">IVA (8%)</span>
              <span className="text-ink font-medium">{formatCurrency(quote.taxes)}</span>
            </div>

            <div className="border-t border-border pt-3 mt-3 flex justify-between font-semibold">
              <span className="text-ink">Total</span>
              <span className="text-primary text-lg">{formatCurrency(quote.total)}</span>
            </div>
          </div>

          {/* Walker payout (privacy) */}
          <div className="p-3 rounded-xl bg-primary/5 text-xs text-muted flex items-start gap-2 mb-6">
            <Info size={14} className="shrink-0 mt-0.5 text-primary" />
            <span>Los paseadores reciben una compensación justa y transparente por cada paseo. Sin sorpresas para nadie.</span>
          </div>

          {/* Cancellation */}
          <div className="p-3 rounded-xl bg-warning/5 text-xs text-muted flex items-start gap-2 mb-8">
            <Clock size={14} className="shrink-0 mt-0.5 text-warning" />
            <span>{quote.cancellationPolicy}</span>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <motion.a
              href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
                `Hola! Quiero reservar un paseo (${category?.name || ''}). Mi cotización es de ${formatCurrency(quote.total)}.`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => Events.whatsappClick('cotizacion')}
              className="btn-primary w-full inline-flex items-center justify-center gap-2"
            >
              Reservar por WhatsApp <ArrowRight size={16} />
            </motion.a>

            <button
              onClick={onBack}
              className="btn-secondary w-full inline-flex items-center justify-center gap-2"
            >
              <ArrowLeft size={14} />
              Modificar cotización
            </button>
          </div>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          className="text-center text-xs text-muted mt-6"
        >
          Esta cotización es una estimación. El precio final puede variar según disponibilidad y condiciones del paseo.
        </motion.p>
      </div>
    </section>
  )
}
