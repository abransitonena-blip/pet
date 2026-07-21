'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useConfig } from '@/context/ConfigContext'
import {
  FaSave,
  FaTimes,
  FaPlus,
  FaTrash,
  FaChevronDown,
  FaChevronUp,
  FaExclamationTriangle,
} from 'react-icons/fa'
import { BUSINESS_HOURS, generateTimeSlots } from '@/lib/defaultConfig'

type Section = 'hero' | 'social' | 'hours' | 'tips' | 'faq' | 'terms' | 'walkers' | 'maintenance'

const SECTIONS: { id: Section; label: string; icon: string }[] = [
  { id: 'hero', label: 'Textos del sitio', icon: '📝' },
  { id: 'social', label: 'Redes sociales', icon: '📱' },
  { id: 'hours', label: 'Horarios disponibles', icon: '🕐' },
  { id: 'tips', label: 'Walk Tips', icon: '💡' },
  { id: 'faq', label: 'FAQ', icon: '❓' },
  { id: 'terms', label: 'Términos', icon: '📄' },
  { id: 'walkers', label: 'Paseadores', icon: '🦮' },
  { id: 'maintenance', label: 'Mantenimiento', icon: '⚠️' },
]

export default function AdminConfig() {
  const { config, updateConfig, saving } = useConfig()
  const [openSection, setOpenSection] = useState<Section | null>('hero')

  return (
    <div className="space-y-3">
      {SECTIONS.map((sec) => (
        <div key={sec.id} className="glass-card overflow-hidden">
          <button
            onClick={() => setOpenSection(openSection === sec.id ? null : sec.id)}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-white/[0.02] transition-all"
          >
            <span className="text-sm font-semibold text-white flex items-center gap-2">
              <span>{sec.icon}</span> {sec.label}
            </span>
            {openSection === sec.id ? <FaChevronUp size={10} className="text-white/30" /> : <FaChevronDown size={10} className="text-white/30" />}
          </button>

          <AnimatePresence>
            {openSection === sec.id && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="border-t border-white/5"
              >
                <div className="p-4">
                  <SectionContent section={sec.id} config={config} updateConfig={updateConfig} saving={saving} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
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
  config: any
  updateConfig: any
  saving: boolean
}) {
  switch (section) {
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
    case 'terms':
      return <TermsEditor config={config} updateConfig={updateConfig} saving={saving} />
    case 'walkers':
      return <WalkersEditor config={config} updateConfig={updateConfig} saving={saving} />
    case 'maintenance':
      return <MaintenanceEditor config={config} updateConfig={updateConfig} saving={saving} />
    default:
      return null
  }
}

function HeroEditor({ config, updateConfig, saving }: any) {
  const [heroTitle, setHeroTitle] = useState(config.heroTitle)
  const [heroSubtitle, setHeroSubtitle] = useState(config.heroSubtitle)
  const [desc, setDesc] = useState(config.sectionDescriptions)

  const save = () => {
    updateConfig({ heroTitle, heroSubtitle, sectionDescriptions: desc })
  }

  return (
    <div className="space-y-3">
      <InputField label="Título del Hero" value={heroTitle} onChange={setHeroTitle} />
      <InputField label="Subtítulo del Hero" value={heroSubtitle} onChange={setHeroSubtitle} multiline />
      <InputField label="Descripción de Servicios" value={desc.services} onChange={(v) => setDesc({ ...desc, services: v })} multiline />
      <InputField label="Descripción de Cómo funciona" value={desc.howItWorks} onChange={(v) => setDesc({ ...desc, howItWorks: v })} multiline />
      <InputField label="Descripción de FAQ" value={desc.faq} onChange={(v) => setDesc({ ...desc, faq: v })} multiline />
      <SaveButton onClick={save} saving={saving} />
    </div>
  )
}

function SocialEditor({ config, updateConfig, saving }: any) {
  const [whatsapp, setWhatsapp] = useState(config.whatsapp)
  const [instagram, setInstagram] = useState(config.instagram)
  const [facebook, setFacebook] = useState(config.facebook)
  const [tiktok, setTiktok] = useState(config.tiktok)

  const save = () => updateConfig({ whatsapp, instagram, facebook, tiktok })

  return (
    <div className="space-y-3">
      <InputField label="WhatsApp (solo números)" value={whatsapp} onChange={setWhatsapp} />
      <InputField label="Instagram (URL completa)" value={instagram} onChange={setInstagram} />
      <InputField label="Facebook (URL completa)" value={facebook} onChange={setFacebook} />
      <InputField label="TikTok (URL completa)" value={tiktok} onChange={setTiktok} />
      <SaveButton onClick={save} saving={saving} />
    </div>
  )
}

function HoursEditor({ config, updateConfig, saving }: any) {
  const [slots, setSlots] = useState(config.availableSlots)

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
            <p className="text-xs font-medium text-white/60 mb-1.5 capitalize">
              {day} {dayHours ? `(${dayHours.open} - ${dayHours.close})` : '(Cerrado)'}
            </p>
            <div className="flex flex-wrap gap-1">
              {allHours.map((hour) => {
                const active = (slots[day] || []).includes(hour)
                return (
                  <button
                    key={hour}
                    onClick={() => toggleHour(day, hour)}
                    className={`text-[10px] px-2 py-1 rounded-md transition-all ${
                      active
                        ? 'bg-primary/20 text-primary border border-primary/30'
                        : 'bg-white/5 text-white/30 border border-white/5 hover:border-white/20'
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

function TipsEditor({ config, updateConfig, saving }: any) {
  const [tips, setTips] = useState(config.walkTips)

  const save = () => updateConfig({ walkTips: tips })

  const addTip = () => setTips([...tips, { title: '', text: '', icon: '🐾' }])
  const removeTip = (i: number) => setTips(tips.filter((_: any, idx: number) => idx !== i))
  const updateTip = (i: number, field: string, value: string) => {
    const updated = [...tips]
    updated[i] = { ...updated[i], [field]: value }
    setTips(updated)
  }

  return (
    <div className="space-y-3">
      {tips.map((tip: any, i: number) => (
        <div key={i} className="flex gap-2 items-start bg-white/[0.02] p-3 rounded-lg">
          <div className="flex-1 space-y-2">
            <input value={tip.icon} onChange={(e) => updateTip(i, 'icon', e.target.value)} className="w-10 bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-xs text-center" placeholder="Icono" />
            <input value={tip.title} onChange={(e) => updateTip(i, 'title', e.target.value)} className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-xs" placeholder="Título" />
            <textarea value={tip.text} onChange={(e) => updateTip(i, 'text', e.target.value)} rows={2} className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-xs resize-none" placeholder="Texto" />
          </div>
          <button onClick={() => removeTip(i)} className="text-red-400 hover:text-red-300 p-1"><FaTrash size={10} /></button>
        </div>
      ))}
      <button onClick={addTip} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-all">
        <FaPlus size={8} /> Agregar tip
      </button>
      <SaveButton onClick={save} saving={saving} />
    </div>
  )
}

function FAQEditor({ config, updateConfig, saving }: any) {
  const [faq, setFaq] = useState(config.faq)

  const save = () => updateConfig({ faq })

  const addItem = () => setFaq([...faq, { question: '', answer: '' }])
  const removeItem = (i: number) => setFaq(faq.filter((_: any, idx: number) => idx !== i))
  const updateItem = (i: number, field: string, value: string) => {
    const updated = [...faq]
    updated[i] = { ...updated[i], [field]: value }
    setFaq(updated)
  }

  return (
    <div className="space-y-3">
      {faq.map((item: any, i: number) => (
        <div key={i} className="flex gap-2 items-start bg-white/[0.02] p-3 rounded-lg">
          <div className="flex-1 space-y-2">
            <input value={item.question} onChange={(e) => updateItem(i, 'question', e.target.value)} className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-xs" placeholder="Pregunta" />
            <textarea value={item.answer} onChange={(e) => updateItem(i, 'answer', e.target.value)} rows={3} className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-xs resize-none" placeholder="Respuesta" />
          </div>
          <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-300 p-1"><FaTrash size={10} /></button>
        </div>
      ))}
      <button onClick={addItem} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-all">
        <FaPlus size={8} /> Agregar pregunta
      </button>
      <SaveButton onClick={save} saving={saving} />
    </div>
  )
}

function TermsEditor({ config, updateConfig, saving }: any) {
  const [content, setContent] = useState(config.termsContent)
  const save = () => updateConfig({ termsContent: content })

  return (
    <div className="space-y-3">
      <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={12}
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs font-mono resize-none focus:outline-none focus:border-primary"
      />
      <SaveButton onClick={save} saving={saving} />
    </div>
  )
}

function WalkersEditor({ config, updateConfig, saving }: any) {
  const [walkers, setWalkers] = useState(config.walkers)

  const save = () => updateConfig({ walkers })

  const addWalker = () => setWalkers([...walkers, { name: '', phone: '' }])
  const removeWalker = (i: number) => setWalkers(walkers.filter((_: any, idx: number) => idx !== i))
  const updateWalker = (i: number, field: string, value: string) => {
    const updated = [...walkers]
    updated[i] = { ...updated[i], [field]: value }
    setWalkers(updated)
  }

  return (
    <div className="space-y-3">
      {walkers.map((w: any, i: number) => (
        <div key={i} className="flex gap-2 items-start bg-white/[0.02] p-3 rounded-lg">
          <div className="flex-1 flex gap-2">
            <input value={w.name} onChange={(e) => updateWalker(i, 'name', e.target.value)} className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-xs" placeholder="Nombre" />
            <input value={w.phone} onChange={(e) => updateWalker(i, 'phone', e.target.value)} className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-xs" placeholder="Teléfono" />
          </div>
          <button onClick={() => removeWalker(i)} className="text-red-400 hover:text-red-300 p-1"><FaTrash size={10} /></button>
        </div>
      ))}
      <button onClick={addWalker} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-all">
        <FaPlus size={8} /> Agregar paseador
      </button>
      <SaveButton onClick={save} saving={saving} />
    </div>
  )
}

function MaintenanceEditor({ config, updateConfig, saving }: any) {
  const [enabled, setEnabled] = useState(config.maintenance)

  const save = () => updateConfig({ maintenance: enabled })

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setEnabled(!enabled)}
          className={`w-10 h-6 rounded-full transition-all ${enabled ? 'bg-red-500' : 'bg-white/10'}`}
        >
          <div className={`w-4 h-4 rounded-full bg-white transition-all ${enabled ? 'translate-x-5' : 'translate-x-1'}`} />
        </button>
        <span className="text-xs text-white/60">{enabled ? 'Activado - el sitio muestra "En mantenimiento"' : 'Desactivado - sitio normal'}</span>
      </div>
      {enabled && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2">
          <FaExclamationTriangle className="text-red-400 shrink-0 mt-0.5" size={12} />
          <p className="text-xs text-red-400">El sitio mostrará una pantalla de mantenimiento. Los clientes no podrán acceder a la página principal.</p>
        </div>
      )}
      <SaveButton onClick={save} saving={saving} />
    </div>
  )
}

function InputField({ label, value, onChange, multiline }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean }) {
  return (
    <div>
      <label className="block text-xs text-white/40 mb-1">{label}</label>
      {multiline ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm resize-none focus:outline-none focus:border-primary"
        />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
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
      <FaSave size={10} /> {saving ? 'Guardando...' : 'Guardar cambios'}
    </button>
  )
}
