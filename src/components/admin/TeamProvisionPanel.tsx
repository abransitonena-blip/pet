'use client'

import { useCallback, useEffect, useState } from 'react'
import { auth } from '@/firebase/config'
import { Card } from '@/components/ui'
import Button from '@/components/ui/Button'
import { ROLES, type Role } from '@/lib/roles'
import type { WalkerOperationalStatus } from '@/lib/adminWalkers'
import type { Zone } from '@/types'

/**
 * Alta y activación de personal sin Cloud Functions.
 *
 * The role claim is the only thing Firestore rules trust, and until now it
 * could only be set by a Cloud Function that cannot be deployed (no billing).
 * This panel drives /api/admin/team instead, which writes the claim through
 * the Identity Toolkit REST API with the server's federated identity.
 *
 * Deliberately does NOT create accounts or handle passwords: the person signs
 * up through the normal flow, then an admin looks their email up here and
 * grants the role.
 */

interface TeamProvisionPanelProps {
  zones: Zone[]
  onProvisioned?: () => void
}

interface LookupResult {
  uid: string
  email: string
  displayName: string
  role: Role | null
  disabled: boolean
}

type WalkerStatus = WalkerOperationalStatus

const ROLE_LABELS: Record<Role, string> = {
  customer: 'Familia (cliente)',
  walker: 'Paseador',
  supervisor: 'Supervisor',
  admin: 'Administrador',
}

const STATUS_LABELS: Record<WalkerStatus, string> = {
  active: 'Activo — puede recibir asignaciones',
  inactive: 'Inactivo — no recibe asignaciones',
  suspended: 'Suspendido — acceso bloqueado',
}

