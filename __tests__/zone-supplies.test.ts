import { MAX_DELIVERY_QUANTITY, isLowStock, isValidQuantity, validateDelivery } from '@/lib/zoneSupplies'

describe('isValidQuantity', () => {
  it('acepta enteros positivos dentro del tope', () => {
    expect(isValidQuantity(1)).toBe(true)
    expect(isValidQuantity(MAX_DELIVERY_QUANTITY)).toBe(true)
  })

  it('rechaza cero, negativos, fracciones y lo que pase del tope', () => {
    expect(isValidQuantity(0)).toBe(false)
    expect(isValidQuantity(-3)).toBe(false)
    expect(isValidQuantity(1.5)).toBe(false)
    expect(isValidQuantity(MAX_DELIVERY_QUANTITY + 1)).toBe(false)
  })

  it('rechaza lo que no es número', () => {
    expect(isValidQuantity('5')).toBe(false)
    expect(isValidQuantity(null)).toBe(false)
    expect(isValidQuantity(undefined)).toBe(false)
  })
})

describe('validateDelivery', () => {
  it('entrega válida cuando hay suficiente stock', () => {
    expect(validateDelivery(5, 10)).toEqual({ ok: true })
  })

  it('entrega exacta del stock restante, válida', () => {
    expect(validateDelivery(10, 10)).toEqual({ ok: true })
  })

  it('nunca deja el stock en negativo', () => {
    expect(validateDelivery(11, 10)).toEqual({ ok: false, code: 'insufficient-stock' })
  })

  it('una cantidad inválida se rechaza antes de mirar el stock', () => {
    expect(validateDelivery(-1, 10)).toEqual({ ok: false, code: 'invalid-quantity' })
    expect(validateDelivery('todo', 10)).toEqual({ ok: false, code: 'invalid-quantity' })
  })
})

describe('isLowStock', () => {
  it('por debajo o igual al umbral, es poco', () => {
    expect(isLowStock(5, 5)).toBe(true)
    expect(isLowStock(3, 5)).toBe(true)
  })

  it('arriba del umbral, no es poco', () => {
    expect(isLowStock(6, 5)).toBe(false)
  })
})
