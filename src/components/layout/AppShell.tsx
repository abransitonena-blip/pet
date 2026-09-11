'use client'

import { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Logo } from '@/components/ui/Logo'
import { LogOut } from 'lucide-react'
import { isPanelRouteActive } from '@/lib/navigation'

interface NavItem {
  id: string
  label: string
  href: string
  icon?: React.ComponentType<{ size?: number | string; }>
  /** Optional heading: consecutive items with the same group are listed under it. */
  group?: string
}

function groupNavItems(items: NavItem[]): Array<{ group: string; items: NavItem[] }> {
  const groups: Array<{ group: string; items: NavItem[] }> = []
  items.forEach((item) => {
    const group = item.group ?? ''
    const last = groups[groups.length - 1]
    if (last && last.group === group) last.items.push(item)
    else groups.push({ group, items: [item] })
  })
  return groups
}

interface AppShellProps {
  children: ReactNode
  navItems: NavItem[]
  userName: string
  userRole: string
  onLogout: () => void
  logoHref?: string
  headerExtra?: ReactNode
  mustChangePassword?: boolean
  toastProvider?: ReactNode
  mobileNavigation?: boolean
  showLogoutLabel?: boolean
}

export default function AppShell({
  children,
  navItems,
  userName,
  userRole,
  onLogout,
  logoHref = '/',
  headerExtra,
  mustChangePassword,
  toastProvider,
  mobileNavigation = false,
  showLogoutLabel = false,
}: AppShellProps) {
  const pathname = usePathname()
  const activeItem = navItems.find((item) => isPanelRouteActive(pathname, item.href)) ?? navItems[0]

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      <header
        className="border-b sticky top-0 z-10"
        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border)' }}
      >
        <div className="section-container min-h-16 py-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* La marca va centrada en su propia caja cuadrada, y el rol con el
                nombre forman un bloque apretado: así el perrito queda a la
                misma altura óptica que el texto, no debajo. */}
            <Link
              href={logoHref}
              aria-label="PET Ap"
              className="grid h-11 w-11 place-items-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Logo size={32} />
            </Link>
            <div className="leading-tight">
              <p className="text-xs leading-none" style={{ color: 'var(--text-muted)' }}>{userRole}</p>
              <p className="mt-1 text-sm font-semibold leading-none" style={{ color: 'var(--text-primary)' }}>{userName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {headerExtra}
            <Link
              href="/"
              className="hidden min-h-11 items-center rounded-lg px-3 text-xs transition-colors hover:bg-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:inline-flex"
              style={{ color: 'var(--text-muted)' }}
            >
              Inicio
            </Link>
            <button
              onClick={onLogout}
              className="min-h-11 min-w-11 rounded-lg px-3 flex items-center justify-center gap-2 text-xs font-semibold transition-colors hover:bg-danger-500/10 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-500 motion-reduce:transition-none"
              style={{ color: 'var(--text-muted)' }}
              aria-label="Cerrar sesión"
            >
              <LogOut size={14} />
              {showLogoutLabel && <span className="hidden md:inline">Cerrar sesión</span>}
            </button>
          </div>
        </div>
      </header>

      {mobileNavigation && (
        <nav className="section-container py-3 lg:hidden" aria-label="Navegación del panel">
          {navItems.length <= 4 ? (
            <div className={`grid gap-1 ${navItems.length === 3 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'}`}>
              {navItems.map((item) => {
                const Icon = item.icon
                const active = isPanelRouteActive(pathname, item.href)
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={`flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 text-center text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none ${active ? 'bg-primary/10 text-primary' : 'text-muted hover:bg-ink/5 hover:text-ink'}`}
                  >
                    {Icon && <Icon size={15} aria-hidden="true" />}
                    <span className="truncate">{item.label}</span>
                  </Link>
                )
              })}
            </div>
          ) : (
            <details className="group rounded-xl border border-ink/10 bg-surface shadow-sm">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 text-sm font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary [&::-webkit-details-marker]:hidden">
                <span className="truncate">{activeItem?.label ?? 'Menú de Familia PET'}</span>
                <span className="text-xs font-medium text-muted group-open:hidden">Abrir menú</span>
                <span className="hidden text-xs font-medium text-muted group-open:inline">Cerrar menú</span>
              </summary>
              <div className="space-y-2 border-t border-ink/10 p-2">
                {groupNavItems(navItems).map(({ group, items }, index) => (
                  <div key={`${group}-${index}`}>
                    {group && <p className="px-3 pb-1 pt-1 text-2xs font-semibold uppercase tracking-[0.14em] text-muted">{group}</p>}
                    <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
                      {items.map((item) => {
                        const Icon = item.icon
                        const active = isPanelRouteActive(pathname, item.href)
                        return (
                          <Link
                            key={item.id}
                            href={item.href}
                            aria-current={active ? 'page' : undefined}
                            className={`flex min-h-11 min-w-0 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none ${active ? 'bg-primary/10 text-primary' : 'text-muted hover:bg-ink/5 hover:text-ink'}`}
                          >
                            {Icon && <Icon size={16} aria-hidden="true" />}
                            <span className="truncate">{item.label}</span>
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}
        </nav>
      )}

      <div className="section-container pb-10 pt-3 lg:py-8">
        <div className="grid lg:grid-cols-4 gap-6">
          <aside className={`${mobileNavigation ? 'hidden lg:block' : ''} lg:col-span-1`}>
            <nav className="space-y-4" aria-label="Navegación del panel">
              {groupNavItems(navItems).map(({ group, items }, index) => (
                <div key={`${group}-${index}`} className="space-y-1">
                  {group && <p className="px-4 pb-1 text-2xs font-semibold uppercase tracking-[0.14em] text-muted">{group}</p>}
                  {items.map((item) => {
                    const Icon = item.icon
                    const active = isPanelRouteActive(pathname, item.href)
                    return (
                      <Link
                        key={item.id}
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        className={`flex min-h-11 items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors hover:bg-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none ${active ? 'bg-brand-500/10 text-brand-600' : ''}`}
                        style={{ color: active ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                      >
                        {Icon && <Icon size={16} aria-hidden="true" />}
                        {item.label}
                      </Link>
                    )
                  })}
                </div>
              ))}
            </nav>
          </aside>

          <main id="main-content" className="min-w-0 lg:col-span-3">
            {toastProvider}
            {children}
          </main>
        </div>
      </div>

      {mustChangePassword && (
        <div className="bg-brand-500/10 border-b border-brand-500/20 px-4 py-3">
          <div className="section-container">
            <p className="text-xs font-medium text-brand-600">
              Debes cambiar tu contraseña temporal. Ve a tu perfil para actualizarla.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
