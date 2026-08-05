'use client'

export type BrandFont = 'manrope' | 'inter' | 'system'
export type BrandRadius = 'compact' | 'standard' | 'generous'
export type BrandMotion = 'minimal' | 'standard' | 'expressive'

export interface BrandPreset {
  primary: string
  font: BrandFont
  radius: BrandRadius
  motion: BrandMotion
}

export const DEFAULT_BRAND_PRESET: BrandPreset = {
  primary: '#C45100',
  font: 'manrope',
  radius: 'standard',
  motion: 'standard',
}

export const PRIMARY_SWATCHES: { name: string; value: string }[] = [
  { name: 'Naranja', value: '#C45100' },
  { name: 'Ámbar', value: '#B45309' },
  { name: 'Azul', value: '#2563EB' },
  { name: 'Verde', value: '#059669' },
  { name: 'Teal', value: '#0D9488' },
  { name: 'Violeta', value: '#7C3AED' },
  { name: 'Rosa', value: '#DB2777' },
  { name: 'Rojo', value: '#DC2626' },
]

export const RADIUS_PRESETS: Record<BrandRadius, { label: string; control: string; button: string; card: string; panel: string; sheet: string; pill: string }> = {
  compact:  { label: 'Compacto',   control: '8px',   button: '10px',  card: '12px',  panel: '16px',  sheet: '18px',  pill: '999px' },
  standard: { label: 'Estándar',   control: '12px',  button: '14px',  card: '16px',  panel: '24px',  sheet: '28px',  pill: '999px' },
  generous: { label: 'Generoso',   control: '16px',  button: '18px',  card: '24px',  panel: '32px',  sheet: '36px',  pill: '999px' },
}

export const MOTION_PRESETS: Record<BrandMotion, { label: string; fast: string; base: string; panel: string }> = {
  minimal:    { label: 'Mínimo',     fast: '90ms ease',  base: '150ms ease', panel: '220ms ease' },
  standard:   { label: 'Estándar',   fast: '140ms ease', base: '220ms ease', panel: '320ms ease' },
  expressive: { label: 'Expresivo',  fast: '180ms ease', base: '280ms ease', panel: '420ms ease' },
}

export const FONT_PRESETS: Record<BrandFont, { label: string; body: string; display: string }> = {
  manrope: {
    label: 'Manrope',
    body: 'var(--font-manrope), system-ui, sans-serif',
    display: 'var(--font-manrope), system-ui, sans-serif',
  },
  inter: {
    label: 'Inter',
    body: "'Inter', system-ui, sans-serif",
    display: "'Inter', system-ui, sans-serif",
  },
  system: {
    label: 'Sistema',
    body: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    display: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  },
}

function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)))
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '')
  const value =
    clean.length === 3
      ? clean.split('').map((c) => c + c).join('')
      : clean.padEnd(6, '0').slice(0, 6)
  const n = parseInt(value, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function mix(target: { r: number; g: number; b: number }, toward: 'white' | 'black', ratio: number): string {
  const w = toward === 'white' ? 255 : 0
  const r = clampChannel(target.r + (w - target.r) * ratio)
  const g = clampChannel(target.g + (w - target.g) * ratio)
  const b = clampChannel(target.b + (w - target.b) * ratio)
  return `${r} ${g} ${b}`
}

export function isValidHex(value: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim())
}

export interface DerivedPalette {
  shades: Record<number, string> // rgb channel triplets "r g b" for 50..900
  hex: Record<number, string>
  primary: string // base hex
  hover: string // hex 600
  soft: string // hex 100
  light: string // "r g b / 0.1"
  glowSoft: string
  glow: string
}

const WHITE_RATIOS: Record<number, number> = { 50: 0.88, 100: 0.78, 200: 0.6, 300: 0.42, 400: 0.22 }
const BLACK_RATIOS: Record<number, number> = { 600: 0.18, 700: 0.34, 800: 0.48, 900: 0.62 }

