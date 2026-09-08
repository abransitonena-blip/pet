import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

jest.mock('next/navigation', () => ({ usePathname: () => '/' }))
jest.mock('@/context/ConfigContext', () => ({ useConfig: () => ({ config: { analyticsEnabled: true } }) }))
jest.mock('@/lib/consentPaths', () => ({ isAuthPath: () => false }))
jest.mock('@/firebase/config', () => ({ auth: { currentUser: { uid: 'customer-1' } }, db: {} }))
jest.mock('firebase/firestore', () => ({
  addDoc: jest.fn(async () => ({ id: 'privacy-folio-1' })),
  collection: jest.fn(() => ({})),
  serverTimestamp: jest.fn(() => ({ seconds: 1 })),
}))

import { ConsentProvider, CONSENT_KEY } from '../src/components/analytics/ConsentProvider'
import { trackEvent } from '../src/lib/analytics'
import CustomerPrivacyPage from '../src/app/familia/privacidad/page'
import { RETENTION_MATRIX, STORAGE_INVENTORY } from '../src/lib/privacyConfig'

const root = join(__dirname, '..')
const read = (path: string) => readFileSync(join(root, path), 'utf8')

function dataLayer(): unknown[] {
  return (window as unknown as { dataLayer?: unknown[] }).dataLayer ?? []
}

describe('P0.6 Analytics consent', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_GA_ID = 'G-TEST'
    localStorage.clear()
    document.getElementById('gtag-js')?.remove()
    ;(window as unknown as { dataLayer: unknown[]; gtag?: unknown; __petAnalyticsEnabled?: boolean }).dataLayer = []
    delete (window as unknown as { gtag?: unknown }).gtag
    ;(window as unknown as { __petAnalyticsEnabled?: boolean }).__petAnalyticsEnabled = false
  })

  test('does not load Analytics before consent or after rejection', async () => {
    render(<ConsentProvider><div>contenido</div></ConsentProvider>)
    expect(document.getElementById('gtag-js')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Rechazar' }))
    await waitFor(() => expect(localStorage.getItem(CONSENT_KEY)).toBe('denied'))
    expect(document.getElementById('gtag-js')).not.toBeInTheDocument()
  })

  test('acceptance grants only analytics_storage and keeps advertising denied', async () => {
    render(<ConsentProvider><div>contenido</div></ConsentProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Aceptar analítica' }))
    await waitFor(() => expect(document.getElementById('gtag-js')).toBeInTheDocument())
    const update = dataLayer().find((entry) => Array.isArray(entry) && entry[0] === 'consent' && entry[1] === 'update') as unknown[]
    expect(update[2]).toEqual({
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'granted',
    })
  })

  test('withdrawal stops future events and removes the Analytics loader', async () => {
    render(<ConsentProvider><div>contenido</div></ConsentProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Aceptar analítica' }))
    await waitFor(() => expect(document.getElementById('gtag-js')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Privacidad' }))
    fireEvent.click(screen.getByRole('button', { name: 'Rechazar' }))
    await waitFor(() => expect(document.getElementById('gtag-js')).not.toBeInTheDocument())
    const before = dataLayer().length
    trackEvent({ action: 'after_withdrawal', category: 'test' })
    expect(dataLayer()).toHaveLength(before)
  })

  test('choice persists and clearing it allows a new decision', async () => {
    localStorage.setItem(CONSENT_KEY, 'denied')
    render(<ConsentProvider><div>contenido</div></ConsentProvider>)
    await screen.findByRole('button', { name: 'Privacidad' })
    fireEvent.click(screen.getByRole('button', { name: 'Privacidad' }))
    fireEvent.click(screen.getByRole('button', { name: 'Borrar elección' }))
    expect(localStorage.getItem(CONSENT_KEY)).toBeNull()
    expect(screen.getByRole('button', { name: 'Aceptar analítica' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Rechazar' })).toBeInTheDocument()
  })
})

describe('P0.6 separated photo consent and minimization', () => {
  test('photo decisions are independent and never preselected', () => {
    render(<CustomerPrivacyPage />)
    fireEvent.change(screen.getByLabelText(/Tipo de solicitud/), { target: { value: 'photo-consent-update' } })
    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes).toHaveLength(3)
    for (const checkbox of checkboxes) expect(checkbox).not.toBeChecked()
    fireEvent.click(checkboxes[0])
    expect(checkboxes[0]).toBeChecked()
    expect(checkboxes[1]).not.toBeChecked()
    expect(checkboxes[2]).not.toBeChecked()
  })

  test('reservation WhatsApp message is reviewed and contains no sensitive fields', () => {
    const submit = read('src/lib/submitReservation.ts')
    const confirm = read('src/components/reservation-steps-v2/StepV2Confirm.tsx')
    expect(submit).not.toContain('window.open(')
    expect(submit).toContain('Solicitud PET ${orderRef.id}')
    expect(submit).not.toMatch(/message = `[^`]*(address|phone|health|walker|notes)/i)
    expect(confirm).toContain('Revisa antes de abrir WhatsApp')
    const utils = read('src/lib/utils.ts')
    expect(utils).toContain('Mensaje exacto:')
    expect(utils).toContain('No se agregarán automáticamente dirección, salud, notas privadas ni datos financieros')
  })

  test('privacy notice renders the canonical retention and storage inventories', () => {
    // Content lives in PrivacidadContent.tsx (client component, reads config.privacySections
    // via useConfig for admin-editable overrides); page.tsx is just the server metadata shell.
    const privacyContent = read('src/app/privacidad/PrivacidadContent.tsx')
    const privacyStaticText = read('src/lib/privacyContent.ts')
    expect(RETENTION_MATRIX.length).toBeGreaterThanOrEqual(14)
    expect(STORAGE_INVENTORY.map((item) => item.name)).toEqual(expect.arrayContaining(['__session', 'petap_consent_v1', 'pet-ap-static-v3']))
    expect(privacyContent).toContain('RETENTION_MATRIX.map')
    expect(privacyContent).toContain('STORAGE_INVENTORY.map')
    expect(privacyStaticText).toContain('borrador operativo')
  })
})
