'use client'

import { useState, ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { LogOut, ChevronLeft, ChevronRight, Menu } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'

interface NavItem {
  id: string
  label: string
  href: string
  icon?: React.ComponentType<{ size?: number | string }>
  color?: string
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

  const isActive = (href: string) => pathname === href || (href !== '/' && pathname.startsWith(href))

  const renderNav = (item: NavItem, onNavigate?: () => void) => {
    const Icon = item.icon
    const active = isActive(item.href)
    return (
      <a
        key={item.id}
        href={item.href}
        onClick={onNavigate}
        className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${
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
        {!collapsed && <span className="truncate">{item.label}</span>}
      </a>
    )
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg-primary)' }}>
      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 72 : 256 }}
        className="hidden lg:flex flex-col border-r shrink-0 sticky top-0 h-screen overflow-hidden"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
      >
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
          <Link href={logoHref} aria-label="PET Ap">
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
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5" aria-label="Navegación de administración">
          {navItems.map((item) => renderNav(item))}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t shrink-0" style={{ borderColor: 'var(--border)' }}>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all hover:bg-danger-500/10 hover:text-danger-400"
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
          {collapsed ? <ChevronRight size={8} /> : <ChevronLeft size={8} />}
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
              transition={{ duration: 0.22 }}
              className="absolute inset-0 bg-black/60"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial={{ x: -256 }}
              animate={{ x: 0 }}
              exit={{ x: -256 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="absolute left-0 top-0 bottom-0 w-56 p-3 overflow-y-auto"
              style={{ background: 'var(--bg-card)' }}
              role="navigation"
              aria-label="Menú de administración"
            >
              <div className="flex items-center gap-3 mb-6 px-3">
                <Logo size={36} />
                <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>PET Ap</span>
              </div>
              <div className="space-y-0.5">
                {navItems.map((item) => renderNav({ ...item, href: item.href }, () => setMobileOpen(false)))}
              </div>
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
            <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {title}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-xs px-4 py-2 rounded-lg transition-all hover:bg-ink/5" style={{ color: 'var(--text-muted)' }}>
              Inicio
            </Link>
          </div>
        </div>

        {/* Page content */}
        <div className="p-4 sm:p-6 lg:p-8" role="region">
          {children}
        </div>
      </div>
    </div>
  )
}