export function derivePalette(hex: string): DerivedPalette {
  const base = hexToRgb(hex)
  const shades: Record<number, string> = { 500: `${base.r} ${base.g} ${base.b}` }
  const hexShades: Record<number, string> = { 500: hex.toUpperCase() }

  for (const [shade, ratio] of Object.entries(WHITE_RATIOS)) {
    shades[Number(shade)] = mix(base, 'white', ratio)
    hexShades[Number(shade)] = rgbToHex(shades[Number(shade)])
  }
  for (const [shade, ratio] of Object.entries(BLACK_RATIOS)) {
    shades[Number(shade)] = mix(base, 'black', ratio)
    hexShades[Number(shade)] = rgbToHex(shades[Number(shade)])
  }

  return {
    shades,
    hex: hexShades,
    primary: hex.toUpperCase(),
    hover: hexShades[600],
    soft: hexShades[100],
    light: `rgb(${shades[500]} / 0.1)`,
    glowSoft: `0 0 20px rgb(${shades[500]} / 0.15)`,
    glow: `0 0 40px rgb(${shades[500]} / 0.2)`,
  }
}

function rgbToHex(channels: string): string {
  const [r, g, b] = channels.split(' ').map(Number)
  const to = (n: number) => n.toString(16).padStart(2, '0').toUpperCase()
  return `#${to(r)}${to(g)}${to(b)}`
}

export function normalizePreset(value: Partial<BrandPreset> | undefined | null): BrandPreset {
  const primary = value?.primary && isValidHex(value.primary) ? value.primary : DEFAULT_BRAND_PRESET.primary
  return {
    primary,
    font: value?.font && FONT_PRESETS[value.font] ? value.font : DEFAULT_BRAND_PRESET.font,
    radius: value?.radius && RADIUS_PRESETS[value.radius] ? value.radius : DEFAULT_BRAND_PRESET.radius,
    motion: value?.motion && MOTION_PRESETS[value.motion] ? value.motion : DEFAULT_BRAND_PRESET.motion,
  }
}

export interface BrandDoc {
  published: BrandPreset
  draft: BrandPreset | null
  publishedVersion: number
  draftVersion: number
}

export const DEFAULT_BRAND_DOC: BrandDoc = {
  published: DEFAULT_BRAND_PRESET,
  draft: null,
  publishedVersion: 1,
  draftVersion: 0,
}

export function normalizeBrandDoc(raw: unknown): BrandDoc {
  const doc = (raw || {}) as Partial<BrandDoc>
  return {
    published: normalizePreset(doc.published),
    draft: doc.draft ? normalizePreset(doc.draft) : null,
    publishedVersion: typeof doc.publishedVersion === 'number' && doc.publishedVersion > 0 ? doc.publishedVersion : 1,
    draftVersion: typeof doc.draftVersion === 'number' && doc.draftVersion > 0 ? doc.draftVersion : 0,
  }
}

export function applyBrandPreset(preset: BrandPreset): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const palette = derivePalette(preset.primary)

  const style: Record<string, string> = {
    '--brand-50': palette.shades[50],
    '--brand-100': palette.shades[100],
    '--brand-200': palette.shades[200],
    '--brand-300': palette.shades[300],
    '--brand-400': palette.shades[400],
    '--brand-500': palette.shades[500],
    '--brand-600': palette.shades[600],
    '--brand-700': palette.shades[700],
    '--brand-800': palette.shades[800],
    '--brand-900': palette.shades[900],
    '--color-primary': palette.primary,
    '--color-primary-hover': palette.hover,
    '--color-primary-light': palette.light,
    '--color-brand-soft': palette.soft,
    '--focus-ring': `rgb(${palette.shades[500]} / 0.8)`,
    '--font-body': FONT_PRESETS[preset.font].body,
    '--font-display': FONT_PRESETS[preset.font].display,
    '--radius-control': RADIUS_PRESETS[preset.radius].control,
    '--radius-button': RADIUS_PRESETS[preset.radius].button,
    '--radius-card': RADIUS_PRESETS[preset.radius].card,
    '--radius-panel': RADIUS_PRESETS[preset.radius].panel,
    '--radius-sheet': RADIUS_PRESETS[preset.radius].sheet,
    '--radius-pill': RADIUS_PRESETS[preset.radius].pill,
    '--radius-lg': RADIUS_PRESETS[preset.radius].control,
    '--radius-xl': RADIUS_PRESETS[preset.radius].card,
    '--radius-2xl': RADIUS_PRESETS[preset.radius].panel,
    '--transition-fast': MOTION_PRESETS[preset.motion].fast,
    '--transition-base': MOTION_PRESETS[preset.motion].base,
    '--transition-panel': MOTION_PRESETS[preset.motion].panel,
    '--color-primary-glow': `rgba(${palette.shades[500].replace(/ /g, ', ')} / 0.25)`,
  }

  for (const [key, value] of Object.entries(style)) {
    root.style.setProperty(key, value)
  }
}
