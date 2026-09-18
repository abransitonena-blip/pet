/** @jest-environment node */

import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { BRAND } from '@/lib/brand'

const root = path.resolve(__dirname, '..')
const read = (relativePath: string) => readFileSync(path.join(root, relativePath), 'utf8')

describe('marca y contacto canónicos', () => {
  test('el asset principal es exactamente el PNG autorizado por el propietario', () => {
    const assetPath = path.join(root, 'public/brand/pet-ap-dog-logo.png')
    expect(existsSync(assetPath)).toBe(true)
    expect(createHash('sha256').update(readFileSync(assetPath)).digest('hex')).toBe(
      'dada755ff382c57e113f5a06489204990df7ebf530ff9451f8e6e99c61b8b594',
    )
    expect(BRAND.logoPath).toBe('/brand/pet-ap-dog-logo.png')
  })

  test('en pantalla, el perrito; en chiquito, el cuadro naranja', () => {
    // On-page the mark is drawn as a CSS mask so it takes the brand colour,
    // which needs the alpha-channel copy of the very same silhouette.
    const logo = read('src/components/ui/Logo.tsx')
    expect(logo).toContain('maskImage: `url(${BRAND.markPath})`')
    expect(logo).toContain('backgroundColor: \'currentColor\'')
    expect(logo).not.toContain('<ellipse')
    expect(BRAND.markPath).toBe('/brand/pet-ap-dog-mark.png')
    expect(existsSync(path.join(root, 'public/brand/pet-ap-dog-mark.png'))).toBe(true)

    // El perrito es una silueta larga: a 16 px en la pestaña y a 24 en un aviso
    // se vuelve una mancha. Ahí va el ícono cuadrado de la app, que es el que
    // estaba antes y el que el dueño pidió de vuelta.
    for (const file of ['src/app/layout.tsx', 'src/components/PWARegister.tsx', 'public/sw.js', 'public/manifest.json']) {
      expect({ file, usaElCuadro: read(file).includes('/icons/icon-192') }).toEqual({ file, usaElCuadro: true })
    }
    expect(read('src/app/layout.tsx')).not.toContain(BRAND.logoPath)
  })

  test('la marca en pantalla ya no vive dentro de una caja blanca', () => {
    // The complaint was that the dog read as a sticker: a black silhouette on
    // a white bordered tile. No container, no border, no forced background.
    const logo = read('src/components/ui/Logo.tsx')
    expect(logo).not.toMatch(/bg-white|border border-ink|shadow-sm/)
  })

  test('contacto público usa un número único y no revive la configuración anterior', () => {
    expect(BRAND.whatsappRaw).toBe('5538231235')
    expect(BRAND.whatsapp).toBe('525538231235')
    expect(BRAND.whatsappUrl).toBe('https://wa.me/525538231235')
    expect(BRAND.telUrl).toBe('tel:+525538231235')

    const config = read('src/context/ConfigContext.tsx')
    expect(config).toContain('const whatsappE164 = brand.whatsapp')
    expect(config).toContain('const displayPhone = brand.displayPhone')
    expect(config).not.toContain('merged.whatsapp || merged.whatsappE164')
  })

  test('los enlaces de portada tienen un destino real y el teléfono permite llamar', () => {
    const header = read('src/components/Header.tsx')
    const home = read('src/app/HomeClient.tsx')
    const styles = read('src/app/globals.css')
    const sections = [
      ['#hero', 'src/components/Hero.tsx'],
      ['#servicios', 'src/components/Services.tsx'],
      ['#como-funciona', 'src/components/HowItWorks.tsx'],
      ['#resenas', 'src/components/Reviews.tsx'],
      ['#contacto', 'src/components/ContactSection.tsx'],
    ] as const

    for (const [href, component] of sections) {
      expect(header).toContain(`href: '/${href}'`)
      expect(read(component)).toContain(`id="${href.slice(1)}"`)
    }
    expect(read('src/components/ContactSection.tsx')).toContain('href: BRAND.telUrl')
    expect(home).not.toContain("closest('a[href^=\"#\"]')")
    expect(styles).toContain('section[id]')
    expect(styles).toContain('scroll-margin-top: 5rem')
  })
})