export default function TeamProvisionPanel({ zones, onProvisioned }: TeamProvisionPanelProps) {
  const [email, setEmail] = useState('')
  const [lookup, setLookup] = useState<LookupResult | null>(null)
  const [role, setRole] = useState<Role>(ROLES.WALKER)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [status, setStatus] = useState<WalkerStatus>('active')
  const [selectedZones, setSelectedZones] = useState<string[]>([])
  const [busy, setBusy] = useState<'lookup' | 'assign' | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    setLookup(null)
    setError('')
    setNotice('')
  }, [email])

  const call = useCallback(async (payload: Record<string, unknown>) => {
    const token = await auth.currentUser?.getIdToken()
    if (!token) throw new Error('auth-required')
    const response = await fetch('/api/admin/team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    })
    const result = await response.json().catch(() => ({})) as { code?: string; message?: string; user?: LookupResult; walkerProfileWritten?: boolean }
    if (!response.ok) throw new Error(result.message || messageForCode(result.code))
    return result
  }, [])

  const handleLookup = async () => {
    if (!email.trim()) return
    setBusy('lookup')
    setError('')
    setNotice('')
    try {
      const result = await call({ action: 'lookup', email })
      if (result.user) {
        setLookup(result.user)
        setRole(result.user.role ?? ROLES.WALKER)
        setName(result.user.displayName || '')
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos consultar la cuenta.')
    } finally {
      setBusy(null)
    }
  }

  const handleAssign = async () => {
    if (!lookup) return
    setBusy('assign')
    setError('')
    setNotice('')
    try {
      const result = await call({
        email,
        role,
        name: name.trim(),
        phone: phone.trim(),
        zones: selectedZones,
        status,
      })
      setLookup(result.user ?? lookup)
      setNotice(role === ROLES.WALKER
        ? `Rol de paseador asignado${result.walkerProfileWritten ? ' y perfil operativo creado' : ''}. La persona debe cerrar sesión y volver a entrar para que su token tome el nuevo rol.`
        : `Rol ${ROLE_LABELS[role]} asignado. La persona debe cerrar sesión y volver a entrar.`)
      onProvisioned?.()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos asignar el rol.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card className="p-4 shadow-none sm:p-5">
      <div className="mb-4">
        <h2 className="text-base font-bold text-ink">Alta y activación de personal</h2>
        <p className="mt-1 text-xs text-muted">
          La persona se registra primero en la app con su correo. Después búscala aquí para asignarle
          su rol y, si es paseador, activar su perfil operativo. No se crean contraseñas desde este panel.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="correo@ejemplo.com"
          aria-label="Correo de la cuenta"
          className="input-field flex-1"
        />
        <Button onClick={handleLookup} disabled={busy !== null || !email.trim()} variant="secondary">
          {busy === 'lookup' ? 'Buscando…' : 'Buscar cuenta'}
        </Button>
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-xl bg-danger-500/10 px-3 py-2 text-xs text-red-700">{error}</p>
      )}
      {notice && (
        <p role="status" className="mt-3 rounded-xl bg-success/10 px-3 py-2 text-xs font-medium text-success-700">{notice}</p>
      )}

      {lookup && (
        <div className="mt-4 space-y-4 border-t border-border pt-4">
          <dl className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <dt className="text-muted">Cuenta</dt>
              <dd className="font-medium text-ink break-all">{lookup.email}</dd>
            </div>
            <div>
              <dt className="text-muted">UID</dt>
              <dd className="font-mono text-[11px] text-ink break-all">{lookup.uid}</dd>
            </div>
            <div>
              <dt className="text-muted">Rol actual</dt>
              <dd className="font-medium text-ink">{lookup.role ? ROLE_LABELS[lookup.role] : 'Sin rol asignado'}</dd>
            </div>
            <div>
              <dt className="text-muted">Estado de la cuenta</dt>
              <dd className="font-medium text-ink">{lookup.disabled ? 'Deshabilitada' : 'Habilitada'}</dd>
            </div>
          </dl>

          <div className="space-y-1">
            <label htmlFor="provision-role" className="text-xs font-medium text-muted">Rol a asignar</label>
            <select
              id="provision-role"
              value={role}
              onChange={(event) => setRole(event.target.value as Role)}
              className="input-field"
            >
              {(Object.keys(ROLE_LABELS) as Role[]).map((value) => (
                <option key={value} value={value}>{ROLE_LABELS[value]}</option>
              ))}
            </select>
          </div>

          {role === ROLES.WALKER && (
            <div className="space-y-3 rounded-xl bg-ink/[0.03] p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label htmlFor="provision-name" className="text-xs font-medium text-muted">Nombre</label>
                  <input id="provision-name" value={name} onChange={(e) => setName(e.target.value)} className="input-field" placeholder="Nombre del paseador" />
                </div>
                <div className="space-y-1">
                  <label htmlFor="provision-phone" className="text-xs font-medium text-muted">Teléfono</label>
                  <input id="provision-phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="input-field" placeholder="10 dígitos" inputMode="tel" />
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="provision-status" className="text-xs font-medium text-muted">Estado operativo</label>
                <select id="provision-status" value={status} onChange={(e) => setStatus(e.target.value as WalkerStatus)} className="input-field">
                  {(Object.keys(STATUS_LABELS) as WalkerStatus[]).map((value) => (
                    <option key={value} value={value}>{STATUS_LABELS[value]}</option>
                  ))}
                </select>
                <p className="text-[11px] text-muted">
                  Solo un paseador con estado <strong>activo</strong> puede ser asignado a un paseo y mover su estado.
                </p>
              </div>

              {zones.length > 0 && (
                <div className="space-y-1">
                  <span className="text-xs font-medium text-muted">Zonas</span>
                  <div className="flex flex-wrap gap-1.5">
                    {zones.map((zone) => {
                      const selected = selectedZones.includes(zone.name)
                      return (
                        <button
                          key={zone.id}
                          type="button"
                          onClick={() => setSelectedZones(selected
                            ? selectedZones.filter((value) => value !== zone.name)
                            : [...selectedZones, zone.name])}
                          className={`min-h-9 rounded-full border px-3 text-[11px] font-medium transition-colors ${selected ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted'}`}
                          aria-pressed={selected}
                        >
                          {zone.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          <Button onClick={handleAssign} disabled={busy !== null} className="w-full">
            {busy === 'assign' ? 'Aplicando…' : `Asignar rol de ${ROLE_LABELS[role].toLowerCase()}`}
          </Button>
        </div>
      )}
    </Card>
  )
}

function messageForCode(code: string | undefined): string {
  if (code === 'user-not-found') return 'No existe una cuenta con ese correo. Pide a la persona que se registre primero.'
  if (code === 'admin-required') return 'Tu sesión no tiene rol de administrador.'
  if (code === 'self-demotion-blocked') return 'No puedes quitarte a ti mismo el rol de administrador.'
  if (code === 'profile-not-written') return 'El rol se asignó, pero no se pudo crear el perfil operativo en este entorno.'
  return 'No pudimos completar la operación.'
}
