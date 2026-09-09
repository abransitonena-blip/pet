import { readFileSync } from 'node:fs'

describe('reviews get a real home inside Familia PET', () => {
  test('the historial page mounts the same gated ReviewForm, not a duplicate flow', () => {
    const page = readFileSync('src/app/familia/historial/page.tsx', 'utf8')
    expect(page).toContain("import ReviewForm from '@/components/ReviewForm'")
    expect(page).toContain('<ReviewForm />')
  })
})

describe('public nav anchors land past the fixed header', () => {
  const sections: Record<string, string> = {
    'src/components/Hero.tsx': 'id="hero"',
    'src/components/Services.tsx': 'id="servicios"',
    'src/components/HowItWorks.tsx': 'id="como-funciona"',
    'src/components/Reviews.tsx': 'id="resenas"',
    'src/components/ContactSection.tsx': 'id="contacto"',
  }

  test('every anchor target reserves scroll offset for the fixed header', () => {
    for (const [file, idAttr] of Object.entries(sections)) {
      const source = readFileSync(file, 'utf8')
      expect(source).toContain(idAttr)
      expect(source).toContain('scroll-mt-20')
    }
  })
})
