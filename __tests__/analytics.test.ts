import { trackEvent, trackConversion, Events } from '../src/lib/analytics'

beforeEach(() => {
  delete (window as any).gtag
})

describe('trackEvent', () => {
  it('does not throw when gtag is undefined', () => {
    expect(() => trackEvent({ action: 'test', category: 'test' })).not.toThrow()
  })

  it('calls gtag with correct params when available', () => {
    const gtag = jest.fn()
    ;(window as any).gtag = gtag

    trackEvent({ action: 'test_action', category: 'test_cat', label: 'test_label', value: 42 })

    expect(gtag).toHaveBeenCalledWith('event', 'test_action', {
      event_category: 'test_cat',
      event_label: 'test_label',
      value: 42,
    })
  })

  it('works without label and value', () => {
    const gtag = jest.fn()
    ;(window as any).gtag = gtag

    trackEvent({ action: 'minimal', category: 'test' })

    expect(gtag).toHaveBeenCalledWith('event', 'minimal', {
      event_category: 'test',
      event_label: undefined,
      value: undefined,
    })
  })
})

describe('trackConversion', () => {
  it('delegates to trackEvent with conversion category', () => {
    const gtag = jest.fn()
    ;(window as any).gtag = gtag

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
    ;(window as any).gtag = jest.fn()
  })

  it('quoteRequested tracks category', () => {
    Events.quoteRequested('cotidiano')
    expect((window as any).gtag).toHaveBeenCalledWith('event', 'quote_requested', {
      event_category: 'cotizacion',
      event_label: 'cotidiano',
      value: undefined,
    })
  })

  it('whatsappClick tracks context', () => {
    Events.whatsappClick('flotante')
    expect((window as any).gtag).toHaveBeenCalledWith('event', 'whatsapp_click', {
      event_category: 'contacto',
      event_label: 'flotante',
      value: undefined,
    })
  })

  it('loginMethod tracks method', () => {
    Events.loginMethod('google')
    expect((window as any).gtag).toHaveBeenCalledWith('event', 'login', {
      event_category: 'auth',
      event_label: 'google',
      value: undefined,
    })
  })

  it('walletTopUp tracks amount', () => {
    Events.walletTopUp(500)
    expect((window as any).gtag).toHaveBeenCalledWith('event', 'wallet_topup', {
      event_category: 'wallet',
      event_label: undefined,
      value: 500,
    })
  })

  it('reservationCreated tracks type', () => {
    Events.reservationCreated('cotidiano')
    expect((window as any).gtag).toHaveBeenCalledWith('event', 'reservation_created', {
      event_category: 'reserva',
      event_label: 'cotidiano',
      value: undefined,
    })
  })

  it('loyaltyRedeem fires event', () => {
    Events.loyaltyRedeem()
    expect((window as any).gtag).toHaveBeenCalledWith('event', 'loyalty_redeem', {
      event_category: 'lealtad',
      event_label: undefined,
      value: undefined,
    })
  })

  it('walkerView fires event', () => {
    Events.walkerView()
    expect((window as any).gtag).toHaveBeenCalledWith('event', 'page_view', {
      event_category: 'navegacion',
      event_label: 'walker_perfil',
      value: undefined,
    })
  })
})
