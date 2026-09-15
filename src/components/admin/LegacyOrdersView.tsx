'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronRight, Package } from 'lucide-react'
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/sessionMachine'
import type { SessionStatus } from '@/types'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import { useServiceOrders } from '@/lib/useServiceOrders'

/**
 * Paquetes anteriores, sólo para consulta. Su lectura de `serviceOrders` se
 * hacía al abrir Solicitudes aunque la pestaña no estuviera a la vista.
 */
export default function LegacyOrdersView() {
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)
  const { orders } = useServiceOrders()

  return (
        <div className="space-y-3">
          <div className="rounded-xl border border-warning/20 bg-warning/10 px-4 py-3 text-sm text-amber-900" role="note">
            Vista transitoria de órdenes anteriores, disponible únicamente para consulta. La revisión y asignación nueva se realiza en Solicitudes canónicas.
          </div>
          {orders.length === 0 ? (
            <EmptyState icon={<Package size={24} />} title="No hay paquetes semanales activos" />
          ) : (
            orders.map((order) => {
              const isExpanded = expandedOrder === order.id
              const scheduledSessions = order.sessions.filter((s) => s.sessionStatus !== 'cancelled')
              const completedSessions = order.sessions.filter((s) => s.sessionStatus === 'completed')
              return (
                <div key={order.id} className="rounded-xl border border-ink/10 bg-surface shadow-sm overflow-hidden">
                  <button
                    onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-ink/5 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{order.customerName}</span>
                        <Badge variant={order.status === 'confirmed' ? 'success' : order.status === 'completed' ? 'default' : 'danger'}>
                          {order.status === 'confirmed' ? 'Confirmado' : order.status === 'completed' ? 'Completado' : order.status}
                        </Badge>
                        <span className="text-2xs px-2 py-0.5 rounded-full bg-brand-500/15 text-brand-600 font-medium">
                          {completedSessions.length}/{scheduledSessions.length} sesiones
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                        <span>🐾 {order.dogName}</span>
                        <span>📋 {order.serviceName}</span>
                        <span>📞 {order.customerPhone}</span>
                        {order.total > 0 && <span className="font-medium" style={{ color: 'var(--text-primary)' }}>${order.total.toLocaleString()} MXN</span>}
                      </div>
                    </div>
                    {isExpanded ? <ChevronDown size={12} style={{ color: 'var(--text-muted)' }} /> : <ChevronRight size={12} style={{ color: 'var(--text-muted)' }} />}
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} className="overflow-hidden">
                        <div className="border-t border-ink/10 px-4 pb-4 space-y-2">
                          {order.sessions.map((session) => (
                            <div key={session.id} className="flex items-center justify-between py-2 px-3 rounded-lg text-xs" style={{ background: 'var(--glass-bg)' }}>
                              <div className="flex items-center gap-3">
                                <span className="capitalize" style={{ color: 'var(--text-secondary)' }}>
                                  {new Date(session.date + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })}
                                </span>
                                <span style={{ color: 'var(--text-muted)' }}>🕐 {session.startTime}</span>
                                {session.walkerName && <span style={{ color: 'var(--text-muted)' }}>🦮 {session.walkerName}</span>}
                              </div>
                              <span className={`text-2xs px-2 py-0.5 rounded-full font-medium ${
                                STATUS_COLORS[session.sessionStatus as SessionStatus]?.bg || 'bg-brand-500/15'
                              } ${STATUS_COLORS[session.sessionStatus as SessionStatus]?.text || 'text-brand-400'}`}>
                                {STATUS_LABELS[session.sessionStatus as SessionStatus] || session.sessionStatus}
                              </span>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })
          )}
        </div>
  )
}
