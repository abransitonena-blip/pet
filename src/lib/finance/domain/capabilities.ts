export type FinancialRole = 'admin' | 'supervisor' | 'cashier' | 'walker' | 'customer'

export const FINANCIAL_CAPABILITIES = [
  'finance.summary.read',
  'finance.payment.read',
  'finance.payment.record',
  'finance.payment.confirm',
  'finance.payment.refund',
  'finance.ticket.read',
  'finance.ticket.issue',
  'finance.ticket.reprint',
  'finance.cash.read',
  'finance.cash.close',
  'finance.expense.record',
  'finance.expense.approve',
  'finance.settlement.read',
  'finance.settlement.prepare',
  'finance.settlement.approve',
  'finance.price.manage',
  'finance.promotion.manage',
  'finance.audit.read',
] as const

export type FinancialCapability = (typeof FINANCIAL_CAPABILITIES)[number]

export const ROLE_CAPABILITY_CEILING = Object.freeze({
  admin: FINANCIAL_CAPABILITIES,
  supervisor: [
    'finance.summary.read',
    'finance.payment.read',
    'finance.ticket.read',
    'finance.cash.read',
    'finance.settlement.read',
  ],
  cashier: [
    'finance.summary.read',
    'finance.payment.read',
    'finance.payment.record',
    'finance.payment.confirm',
    'finance.ticket.read',
    'finance.ticket.issue',
    'finance.ticket.reprint',
    'finance.cash.read',
    'finance.cash.close',
    'finance.expense.record',
  ],
  walker: ['finance.settlement.read'],
  customer: ['finance.payment.read', 'finance.ticket.read'],
} as const satisfies Record<FinancialRole, readonly FinancialCapability[]>)

export function hasFinancialCapability(
  role: FinancialRole,
  explicitClaims: readonly string[],
  capability: FinancialCapability,
): boolean {
  const ceiling: readonly FinancialCapability[] = ROLE_CAPABILITY_CEILING[role]
  return ceiling.includes(capability) && explicitClaims.includes(capability)
}

export function allowedClaimedCapabilities(
  role: FinancialRole,
  explicitClaims: readonly string[],
): FinancialCapability[] {
  const ceiling: readonly FinancialCapability[] = ROLE_CAPABILITY_CEILING[role]
  return ceiling.filter((capability) => explicitClaims.includes(capability))
}
