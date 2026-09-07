import { FinancialDomainError } from './errors'

export const MXN = 'MXN' as const
export type Currency = typeof MXN

export interface Money {
  readonly amountCents: number
  readonly currency: Currency
}

export type RoundingMode = 'floor' | 'ceil' | 'half-up'

export function assertCents(value: number, field = 'amountCents'): number {
  if (!Number.isSafeInteger(value)) {
    throw new FinancialDomainError(
      Number.isInteger(value) ? 'UNSAFE_INTEGER' : 'INVALID_MONEY',
      `${field} must be a safe integer number of cents`,
      { field },
    )
  }
  return value
}

export function money(amountCents: number): Money {
  return Object.freeze({ amountCents: assertCents(amountCents), currency: MXN })
}

export function assertMoney(value: Money, field = 'money'): Money {
  if (!value || value.currency !== MXN) {
    throw new FinancialDomainError('CURRENCY_MISMATCH', `${field} must use MXN`, { field })
  }
  assertCents(value.amountCents, `${field}.amountCents`)
  return value
}

export function requireNonNegative(value: Money, field = 'money'): Money {
  assertMoney(value, field)
  if (value.amountCents < 0) {
    throw new FinancialDomainError('INVALID_MONEY', `${field} cannot be negative`, { field })
  }
  return value
}

export function requirePositive(value: Money, field = 'money'): Money {
  assertMoney(value, field)
  if (value.amountCents <= 0) {
    throw new FinancialDomainError('INVALID_MONEY', `${field} must be greater than zero`, { field })
  }
  return value
}

function safeFromBigInt(value: bigint): number {
  const result = Number(value)
  if (!Number.isSafeInteger(result)) {
    throw new FinancialDomainError('UNSAFE_INTEGER', 'Money operation exceeded the safe integer range')
  }
  return result
}

export function addMoney(left: Money, right: Money): Money {
  assertMoney(left, 'left')
  assertMoney(right, 'right')
  return money(safeFromBigInt(BigInt(left.amountCents) + BigInt(right.amountCents)))
}

export function subtractMoney(left: Money, right: Money): Money {
  assertMoney(left, 'left')
  assertMoney(right, 'right')
  return money(safeFromBigInt(BigInt(left.amountCents) - BigInt(right.amountCents)))
}

export function sumMoney(values: readonly Money[]): Money {
  values.forEach((value, index) => assertMoney(value, `values[${index}]`))
  return money(safeFromBigInt(values.reduce((total, value) => total + BigInt(value.amountCents), BigInt(0))))
}

export function multiplyMoney(value: Money, quantity: number): Money {
  assertMoney(value)
  if (!Number.isSafeInteger(quantity) || quantity < 0) {
    throw new FinancialDomainError('INVALID_QUANTITY', 'quantity must be a non-negative safe integer')
  }
  return money(safeFromBigInt(BigInt(value.amountCents) * BigInt(quantity)))
}

export function ratioOfMoney(
  value: Money,
  numerator: number,
  denominator: number,
  rounding: RoundingMode,
): Money {
  requireNonNegative(value)
  if (!Number.isSafeInteger(numerator) || numerator < 0 || !Number.isSafeInteger(denominator) || denominator <= 0) {
    throw new FinancialDomainError('INVALID_MONEY', 'ratio operands must be non-negative safe integers with a positive denominator')
  }

  const product = BigInt(value.amountCents) * BigInt(numerator)
  const divisor = BigInt(denominator)
  let quotient = product / divisor
  const remainder = product % divisor

  if (rounding === 'ceil' && remainder !== BigInt(0)) quotient += BigInt(1)
  if (rounding === 'half-up' && remainder * BigInt(2) >= divisor) quotient += BigInt(1)

  return money(safeFromBigInt(quotient))
}

export function moneyEquals(left: Money, right: Money): boolean {
  return left.currency === right.currency && left.amountCents === right.amountCents
}
