'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { Dog, Zap, Camera, Calendar, MapPin, ChevronDown, ArrowRight, Sparkles, Clock } from 'lucide-react'
import { SERVICE_CATEGORIES, getQuote, Quote, QuoteRequest } from '@/lib/services'
import { Events } from '@/lib/analytics'
import QuoteResult from './QuoteResult'

interface ZoneOption {
  id: string
  name: string
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  cotidiano: Dog,
  energia: Zap,
  acompanamiento: Camera,
  rutina: Calendar,
}

const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

export default function QuoteForm() {
  const [zones, setZones] = useState<ZoneOption[]>([])
  const [loadingZones, setLoadingZones] = useState(true)
  const [zonesError, setZonesError] = useState(false)
  const [zonesAttempt, setZonesAttempt] = useState(0)
  const [categoryId, setCategoryId] = useState('')
  const [zoneId, setZoneId] = useState('')
  const [dogCount, setDogCount] = useState(1)
  const [isUrgent, setIsUrgent] = useState(false)
  const [scheduleType, setScheduleType] = useState<'now' | 'schedule'>('now')
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [quote, setQuote] = useState<Quote | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState<'select' | 'quote'>('select')

  useEffect(() => {
    setLoadingZones(true)
    setZonesError(false)
    const q = query(collection(db, 'zones'), where('active', '==', true))
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: ZoneOption[] = snap.docs.map((d) => ({ id: d.id, name: d.data().name || d.id }))
        setZones(list)
        setLoadingZones(false)
      },
      (err) => {
        console.error('Error cargando zonas:', err)
        setZones([])
        setLoadingZones(false)
        setZonesError(true)
      }
    )
    return unsub
  }, [zonesAttempt])

  useEffect(() => {
    setQuote(null)
    setError('')
  }, [categoryId, zoneId, dogCount, isUrgent, scheduleType, scheduledDate, scheduledTime])

  const canQuote = categoryId && zoneId && dogCount > 0 && (scheduleType === 'now' || (scheduledDate && scheduledTime))

  const handleQuote = useCallback(async () => {
    if (!canQuote) return
    setLoading(true)
    setError('')
    try {
      const result = await getQuote({
        categoryId,
        zoneId,
        dogCount,
        duration: '',
        isUrgent,
        scheduleType,
        scheduledDate: scheduledDate || undefined,
        scheduledWindowStart: scheduledTime || undefined,
        scheduledWindowEnd: scheduledTime || undefined,
      })
      Events.quoteRequested(categoryId)
      setQuote(result)
      setStep('quote')
    } catch (e) {
      setError('Error al generar cotización. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }, [canQuote, categoryId, zoneId, dogCount, isUrgent, scheduleType, scheduledDate, scheduledTime])

  const handleBack = useCallback(() => {
    setStep('select')
    setQuote(null)
  }, [])

  const today = new Date().toISOString().split('T')[0]

  if (step === 'quote' && quote) {
    return <QuoteResult quote={quote} onBack={handleBack} />
  }

  const selectedCategory = SERVICE_CATEGORIES.find((c) => c.id === categoryId)

  return (
    <section aria-label="Cotización" id="cotizar" className="relative py-24 sm:py-32">
      <div className="section-container max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10"
        >
          <Sparkles className="mx-auto text-primary mb-3" size={24} />
          <h2 className="section-title">Cotiza tu paseo</h2>
          <p className="section-subtitle">
            Cuéntanos qué necesita tu perro y te daremos un precio claro, sin sorpresas.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="card p-6 sm:p-8"
        >
          <div className="space-y-6">
            {/* Category */}
            <div>
              <label className="input-label">Tipo de paseo</label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {SERVICE_CATEGORIES.map((cat) => {
                  const Icon = CATEGORY_ICONS[cat.id] || Dog
                  const isSelected = categoryId === cat.id
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setCategoryId(cat.id)}
                      className={`relative flex flex-col items-center gap-1.5 p-3 rounded-xl border text-sm font-medium transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-muted hover:border-hover hover:text-ink'
                      }`}
                    >
                      <Icon size={20} />
                      <span className="text-xs leading-tight text-center">{cat.name}</span>
                      {isSelected && (
                        <motion.div
                          layoutId="category-check"
                          className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center"
                        >
                          <span className="text-2xs">✓</span>
                        </motion.div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Zone */}
            <div>
              <label className="input-label">
                <MapPin size={14} className="inline mr-1" />
                Zona
              </label>
              <select
                value={zoneId}
                onChange={(e) => setZoneId(e.target.value)}
                className="input mt-2"
                disabled={loadingZones || zonesError || zones.length === 0}
                aria-busy={loadingZones}
              >
                <option value="">Selecciona tu zona</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>{z.name}</option>
                ))}
              </select>
              {loadingZones && <p className="text-xs text-muted mt-1">Cargando zonas...</p>}
              {!loadingZones && zonesError && (
                <div className="mt-1">
                  <p className="text-xs text-error">No pudimos cargar las zonas. Verifica tu conexión e inténtalo de nuevo.</p>
                  <button
                    onClick={() => setZonesAttempt((n) => n + 1)}
                    className="text-xs text-primary underline mt-1"
                  >
                    Reintentar
                  </button>
                </div>
              )}
              {!loadingZones && !zonesError && zones.length === 0 && (
                <p className="text-xs text-warning mt-1">
                  Aún no tenemos zonas disponibles en tu área. Escríbenos por WhatsApp para agendar.
                </p>
              )}
            </div>

            {/* Dog count */}
            <div>
              <label className="input-label">Número de perros</label>
              <div className="flex items-center gap-3 mt-2">
                {[1, 2, 3, 4].map((n) => (
                  <button
                    key={n}
                    onClick={() => setDogCount(n)}
                    className={`w-12 h-12 rounded-xl border text-sm font-semibold transition-all ${
                      dogCount === n
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted hover:border-hover'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Schedule type */}
            <div>
              <label className="input-label">¿Cuándo lo necesitas?</label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <button
                  onClick={() => { setScheduleType('now'); setScheduledDate(''); setScheduledTime('') }}
                  className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-sm font-medium transition-all ${
                    scheduleType === 'now'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted hover:border-hover'
                  }`}
                >
                  <Clock size={16} />
                  Ahora / Hoy
                </button>
                <button
                  onClick={() => setScheduleType('schedule')}
                  className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-sm font-medium transition-all ${
                    scheduleType === 'schedule'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted hover:border-hover'
                  }`}
                >
                  <Calendar size={16} />
                  Agendar
                </button>
              </div>
            </div>

            {/* Schedule details */}
            <AnimatePresence>
              {scheduleType === 'schedule' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4 overflow-hidden"
                >
                  <div>
                    <label className="input-label">Fecha</label>
                    <input
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      min={today}
                      className="input mt-2"
                    />
                  </div>
                  <div>
                    <label className="input-label">Horario preferido</label>
                    <input
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="input mt-2"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Urgency */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-warning/5 border border-warning/10">
              <div className="flex items-start gap-3">
                <Zap className="text-warning shrink-0 mt-0.5" size={18} />
                <div>
                  <p className="text-sm font-medium text-ink">¿Lo necesitas urgente?</p>
                  <p className="text-xs text-muted">Puede tener un costo adicional</p>
                </div>
              </div>
              <button
                onClick={() => setIsUrgent(!isUrgent)}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  isUrgent ? 'bg-primary' : 'bg-border'
                }`}
              >
                <motion.div
                  animate={{ x: isUrgent ? 24 : 2 }}
                  className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm"
                />
              </button>
            </div>

            {/* Error */}
            {error && (
              <p className="text-sm text-error bg-error/10 p-3 rounded-xl">{error}</p>
            )}

            {/* Submit */}
            <button
              onClick={handleQuote}
              disabled={!canQuote || loading}
              className="btn-primary w-full inline-flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-ink/20 border-t-ink rounded-full animate-spin" />
                  Calculando...
                </span>
              ) : (
                <>
                  Cotizar <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </motion.div>

        {selectedCategory && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 text-center text-xs text-muted"
          >
            {selectedCategory.restrictions.map((r, i) => (
              <p key={i} className="flex items-center justify-center gap-1">
                <span>ℹ</span> {r}
              </p>
            ))}
          </motion.div>
        )}
      </div>
    </section>
  )
}
