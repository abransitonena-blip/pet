'use client'

import { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Logo } from '@/components/ui/Logo'
import { LogOut } from 'lucide-react'

interface NavItem {
  id: string
  label: string
  href: string
  icon?: React.ComponentType<{ size?: number | string; }>
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
}: AppShellProps) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      <header
        className="border-b sticky top-0 z-10"
        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border)' }}
      >
        <div className="section-container h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href={logoHref} aria-label="PET Ap">
              <Logo size={36} />
            </Link>
            <div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{userRole}</p>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{userName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="text-xs px-4 py-2 rounded-lg transition-all hover:bg-ink/5"
              style={{ color: 'var(--text-muted)' }}
            >
              Inicio
            </Link>
            <button
              onClick={onLogout}
              className="w-11 h-11 rounded-lg flex items-center justify-center transition-colors hover:bg-danger-500/10 hover:text-danger-400"
              style={{ color: 'var(--text-muted)' }}
              aria-label="Cerrar sesión"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </header>

      <div className="section-container py-8">
        <div className="grid lg:grid-cols-4 gap-6">
          <aside className="lg:col-span-1">
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon
                const active = pathname === item.href
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all hover:bg-ink/5 ${active ? 'bg-brand-500/10 text-brand-600' : ''}`}
                    style={{ color: active ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                  >
                    {Icon && <Icon size={16} />}
                    {item.label}
                  </Link>
                )
              })}
            </nav>
          </aside>

          <div className="lg:col-span-3">
            {toastProvider}
            {children}
          </div>
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

      {headerExtra}
    </div>
  )
}