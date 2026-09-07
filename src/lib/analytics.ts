type GTagEvent = {
  action: string
  category: string
  label?: string
  value?: number
}

type GtagWindow = { gtag?: (...args: unknown[]) => void; __petAnalyticsEnabled?: boolean }

function safeGtag(...args: unknown[]) {
  if (typeof window === 'undefined') return
  const analyticsWindow = window as unknown as GtagWindow
  const gtag = analyticsWindow.gtag
  if (analyticsWindow.__petAnalyticsEnabled === true && typeof gtag === 'function') {
    gtag(...args)
  }
}

export function trackEvent({ action, category, label, value }: GTagEvent) {
  safeGtag('event', action, {
    event_category: category,
    event_label: label,
    value,
  })
}

export function trackConversion(label: string, value?: number) {
  trackEvent({ action: 'conversion', category: 'conversion', label, value })
}

export const Events = {
  quoteRequested: (category: string) =>
    trackEvent({ action: 'quote_requested', category: 'cotizacion', label: category }),
  reservationCreated: (type: string) =>
    trackEvent({ action: 'reservation_created', category: 'reserva', label: type }),
  whatsappClick: (context: string) =>
    trackEvent({ action: 'whatsapp_click', category: 'contacto', label: context }),
  loginMethod: (method: string) =>
    trackEvent({ action: 'login', category: 'auth', label: method }),
  walletTopUp: (amount: number) =>
    trackEvent({ action: 'wallet_topup', category: 'wallet', value: amount }),
  loyaltyRedeem: () =>
    trackEvent({ action: 'loyalty_redeem', category: 'lealtad' }),
  walkerView: () =>
    trackEvent({ action: 'page_view', category: 'navegacion', label: 'walker_perfil' }),
}
