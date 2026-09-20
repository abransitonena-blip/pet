'use client'

import { useEffect, useState, ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { LogOut, ChevronLeft, ChevronRight, Menu, X } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { isPanelRouteActive } from '@/lib/navigation'
import NavBadge from '@/components/ui/NavBadge'
import OfflineNotice from '@/components/layout/OfflineNotice'

interface NavItem {
  id: string
  label: string
  href: string
  icon?: React.ComponentType<{ size?: number | string }>
  color?: string
  group?: string
  /** Cuántas cosas sin leer esperan ahí. Sin badge cuando es 0. */
  badge?: number
}

interface AdminShellProps {
  children: ReactNode
  navItems: NavItem[]
  title?: string
  logoHref?: string
  version?: { commit?: string; environment?: string } | null
  onLogout: () => void
}

export default function AdminShell({
  children,
  navItems,
  title = 'Centro de Operaciones',
  logoHref = '/',
  version,
  onLogout,
}: AdminShellProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const reduceMotion = useReducedMotion()

  const activeItem = navItems.find((item) => isPanelRouteActive(pathname, item.href))
  const navGroups = navItems.reduce<Array<{ label: string; items: NavItem[] }>>((groups, item) => {
    const label = item.group || 'General'
    const current = groups.find((group) => group.label === label)
    if (current) current.items.push(item)
    else groups.push({ label, items: [item] })
    return groups
  }, [])

  useEffect(() => {
    if (!mobileOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false)
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [mobileOpen])

  const renderNav = (item: NavItem, onNavigate?: () => void, forceExpanded = false) => {
    const Icon = item.icon
    const active = isPanelRouteActive(pathname, item.href)
    const showLabel = forceExpanded || !collapsed
    return (
      <Link
        key={item.id}
        href={item.href}
        onClick={onNavigate}
        aria-current={active ? 'page' : undefined}
        aria-label={showLabel ? undefined : item.label}
        className={`flex min-h-11 items-center gap-3 rounded-xl px-4 py-2 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none ${
          active ? 'bg-brand-500/10 text-brand-600' : ''
        }`}
        style={{ color: active ? undefined : 'var(--text-secondary)' }}
        title={collapsed ? item.label : undefined}
      >
        {Icon && (
          <span className="shrink-0" style={item.color && !active ? { color: item.color } : undefined}>
            <Icon size={16} />
          </span>
        )}
        {showLabel && <span className="truncate">{item.label}</span>}
        {showLabel && item.badge !== undefined && <NavBadge count={item.badge} label="sin leer" className="ml-auto" />}
      </Link>
    )
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg-primary)' }}>
      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 72 : 256 }}
        transition={{ duration: reduceMotion ? 0 : 0.2 }}
        className="hidden lg:flex flex-col border-r shrink-0 sticky top-0 h-screen overflow-hidden"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
      >
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
          <Link href={logoHref} aria-label="PET Ap" className="flex h-11 w-11 items-center justify-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <Logo size={36} />
          </Link>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="ml-3 text-sm font-bold"
              style={{ color: 'var(--text-primary)' }}
            >
              PET Ap
            </motion.span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Navegación de administración">
          {navGroups.map((group, index) => (
            <div key={group.label} className={index > 0 ? 'mt-4' : ''}>
              {!collapsed && (
                <p className="px-4 pb-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted">
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">{group.items.map((item) => renderNav(item))}</div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t shrink-0" style={{ borderColor: 'var(--border)' }}>
          <button
            onClick={onLogout}
            className="flex min-h-11 w-full items-center gap-3 rounded-xl px-4 py-2 text-sm font-medium transition-colors hover:bg-danger-500/10 hover:text-danger-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-500 motion-reduce:transition-none"
            style={{ color: 'var(--text-secondary)' }}
            aria-label="Cerrar sesión"
          >
            <LogOut size={16} className="shrink-0" />
            {!collapsed && <span>Cerrar sesión</span>}
          </button>
          {!collapsed && version && (
            <div className="mt-2 px-3 py-1.5">
              <p className="text-2xs" style={{ color: 'var(--text-muted)' }}>
                v2026.07.29 · {version.commit?.slice(0, 7) || 'dev'}
              </p>
              <p className="text-2xs" style={{ color: 'var(--text-muted)' }}>
                {version.environment || 'local'}
              </p>
            </div>
          )}
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute top-20 -right-3 w-11 h-11 rounded-full flex items-center justify-center text-sm border"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}
          aria-label={collapsed ? 'Expandir barra lateral' : 'Contraer barra lateral'}
          aria-expanded={!collapsed}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </motion.aside>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-[var(--z-overlay)] lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.2 }}
              className="absolute inset-0 bg-black/60"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial={{ x: -256 }}
              animate={{ x: 0 }}
              exit={{ x: -256 }}
              transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 30 }}
              className="absolute bottom-0 left-0 top-0 w-[min(88vw,19rem)] overflow-y-auto p-3"
              style={{ background: 'var(--bg-card)' }}
              role="dialog"
              aria-modal="true"
              aria-label="Menú de administración"
            >
              <div className="mb-5 flex min-h-11 items-center justify-between gap-3 px-2">
                <div className="flex items-center gap-3">
                  <Logo size={36} />
                  <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>PET Ap</span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="flex h-11 w-11 items-center justify-center rounded-xl text-muted hover:bg-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  aria-label="Cerrar menú de navegación"
                >
                  <X size={18} aria-hidden="true" />
                </button>
              </div>
              {navGroups.map((group, index) => (
                <div key={group.label} className={index > 0 ? 'mt-4' : ''}>
                  <p className="px-4 pb-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted">{group.label}</p>
                  <div className="space-y-0.5">
                    {group.items.map((item) => renderNav(item, () => setMobileOpen(false), true))}
                  </div>
                </div>
              ))}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Top bar */}
        <div className="h-16 flex items-center justify-between px-4 sm:px-6 border-b sticky top-0 z-10" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden w-11 h-11 rounded-lg flex items-center justify-center"
              style={{ color: 'var(--text-secondary)' }}
              aria-label="Abrir menú de navegación"
              aria-expanded={mobileOpen}
            >
              <Menu size={16} />
            </button>
            <div className="min-w-0">
              <p className="hidden text-[0.68rem] font-medium uppercase tracking-[0.12em] text-muted sm:block">{title}</p>
              <h1 className="truncate text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{activeItem?.label || title}</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/" className="inline-flex min-h-11 items-center rounded-lg px-4 text-xs transition-colors hover:bg-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" style={{ color: 'var(--text-muted)' }}>
              Inicio
            </Link>
          </div>
        </div>

        {/* Sin señal, lo que se ve puede estar viejo: la caché vive en disco. */}
        <OfflineNotice />

        {/* Page content */}
        <main id="main-content" className="min-w-0 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
