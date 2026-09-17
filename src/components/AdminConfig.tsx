'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { motion, AnimatePresence } from 'framer-motion'
import { useConfig } from '@/context/ConfigContext'
import type { SiteConfig, Announcement } from '@/lib/defaultConfig'
import { mexicanObservanceShortcuts, type DateShortcut } from '@/lib/announcements'
import { mergeTermsSections } from '@/lib/termsContent'
import { mergePrivacySections } from '@/lib/privacyContent'
import { WALK_TIP_ICONS, walkTipIcon } from '@/lib/walkTipIcons'
import {
  ALWAYS_VISIBLE_PANEL,
  movePanel,
  orderedPanels,
  togglePanelId,
  type AdminPanelPreferences,
} from '@/lib/adminPanels'

type EditorProps = {
  config: SiteConfig
  updateConfig: (partial: Partial<SiteConfig>) => Promise<void>
  saving: boolean
}
import {
  Save,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from 'lucide-react'
import { BUSINESS_HOURS, generateTimeSlots } from '@/lib/defaultConfig'
/*
 * Los editores pesados se cargan cuando se abre su apartado, no al entrar a
 * Configuración.
 *
 * Sólo hay un apartado abierto a la vez -- y la pantalla abre con todos
 * cerrados -- así que traerlos los tres de entrada era pagar por adelantado
 * tres pantallas que quizá nadie abra. En un teléfono con datos, eso son
 * segundos en blanco antes de ver nada.
 */
const AdminServicePricing = dynamic(() => import('@/components/AdminServicePricing'), {
  loading: () => <div className="skeleton h-40 rounded-xl" />,
})
const AdminBookingSchedule = dynamic(() => import('@/components/AdminBookingSchedule'), {
  loading: () => <div className="skeleton h-40 rounded-xl" />,
})
import { BRAND } from '@/lib/brand'

type Section = 'prices' | 'booking' | 'hero' | 'social' | 'hours' | 'tips' | 'faq' | 'announcements' | 'terms' | 'privacy' | 'features' | 'maintenance' | 'brand' | 'panels'

/**
 * Configuración: catorce apartados que antes eran una pila plana de títulos.
 *
 * Ahora van en tres grupos y cada uno dice en una línea qué se cambia adentro,
 * así que el primer pantallazo es un mapa de lo que se puede tocar -- no una
 * lista de nombres que hay que abrir uno por uno para saber qué tienen.
 */
interface ConfigSection {
  id: Section
  label: string
  icon: string
  group: (typeof SECTION_GROUPS)[number]
  description: string
}

const SECTION_GROUPS = ['El negocio', 'Lo que ve la gente', 'El sistema'] as const

const SECTIONS: ConfigSection[] = [
  { id: 'prices', label: 'Precios de servicios', icon: 'MXN', group: 'El negocio', description: 'Cuánto cuesta cada paseo, cuánto dura y cuáles se pueden pedir.' },
  { id: 'booking', label: 'Horario de solicitudes', icon: '🕐', group: 'El negocio', description: 'Los días y las horas en que una familia puede pedir un paseo.' },
  { id: 'brand', label: 'Diseño y marca', icon: '🎨', group: 'Lo que ve la gente', description: 'Los colores del sitio y el logo.' },
  { id: 'hero', label: 'Textos del sitio', icon: '📝', group: 'Lo que ve la gente', description: 'El título de la portada y los textos de las secciones.' },
  { id: 'social', label: 'Redes sociales', icon: '📱', group: 'Lo que ve la gente', description: 'Los enlaces de Facebook, Instagram, TikTok y WhatsApp.' },
  { id: 'tips', label: 'Consejos para el paseo', icon: '💡', group: 'Lo que ve la gente', description: 'Los consejos que aparecen en el sitio y en el panel de familia.' },
  { id: 'faq', label: 'Preguntas frecuentes', icon: '❓', group: 'Lo que ve la gente', description: 'Las preguntas y respuestas de la página pública.' },
  { id: 'announcements', label: 'Anuncios y festividades', icon: '🎉', group: 'Lo que ve la gente', description: 'Avisos con fecha de inicio y fin, como un cierre por día festivo.' },
  { id: 'terms', label: 'Términos y condiciones', icon: '📄', group: 'Lo que ve la gente', description: 'El texto legal del servicio. Requiere validación de abogado en México.' },
  { id: 'privacy', label: 'Aviso de privacidad', icon: '🔒', group: 'Lo que ve la gente', description: 'Qué datos se recaban y para qué. Requiere validación de abogado en México.' },
  { id: 'panels', label: 'Paneles del equipo', icon: '🧭', group: 'El sistema', description: 'Qué paneles ve el equipo, en qué orden, y qué ve un supervisor.' },
  { id: 'features', label: 'Funcionalidades', icon: '🚀', group: 'El sistema', description: 'Qué partes de la app están encendidas.' },
  { id: 'maintenance', label: 'Mantenimiento', icon: '⚠️', group: 'El sistema', description: 'Cerrar el sitio temporalmente con un mensaje.' },
]

export default function AdminConfig() {
  const { config, updateConfig, saving, saveError, saved } = useConfig()
  const [openSection, setOpenSection] = useState<Section | null>(null)

  return (
    <div className="space-y-6">
      {saveError ? <p role="alert" className="text-base text-red-700">{saveError}</p> : null}
      {saved && !saveError ? <p role="status" className="text-base text-green-800">Cambios guardados.</p> : null}
      {SECTION_GROUPS.map((group) => {
        const sections = SECTIONS.filter((section) => section.group === group)
        if (sections.length === 0) return null
        return (
          <section key={group} className="space-y-2">
            <h2 className="text-2xs font-semibold uppercase tracking-[0.16em] text-muted">{group}</h2>
            {sections.map((sec) => (
              <div key={sec.id} className="glass-card overflow-hidden">
                <button
                  onClick={() => setOpenSection(openSection === sec.id ? null : sec.id)}
                  aria-expanded={openSection === sec.id}
                  className="flex w-full items-start justify-between gap-3 p-4 text-left transition-all hover:bg-ink/5"
                >
                  <span className="flex min-w-0 items-start gap-2">
                    <span aria-hidden="true" className="mt-0.5 text-sm">{sec.icon}</span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-ink">{sec.label}</span>
                      <span className="mt-0.5 block text-xs text-muted">{sec.description}</span>
                    </span>
                  </span>
                  {openSection === sec.id
                    ? <ChevronUp size={14} className="mt-0.5 shrink-0 text-muted" />
                    : <ChevronDown size={14} className="mt-0.5 shrink-0 text-muted" />}
                </button>

                <AnimatePresence>
                  {openSection === sec.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-ink/10"
                    >
                      <div className="p-4">
                        <SectionContent section={sec.id} config={config} updateConfig={updateConfig} saving={saving} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </section>
        )
      })}
    </div>
  )
}

function SectionContent({
  section,
  config,
  updateConfig,
  saving,
}: {
  section: Section
  config: import('@/lib/defaultConfig').SiteConfig
  updateConfig: (partial: Partial<import('@/lib/defaultConfig').SiteConfig>) => Promise<void>
  saving: boolean
}) {
  switch (section) {
    case 'prices':
      return <AdminServicePricing />
    case 'booking':
      return <AdminBookingSchedule />
    case 'brand':
      return <BrandEditor />
    case 'hero':
      return <HeroEditor config={config} updateConfig={updateConfig} saving={saving} />
    case 'social':
      return <SocialEditor config={config} updateConfig={updateConfig} saving={saving} />
    case 'hours':
      return <HoursEditor config={config} updateConfig={updateConfig} saving={saving} />
    case 'tips':
      return <TipsEditor config={config} updateConfig={updateConfig} saving={saving} />
    case 'faq':
      return <FAQEditor config={config} updateConfig={updateConfig} saving={saving} />
    case 'announcements':
      return <AnnouncementsEditor config={config} updateConfig={updateConfig} saving={saving} />
    case 'terms':
      return <TermsEditor config={config} updateConfig={updateConfig} saving={saving} />
    case 'privacy':
      return <PrivacyEditor config={config} updateConfig={updateConfig} saving={saving} />
    case 'panels':
      return <PanelsEditor config={config} updateConfig={updateConfig} saving={saving} />
    case 'features':
      return <FeaturesEditor config={config} updateConfig={updateConfig} saving={saving} />
    case 'maintenance':
      return <MaintenanceEditor config={config} updateConfig={updateConfig} saving={saving} />
    default:
      return null
  }
}

function validateHeroSubtitle(value: string): string | null {
  if (!value || value.trim().length < 10) return 'El subtítulo debe tener al menos 10 caracteres.'
  const reserved = ['RESERVA', 'reserva', 'RESERVAS', 'Reserva', 'Paseos', 'Servicios', 'FAQ', 'Contacto']
  if (reserved.includes(value.trim())) return 'El subtítulo no puede ser igual a un nombre de sección.'
  return null
}

function BrandEditor() {
  return <AdminBrandConfig />
}

const AdminBrandConfig = dynamic(() => import('@/components/AdminBrandConfig'), {
  loading: () => <div className="skeleton h-40 rounded-xl" />,
})

function HeroEditor({ config, updateConfig, saving }: EditorProps) {
  const [heroTitle, setHeroTitle] = useState(config.heroTitle)
  const [heroSubtitle, setHeroSubtitle] = useState(config.heroSubtitle)
  const [desc, setDesc] = useState(config.sectionDescriptions)
  const [subtitleError, setSubtitleError] = useState<string | null>(null)

  useEffect(() => { setHeroTitle(config.heroTitle) }, [config.heroTitle])
  useEffect(() => { setHeroSubtitle(config.heroSubtitle) }, [config.heroSubtitle])
  useEffect(() => { setDesc(config.sectionDescriptions) }, [config.sectionDescriptions])

  const save = () => {
    const error = validateHeroSubtitle(heroSubtitle)
    if (error) {
      setSubtitleError(error)
      return
    }
    setSubtitleError(null)
    updateConfig({ heroTitle, heroSubtitle, sectionDescriptions: desc })
  }

  return (
    <div className="space-y-3">
      <InputField label="Título del Hero" value={heroTitle} onChange={setHeroTitle} />
      <InputField label="Subtítulo del Hero" value={heroSubtitle} onChange={setHeroSubtitle} multiline />
      {subtitleError && <p className="text-xs text-danger-400" role="alert">{subtitleError}</p>}
      <InputField label="Descripción de Servicios" value={desc.services} onChange={(v) => setDesc({ ...desc, services: v })} multiline />
      <InputField label="Descripción de Cómo funciona" value={desc.howItWorks} onChange={(v) => setDesc({ ...desc, howItWorks: v })} multiline />
      <InputField label="Descripción de FAQ" value={desc.faq} onChange={(v) => setDesc({ ...desc, faq: v })} multiline />
      <SaveButton onClick={save} saving={saving} />
    </div>
  )
}

function SocialEditor({ config, updateConfig, saving }: EditorProps) {
  const [contactEmail, setContactEmail] = useState(config.contactEmail || '')
  const [instagram, setInstagram] = useState(config.instagram)
  const [facebook, setFacebook] = useState(config.facebook)
  const [tiktok, setTiktok] = useState(config.tiktok)

  useEffect(() => { setContactEmail(config.contactEmail || '') }, [config.contactEmail])
  useEffect(() => { setInstagram(config.instagram) }, [config.instagram])
  useEffect(() => { setFacebook(config.facebook) }, [config.facebook])
  useEffect(() => { setTiktok(config.tiktok) }, [config.tiktok])

  const save = () => updateConfig({ contactEmail, instagram, facebook, tiktok })

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-ink/10 bg-ink/[0.025] p-3">
        <p className="text-xs font-semibold text-ink">Contacto central de PET Ap</p>
        <p className="mt-1 text-sm text-muted">{BRAND.displayPhone} · WhatsApp y llamadas</p>
        <p className="mt-1 text-xs text-muted">Se administra como identidad de marca para evitar que una configuración antigua reactive otro número.</p>
      </div>
      <InputField label="Correo de contacto" value={contactEmail} onChange={setContactEmail} />
      <InputField label="Instagram (URL completa)" value={instagram} onChange={setInstagram} />
      <InputField label="Facebook (URL completa)" value={facebook} onChange={setFacebook} />
      <InputField label="TikTok (URL completa)" value={tiktok} onChange={setTiktok} />
      <SaveButton onClick={save} saving={saving} />
    </div>
  )
}

function HoursEditor({ config, updateConfig, saving }: EditorProps) {
  const [slots, setSlots] = useState(config.availableSlots)

  useEffect(() => { setSlots(config.availableSlots) }, [config.availableSlots])

  const save = () => updateConfig({ availableSlots: slots })

  const days = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
  const allHours = generateTimeSlots('lunes')

  const toggleHour = (day: string, hour: string) => {
    const current = slots[day] || []
    if (current.includes(hour)) {
      setSlots({ ...slots, [day]: current.filter((h: string) => h !== hour) })
    } else {
      setSlots({ ...slots, [day]: [...current, hour].sort() })
    }
  }

  return (
    <div className="space-y-3">
      {days.map((day) => {
        const dayHours = BUSINESS_HOURS[day]
        return (
          <div key={day}>
            <p className="text-xs font-medium text-muted mb-1.5 capitalize">
              {day} {dayHours ? `(${dayHours.open} - ${dayHours.close})` : '(Cerrado)'}
            </p>
            <div className="flex flex-wrap gap-1">
              {allHours.map((hour) => {
                const active = (slots[day] || []).includes(hour)
                return (
                  <button
                    key={hour}
                    onClick={() => toggleHour(day, hour)}
                    className={`text-2xs px-2 py-1 rounded-md transition-all ${
                      active
                        ? 'bg-primary/20 text-primary-hover border border-primary/30'
                        : 'bg-ink/5 text-muted border border-ink/10 hover:border-ink/30'
                    }`}
                  >
                    {hour}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
      <SaveButton onClick={save} saving={saving} />
    </div>
  )
}

function TipsEditor({ config, updateConfig, saving }: EditorProps) {
  const [tips, setTips] = useState(config.walkTips)

  useEffect(() => { setTips(config.walkTips) }, [config.walkTips])

  const save = () => updateConfig({ walkTips: tips })

  const addTip = () => setTips([...tips, { title: '', text: '', icon: 'paseo' }])
  const removeTip = (i: number) => setTips(tips.filter((_: { title: string; text: string; icon: string }, idx: number) => idx !== i))
  const updateTip = (i: number, field: string, value: string) => {
    const updated = [...tips]
    updated[i] = { ...updated[i], [field]: value }
    setTips(updated)
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">
        Se muestran en la página pública y en el inicio del panel de familia. Un consejo sin título o
        sin texto no aparece.
      </p>
      {tips.map((tip: { title: string; text: string; icon: string }, i: number) => (
        <div key={i} className="flex gap-2 items-start bg-ink/5 p-3 rounded-lg">
          <div className="flex-1 space-y-2">
            {/* Un emoji guardado antes sigue siendo una opción válida de la
                lista, para no cambiarle el consejo a nadie sin avisar. */}
            <select
              value={tip.icon}
              onChange={(e) => updateTip(i, 'icon', e.target.value)}
              aria-label="Icono del consejo"
              className="text-2xs h-11 w-full rounded border border-ink/15 bg-white px-2 text-ink"
            >
              {!walkTipIcon(tip.icon) && tip.icon && <option value={tip.icon}>{tip.icon} (el que tenías)</option>}
              {WALK_TIP_ICONS.map((entry) => (
                <option key={entry.name} value={entry.name}>{entry.label}</option>
              ))}
            </select>
            <input value={tip.title} onChange={(e) => updateTip(i, 'title', e.target.value)} className="w-full bg-white border border-ink/15 rounded px-2 py-1 text-ink text-xs" aria-label="Título del tip" placeholder="Título" />
            <textarea value={tip.text} onChange={(e) => updateTip(i, 'text', e.target.value)} rows={2} className="w-full bg-white border border-ink/15 rounded px-2 py-1 text-ink text-xs resize-none" aria-label="Texto del tip" placeholder="Texto" />
          </div>
           <button onClick={() => removeTip(i)} className="hover:opacity-80 p-1" style={{ color: 'var(--color-danger)' }}><Trash2 size={10} /></button>
        </div>
      ))}
      <button onClick={addTip} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-all">
        <Plus size={8} /> Agregar tip
      </button>
      <SaveButton onClick={save} saving={saving} />
    </div>
  )
}

function FAQEditor({ config, updateConfig, saving }: EditorProps) {
  const [faq, setFaq] = useState(config.faq)

  useEffect(() => { setFaq(config.faq) }, [config.faq])

  const save = () => updateConfig({ faq })

  const addItem = () => setFaq([...faq, { question: '', answer: '' }])
  const removeItem = (i: number) => setFaq(faq.filter((_: unknown, idx: number) => idx !== i))
  const updateItem = (i: number, field: string, value: string) => {
    const updated = [...faq]
    updated[i] = { ...updated[i], [field]: value }
    setFaq(updated)
  }

  return (
    <div className="space-y-3">
      {faq.map((item: { question: string; answer: string }, i: number) => (
        <div key={i} className="flex gap-2 items-start bg-ink/5 p-3 rounded-lg">
          <div className="flex-1 space-y-2">
            <input value={item.question} onChange={(e) => updateItem(i, 'question', e.target.value)} className="w-full bg-white border border-ink/15 rounded px-2 py-1 text-ink text-xs" aria-label="Pregunta frecuente" placeholder="Pregunta" />
            <textarea value={item.answer} onChange={(e) => updateItem(i, 'answer', e.target.value)} rows={3} className="w-full bg-white border border-ink/15 rounded px-2 py-1 text-ink text-xs resize-none" aria-label="Respuesta" placeholder="Respuesta" />
          </div>
           <button onClick={() => removeItem(i)} className="hover:opacity-80 p-1" style={{ color: 'var(--color-danger)' }}><Trash2 size={10} /></button>
        </div>
      ))}
      <button onClick={addItem} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-all">
        <Plus size={8} /> Agregar pregunta
      </button>
      <SaveButton onClick={save} saving={saving} />
    </div>
  )
}

function AnnouncementsEditor({ config, updateConfig, saving }: EditorProps) {
  const [items, setItems] = useState(config.announcements)
  const [shortcutTarget, setShortcutTarget] = useState<number | null>(null)

  useEffect(() => { setItems(config.announcements) }, [config.announcements])

  const save = () => updateConfig({ announcements: items })
  const addItem = () => setItems([...items, {
    id: `announcement-${Date.now()}`, title: '', message: '', icon: '🎉',
    startDate: '', endDate: '', active: false,
  }])
  const removeItem = (i: number) => setItems(items.filter((_: unknown, idx: number) => idx !== i))
  const updateItem = (i: number, field: keyof Announcement, value: string | boolean) => {
    const updated = [...items]
    updated[i] = { ...updated[i], [field]: value }
    setItems(updated)
  }
  const applyShortcut = (i: number, shortcut: DateShortcut) => {
    updateItem(i, 'startDate', shortcut.startDate)
    updateItem(i, 'endDate', shortcut.endDate)
    setShortcutTarget(null)
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">Anuncios visibles en la página pública y en Familia PET mientras estén activos y la fecha de hoy caiga dentro del rango.</p>
      {items.map((item, i) => (
        <div key={item.id} className="space-y-2 bg-ink/5 p-3 rounded-lg">
          <div className="flex gap-2 items-start">
            <input value={item.icon} onChange={(e) => updateItem(i, 'icon', e.target.value)} className="w-12 bg-white border border-ink/15 rounded px-2 py-1 text-ink text-sm text-center" aria-label="Ícono" maxLength={4} />
            <input value={item.title} onChange={(e) => updateItem(i, 'title', e.target.value)} className="flex-1 bg-white border border-ink/15 rounded px-2 py-1 text-ink text-xs" aria-label="Título del anuncio" placeholder="Título" />
            <button onClick={() => removeItem(i)} className="hover:opacity-80 p-1" style={{ color: 'var(--color-danger)' }}><Trash2 size={10} /></button>
          </div>
          <textarea value={item.message} onChange={(e) => updateItem(i, 'message', e.target.value)} rows={2} className="w-full bg-white border border-ink/15 rounded px-2 py-1 text-ink text-xs resize-none" aria-label="Mensaje del anuncio" placeholder="Mensaje" />
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label htmlFor={`announcement-start-${i}`} className="block text-2xs text-muted mb-1">Desde</label>
              <input id={`announcement-start-${i}`} type="date" value={item.startDate} onChange={(e) => updateItem(i, 'startDate', e.target.value)} className="bg-white border border-ink/15 rounded px-2 py-1 text-ink text-xs" />
            </div>
            <div>
              <label htmlFor={`announcement-end-${i}`} className="block text-2xs text-muted mb-1">Hasta</label>
              <input id={`announcement-end-${i}`} type="date" value={item.endDate} onChange={(e) => updateItem(i, 'endDate', e.target.value)} className="bg-white border border-ink/15 rounded px-2 py-1 text-ink text-xs" />
            </div>
            <div className="relative">
              <button type="button" onClick={() => setShortcutTarget(shortcutTarget === i ? null : i)} className="text-2xs text-primary hover:text-primary/80 transition-all px-2 py-1.5">Fecha rápida ▾</button>
              {shortcutTarget === i && (
                <div className="absolute z-10 mt-1 w-64 rounded-lg border border-ink/15 bg-white shadow-lg">
                  {mexicanObservanceShortcuts().map((shortcut) => (
                    <button key={shortcut.label} type="button" onClick={() => applyShortcut(i, shortcut)} className="block w-full text-left px-3 py-2 text-2xs text-ink hover:bg-ink/5">{shortcut.label}</button>
                  ))}
                </div>
              )}
            </div>
            <label className="flex items-center gap-1.5 text-2xs text-ink ml-auto">
              <input type="checkbox" checked={item.active} onChange={(e) => updateItem(i, 'active', e.target.checked)} />
              Activo
            </label>
          </div>
        </div>
      ))}
      <button onClick={addItem} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-all">
        <Plus size={8} /> Agregar anuncio
      </button>
      <SaveButton onClick={save} saving={saving} />
    </div>
  )
}

function TermsEditor({ config, updateConfig, saving }: EditorProps) {
  const defaults = mergeTermsSections(null)
  const [items, setItems] = useState(() => mergeTermsSections(config.termsSections).map((s) => ({ title: s.title, content: s.content })))

  useEffect(() => {
    setItems(mergeTermsSections(config.termsSections).map((s) => ({ title: s.title, content: s.content })))
  }, [config.termsSections])

  const save = () => updateConfig({ termsSections: items })
  const updateItem = (i: number, field: 'title' | 'content', value: string) => {
    const updated = [...items]
    updated[i] = { ...updated[i], [field]: value }
    setItems(updated)
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">Edita el texto de cada sección de /terminos. No puede agregarse ni quitarse secciones (el ícono de cada una está fijo por posición).</p>
      {items.map((item, i) => (
        <div key={defaults[i].title} className="space-y-2 bg-ink/5 p-3 rounded-lg">
          <input value={item.title} onChange={(e) => updateItem(i, 'title', e.target.value)} className="w-full bg-white border border-ink/15 rounded px-2 py-1 text-ink text-xs font-semibold" aria-label={`Título: ${defaults[i].title}`} />
          <textarea value={item.content} onChange={(e) => updateItem(i, 'content', e.target.value)} rows={3} className="w-full bg-white border border-ink/15 rounded px-2 py-1 text-ink text-xs resize-none" aria-label={`Contenido: ${defaults[i].title}`} />
        </div>
      ))}
      <SaveButton onClick={save} saving={saving} />
    </div>
  )
}

function PrivacyEditor({ config, updateConfig, saving }: EditorProps) {
  const defaults = mergePrivacySections(null)
  const [items, setItems] = useState(() => mergePrivacySections(config.privacySections).map((s) => ({ title: s.title, content: s.content })))

  useEffect(() => {
    setItems(mergePrivacySections(config.privacySections).map((s) => ({ title: s.title, content: s.content })))
  }, [config.privacySections])

  const save = () => updateConfig({ privacySections: items })
  const updateItem = (i: number, field: 'title' | 'content', value: string) => {
    const updated = [...items]
    updated[i] = { ...updated[i], [field]: value }
    setItems(updated)
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">Edita el texto de cada sección de /privacidad. La tabla de proveedores, retención y cookies no es editable aquí — son datos técnicos, no redacción.</p>
      {items.map((item, i) => (
        <div key={defaults[i].title} className="space-y-2 bg-ink/5 p-3 rounded-lg">
          <input value={item.title} onChange={(e) => updateItem(i, 'title', e.target.value)} className="w-full bg-white border border-ink/15 rounded px-2 py-1 text-ink text-xs font-semibold" aria-label={`Título: ${defaults[i].title}`} />
          <textarea value={item.content} onChange={(e) => updateItem(i, 'content', e.target.value)} rows={3} className="w-full bg-white border border-ink/15 rounded px-2 py-1 text-ink text-xs resize-none" aria-label={`Contenido: ${defaults[i].title}`} />
        </div>
      ))}
      <SaveButton onClick={save} saving={saving} />
    </div>
  )
}

function FeaturesEditor({ config, updateConfig, saving }: EditorProps) {
  const [petAhora, setPetAhora] = useState(config.features?.petAhoraEnabled ?? false)
  const [analyticsEnabled, setAnalyticsEnabled] = useState(config.analyticsEnabled === true)

  useEffect(() => { setPetAhora(config.features?.petAhoraEnabled ?? false) }, [config.features?.petAhoraEnabled])
  useEffect(() => { setAnalyticsEnabled(config.analyticsEnabled === true) }, [config.analyticsEnabled])

  const save = () => updateConfig({ features: { petAhoraEnabled: petAhora }, analyticsEnabled })

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setAnalyticsEnabled(!analyticsEnabled)}
          className={`w-10 h-6 rounded-full transition-all ${analyticsEnabled ? 'bg-brand-500' : 'bg-ink/15'}`}
        >
          <div className={`w-4 h-4 rounded-full bg-white shadow transition-all ${analyticsEnabled ? 'translate-x-5' : 'translate-x-1'}`} />
        </button>
        <span className="text-xs text-muted">{analyticsEnabled ? 'Analítica activada' : 'Analítica desactivada'}</span>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => setPetAhora(!petAhora)}
          className={`w-10 h-6 rounded-full transition-all ${petAhora ? 'bg-brand-500' : 'bg-ink/15'}`}
        >
          <div className={`w-4 h-4 rounded-full bg-white shadow transition-all ${petAhora ? 'translate-x-5' : 'translate-x-1'}`} />
        </button>
        <span className="text-xs text-muted">{petAhora ? 'PET Ahora activado' : 'PET Ahora desactivado'}</span>
      </div>
      {petAhora && (
        <div className="p-3 bg-brand-500/10 border border-brand-500/20 rounded-lg flex items-start gap-2">
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>PET Ahora permite a clientes solicitar paseos al instante. Requiere configuración adicional de zonas, paseadores y disponibilidad.</p>
        </div>
      )}
      <SaveButton onClick={save} saving={saving} />
    </div>
  )
}

/**
 * Qué paneles ve el equipo, en qué orden y quién.
 *
 * Cada panel trae su explicación, porque un menú de veinticuatro entradas no
 * se entiende solo. Configuración no se puede ocultar: sería cerrar la puerta
 * por dentro.
 */
function PanelsEditor({ config, updateConfig, saving }: EditorProps) {
  const [draft, setDraft] = useState<AdminPanelPreferences>(config.adminPanels ?? {})
  useEffect(() => { setDraft(config.adminPanels ?? {}) }, [config.adminPanels])

  const panels = orderedPanels(draft)
  const hidden = draft.hidden ?? []
  const supervisorHidden = draft.supervisorHidden ?? []
  const save = () => updateConfig({ adminPanels: draft })

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">
        Oculta lo que no uses, acomódalo en el orden que te sirva y decide qué ve un supervisor.
        El cambio aplica para todo el equipo.
      </p>

      <ul className="space-y-2">
        {panels.map((panel, index) => {
          const isHidden = hidden.includes(panel.id)
          const isLocked = panel.id === ALWAYS_VISIBLE_PANEL
          return (
            <li key={panel.id} className="rounded-xl border border-ink/10 p-3" style={{ background: 'var(--glass-bg)' }}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)', opacity: isHidden ? 0.5 : 1 }}>
                    {panel.label} <span className="text-2xs font-normal text-muted">· {panel.group}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted">{panel.description}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button type="button" onClick={() => setDraft({ ...draft, order: movePanel(draft, panel.id, -1) })} disabled={index === 0} aria-label={`Subir ${panel.label}`} className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-ink/5 disabled:opacity-30">
                    <ChevronUp size={14} />
                  </button>
                  <button type="button" onClick={() => setDraft({ ...draft, order: movePanel(draft, panel.id, 1) })} disabled={index === panels.length - 1} aria-label={`Bajar ${panel.label}`} className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-ink/5 disabled:opacity-30">
                    <ChevronDown size={14} />
                  </button>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={isLocked}
                  onClick={() => setDraft({ ...draft, hidden: togglePanelId(hidden, panel.id) })}
                  className={`text-2xs min-h-9 rounded-full border px-3 font-medium transition-colors disabled:opacity-40 ${isHidden ? 'border-ink/15 text-muted' : 'border-success-500/40 text-success-600'}`}
                >
                  {isLocked ? 'Siempre visible' : isHidden ? 'Oculto' : 'Visible'}
                </button>
                <button
                  type="button"
                  disabled={isLocked}
                  onClick={() => setDraft({ ...draft, supervisorHidden: togglePanelId(supervisorHidden, panel.id) })}
                  className={`text-2xs min-h-9 rounded-full border px-3 font-medium transition-colors disabled:opacity-40 ${supervisorHidden.includes(panel.id) ? 'border-ink/15 text-muted' : 'border-brand-500/40 text-brand-600'}`}
                >
                  {supervisorHidden.includes(panel.id) ? 'Supervisor no lo ve' : 'Supervisor lo ve'}
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      <SaveButton onClick={save} saving={saving} />
    </div>
  )
}

function MaintenanceEditor({ config, updateConfig, saving }: EditorProps) {
  const [enabled, setEnabled] = useState(config.maintenance)

  useEffect(() => { setEnabled(config.maintenance) }, [config.maintenance])

  const save = () => updateConfig({ maintenance: enabled })

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setEnabled(!enabled)}
          className={`w-10 h-6 rounded-full transition-all ${enabled ? 'bg-red-500' : 'bg-ink/15'}`}
        >
          <div className={`w-4 h-4 rounded-full bg-white shadow transition-all ${enabled ? 'translate-x-5' : 'translate-x-1'}`} />
        </button>
        <span className="text-xs text-muted">{enabled ? 'Encendido: el sitio público muestra “En mantenimiento”' : 'Apagado: todo funciona normal'}</span>
      </div>
      {enabled && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2">
           <AlertTriangle className="shrink-0 mt-0.5" size={12} style={{ color: 'var(--color-danger)' }} />
           <p className="text-xs" style={{ color: 'var(--color-danger)' }}>La página principal y las páginas informativas mostrarán “En mantenimiento” y no se podrán solicitar paseos nuevos, ni programados ni PET Ahora. Siguen funcionando admin, paseadores, supervisores, el panel de familia, los paseos ya agendados y el aviso de privacidad.</p>
        </div>
      )}
      <SaveButton onClick={save} saving={saving} />
    </div>
  )
}

function slugifyFieldId(label: string): string {
  return `admin-config-${label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')}`
}

function InputField({ label, value, onChange, multiline, id }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean; id?: string }) {
  const fieldId = id || slugifyFieldId(label)
  return (
    <div>
      <label htmlFor={fieldId} className="block text-xs text-muted mb-1">{label}</label>
      {multiline ? (
        <textarea id={fieldId} value={value} onChange={(e) => onChange(e.target.value)} rows={3}
          className="w-full bg-white border border-ink/15 rounded-lg px-3 py-2 text-ink text-sm resize-none focus:outline-none focus:border-primary"
        />
      ) : (
        <input id={fieldId} value={value} onChange={(e) => onChange(e.target.value)}
          className="w-full bg-white border border-ink/15 rounded-lg px-3 py-2 text-ink text-sm focus:outline-none focus:border-primary"
        />
      )}
    </div>
  )
}

function SaveButton({ onClick, saving }: { onClick: () => void; saving: boolean }) {
  return (
    <button onClick={onClick} disabled={saving}
      className="w-full py-2 rounded-lg text-xs font-semibold bg-gradient-to-r from-primary to-amber-600 text-white hover:opacity-90 transition-all disabled:opacity-30 flex items-center justify-center gap-1"
    >
      <Save size={10} /> {saving ? 'Guardando...' : 'Guardar cambios'}
    </button>
  )
}
