import { trackEvent, trackConversion, Events } from '../src/lib/analytics'

type Gtag = (...args: unknown[]) => void

const gtagWindow = () => window as unknown as { gtag?: Gtag; __petAnalyticsEnabled?: boolean }

beforeEach(() => {
  delete gtagWindow().gtag
  gtagWindow().__petAnalyticsEnabled = false
})

describe('trackEvent', () => {
  it('does not throw when gtag is undefined', () => {
    expect(() => trackEvent({ action: 'test', category: 'test' })).not.toThrow()
  })

  it('calls gtag with correct params when available', () => {
    const gtag = jest.fn()
    ;gtagWindow().gtag = gtag
    gtagWindow().__petAnalyticsEnabled = true

    trackEvent({ action: 'test_action', category: 'test_cat', label: 'test_label', value: 42 })

    expect(gtag).toHaveBeenCalledWith('event', 'test_action', {
      event_category: 'test_cat',
      event_label: 'test_label',
      value: 42,
    })
  })

  it('works without label and value', () => {
    const gtag = jest.fn()
    ;gtagWindow().gtag = gtag
    gtagWindow().__petAnalyticsEnabled = true

    trackEvent({ action: 'minimal', category: 'test' })

    expect(gtag).toHaveBeenCalledWith('event', 'minimal', {
      event_category: 'test',
      event_label: undefined,
      value: undefined,
    })
  })

  it('does not send events when analytics consent is not active', () => {
    const gtag = jest.fn()
    ;gtagWindow().gtag = gtag

    trackEvent({ action: 'blocked', category: 'test' })

    expect(gtag).not.toHaveBeenCalled()
  })
})

describe('trackConversion', () => {
  it('delegates to trackEvent with conversion category', () => {
    const gtag = jest.fn()
    ;gtagWindow().gtag = gtag
    gtagWindow().__petAnalyticsEnabled = true

    trackConversion('signup', 100)

    expect(gtag).toHaveBeenCalledWith('event', 'conversion', {
      event_category: 'conversion',
      event_label: 'signup',
      value: 100,
    })
  })
})

describe('Events', () => {
  beforeEach(() => {
    ;gtagWindow().gtag = jest.fn()
    gtagWindow().__petAnalyticsEnabled = true
  })

  it('quoteRequested tracks category', () => {
    Events.quoteRequested('cotidiano')
    expect(gtagWindow().gtag).toHaveBeenCalledWith('event', 'quote_requested', {
      event_category: 'cotizacion',
      event_label: 'cotidiano',
      value: undefined,
    })
  })

  it('whatsappClick tracks context', () => {
    Events.whatsappClick('flotante')
    expect(gtagWindow().gtag).toHaveBeenCalledWith('event', 'whatsapp_click', {
      event_category: 'contacto',
      event_label: 'flotante',
      value: undefined,
    })
  })

  it('loginMethod tracks method', () => {
    Events.loginMethod('google')
    expect(gtagWindow().gtag).toHaveBeenCalledWith('event', 'login', {
      event_category: 'auth',
      event_label: 'google',
      value: undefined,
    })
  })

  it('walletTopUp tracks amount', () => {
    Events.walletTopUp(500)
    expect(gtagWindow().gtag).toHaveBeenCalledWith('event', 'wallet_topup', {
      event_category: 'wallet',
      event_label: undefined,
      value: 500,
    })
  })

  it('reservationCreated tracks type', () => {
    Events.reservationCreated('cotidiano')
    expect(gtagWindow().gtag).toHaveBeenCalledWith('event', 'reservation_created', {
      event_category: 'reserva',
      event_label: 'cotidiano',
      value: undefined,
    })
  })

  it('loyaltyRedeem fires event', () => {
    Events.loyaltyRedeem()
    expect(gtagWindow().gtag).toHaveBeenCalledWith('event', 'loyalty_redeem', {
      event_category: 'lealtad',
      event_label: undefined,
      value: undefined,
    })
  })

  it('walkerView fires event', () => {
    Events.walkerView()
    expect(gtagWindow().gtag).toHaveBeenCalledWith('event', 'page_view', {
      event_category: 'navegacion',
      event_label: 'walker_perfil',
      value: undefined,
    })
  })
})
