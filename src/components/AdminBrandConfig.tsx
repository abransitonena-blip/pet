'use client'

import { useState } from 'react'
import { Eye, Save, Send, RotateCcw, CheckCircle2, AlertTriangle } from 'lucide-react'
import { useBrand } from '@/context/BrandContext'
import {
  PRIMARY_SWATCHES,
  RADIUS_PRESETS,
  MOTION_PRESETS,
  FONT_PRESETS,
  isValidHex,
  type BrandFont,
  type BrandRadius,
  type BrandMotion,
} from '@/lib/brandPresets'
import Button from '@/components/ui/Button'

export default function AdminBrandConfig() {
  const {
    editing,
    published,
    previewing,
    publishedVersion,
    draftVersion,
    saving,
    updateDraft,
    saveDraft,
    publish,
    discardDraft,
    togglePreview,
  } = useBrand()

  const [customColor, setCustomColor] = useState('')
  const [colorError, setColorError] = useState<string | null>(null)

  const isDirty = JSON.stringify(editing) !== JSON.stringify(published)

  const handleCustomColor = () => {
    const value = customColor.trim()
    if (!value) return
    if (!isValidHex(value)) {
      setColorError('Ingresa un color válido en formato hexadecimal (ej. #2563EB).')
      return
    }
    setColorError(null)
    updateDraft({ primary: value })
    setCustomColor('')
  }

  const handlePublish = async () => {
    await publish()
  }

  return (
    <div className="space-y-4">
      {/* Status banner */}
      <div
        className="flex items-center justify-between gap-3 p-3 rounded-xl"
        style={{ background: previewing ? 'rgba(37, 99, 235, 0.08)' : 'var(--color-brand-soft)', border: `1px solid ${previewing ? 'rgba(37,99,235,0.3)' : 'var(--brand)'}` }}
      >
        <div className="flex items-center gap-2">
          {previewing ? <Eye size={14} /> : <CheckCircle2 size={14} />}
          <div>
            <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
              {previewing ? 'Vista previa activa' : draftVersion > 0 ? `Borrador guardado v${draftVersion}` : 'Sin cambios pendientes'}
            </p>
            <p className="text-2xs" style={{ color: 'var(--text-muted)' }}>
              Publicado v{publishedVersion} · {isDirty ? 'Hay cambios sin publicar' : 'El sitio refleja lo publicado'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {isDirty && (
            <Button variant="secondary" size="sm" onClick={togglePreview} icon={<Eye size={12} />}>
              {previewing ? 'Detener vista previa' : 'Vista previa'}
            </Button>
          )}
          {draftVersion > 0 && (
            <Button variant="secondary" size="sm" onClick={discardDraft} disabled={saving} icon={<RotateCcw size={12} />}>
              Descartar
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={saveDraft} loading={saving} icon={<Save size={12} />}>
            Guardar borrador
          </Button>
          <Button variant="primary" size="sm" onClick={handlePublish} loading={saving} icon={<Send size={12} />}>
            Publicar
          </Button>
        </div>
      </div>

      {/* Color */}
      <div>
        <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Color principal</p>
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
          {PRIMARY_SWATCHES.map((swatch) => {
            const selected = editing.primary.toLowerCase() === swatch.value.toLowerCase()
            return (
              <button
                key={swatch.value}
                onClick={() => updateDraft({ primary: swatch.value })}
                className="flex flex-col items-center gap-1.5 group"
                aria-label={`Usar color ${swatch.name}`}
                aria-pressed={selected}
              >
                <span
                  className="w-10 h-10 rounded-xl border-2 transition-transform group-hover:scale-105"
                  style={{
                    background: swatch.value,
                    borderColor: selected ? 'var(--text-primary)' : 'var(--border)',
                    boxShadow: selected ? '0 0 0 2px var(--bg-card) inset, 0 2px 6px rgba(0,0,0,0.15)' : undefined,
                  }}
                />
                <span className={`text-2xs ${selected ? 'font-semibold' : ''}`} style={{ color: selected ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                  {swatch.name}
                </span>
              </button>
            )
          })}
        </div>
        <div className="flex gap-2 mt-3">
          <div className="flex items-center gap-2 flex-1">
            <input
              type="color"
              value={editing.primary}
              onChange={(e) => updateDraft({ primary: e.target.value })}
              className="w-10 h-10 rounded-lg border cursor-pointer"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}
              aria-label="Color personalizado"
            />
            <input
              type="text"
              value={customColor}
              onChange={(e) => setCustomColor(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCustomColor() }}
              placeholder="Código hexadecimal (ej. #2563EB)"
              className="flex-1 px-3 py-2 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              aria-label="Color personalizado en hexadecimal"
            />
            <Button variant="secondary" size="sm" onClick={handleCustomColor}>Aplicar</Button>
          </div>
        </div>
        {colorError && <p className="text-xs mt-1.5" role="alert" style={{ color: 'var(--color-error)' }}>{colorError}</p>}
      </div>

      <hr style={{ borderColor: 'var(--border)' }} />

      {/* Typography */}
      <div>
        <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Tipografía</p>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(FONT_PRESETS) as BrandFont[]).map((font) => (
            <button
              key={font}
              onClick={() => updateDraft({ font })}
              className="p-3 rounded-xl text-left transition-all"
              style={{
                background: editing.font === font ? 'var(--color-brand-soft)' : 'var(--bg-card)',
                border: `1px solid ${editing.font === font ? 'var(--brand)' : 'var(--border)'}`,
              }}
              aria-pressed={editing.font === font}
            >
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)', fontFamily: FONT_PRESETS[font].body }}>
                {FONT_PRESETS[font].label}
              </p>
              <p className="text-2xs mt-0.5" style={{ color: 'var(--text-muted)' }}>AaBbCc 123</p>
            </button>
          ))}
        </div>
      </div>

      {/* Radius */}
      <div>
        <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Esquinas (radio)</p>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(RADIUS_PRESETS) as BrandRadius[]).map((radius) => (
            <button
              key={radius}
              onClick={() => updateDraft({ radius })}
              className="p-3 rounded-xl transition-all"
              style={{
                background: editing.radius === radius ? 'var(--color-brand-soft)' : 'var(--bg-card)',
                border: `1px solid ${editing.radius === radius ? 'var(--brand)' : 'var(--border)'}`,
              }}
              aria-pressed={editing.radius === radius}
            >
              <div
                className="mx-auto mb-2 w-10 h-7 border-2"
                style={{
                  borderColor: 'var(--text-primary)',
                  borderRadius: RADIUS_PRESETS[radius].control,
                }}
              />
              <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{RADIUS_PRESETS[radius].label}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Motion */}
      <div>
        <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Animaciones</p>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(MOTION_PRESETS) as BrandMotion[]).map((motion) => (
            <button
              key={motion}
              onClick={() => updateDraft({ motion })}
              className="p-3 rounded-xl transition-all"
              style={{
                background: editing.motion === motion ? 'var(--color-brand-soft)' : 'var(--bg-card)',
                border: `1px solid ${editing.motion === motion ? 'var(--brand)' : 'var(--border)'}`,
              }}
              aria-pressed={editing.motion === motion}
            >
              <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{MOTION_PRESETS[motion].label}</p>
              <p className="text-2xs" style={{ color: 'var(--text-muted)' }}>{MOTION_PRESETS[motion].base}</p>
            </button>
          ))}
        </div>
      </div>

      {previewing && (
        <div className="flex items-start gap-2 p-3 rounded-xl" style={{ background: 'rgba(37, 99, 235, 0.08)', border: '1px solid rgba(37,99,235,0.3)' }}>
          <AlertTriangle size={14} className="shrink-0 mt-0.5" style={{ color: '#2563eb' }} />
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Estás viendo una vista previa de los cambios. Nada se ha aplicado al sitio público hasta que publiques.
          </p>
        </div>
      )}
    </div>
  )
}
