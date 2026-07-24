'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/firebase/config'
import { ReservationsProvider } from '@/context/ReservationsContext'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FaDog, FaTachometerAlt, FaCalendarAlt, FaUsers, FaPaw, FaWalking,
  FaMapMarkedAlt, FaDollarSign, FaTag, FaUserFriends, FaStar,
  FaChartLine, FaCog, FaClipboardList, FaRobot, FaSignOutAlt,
  FaChevronLeft, FaChevronRight, FaBars,
} from 'react-icons/fa'

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: FaTachometerAlt, href: '/admin' },
  { id: 'reservas', label: 'Reservas', icon: FaCalendarAlt, href: '/admin/reservas' },
  { id: 'clientes', label: 'Clientes', icon: FaUsers, href: '/admin/clientes' },
  { id: 'perros', label: 'Perros', icon: FaPaw, href: '/admin/perros' },
  { id: 'paseadores', label: 'Paseadores', icon: FaWalking, href: '/admin/paseadores' },
  { id: 'rutas', label: 'Rutas', icon: FaMapMarkedAlt, href: '/admin/rutas' },
  { id: 'finanzas', label: 'Finanzas', icon: FaDollarSign, href: '/admin/finanzas' },
  { id: 'cupones', label: 'Cupones', icon: FaTag, href: '/admin/cupones' },
  { id: 'referidos', label: 'Referidos', icon: FaUserFriends, href: '/admin/referidos' },
  { id: 'resenas', label: 'Reseñas', icon: FaStar, href: '/admin/resenas' },
  { id: 'analitica', label: 'Analítica', icon: FaChartLine, href: '/admin/analitica' },
  { id: 'config', label: 'Configuración', icon: FaCog, href: '/admin/config' },
  { id: 'logs', label: 'Logs', icon: FaClipboardList, href: '/admin/logs' },
  { id: 'ia', label: 'Centro IA', icon: FaRobot, href: '/admin/ia' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/login')
        return
      }
      const userSnap = await getDoc(doc(db, 'users', user.uid))
      const isAdmin = userSnap.exists() && userSnap.data()?.role === 'admin'
      if (!isAdmin) {
        await signOut(auth)
        router.push('/login')
        return
      }
      setLoading(false)
    })
    return unsub
  }, [router])

  const handleLogout = async () => {
    document.cookie = '__session=; path=/; max-age=0'
    await signOut(auth)
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <div className="text-center">
          <FaDog className="text-brand-500 text-3xl mx-auto mb-3 animate-pulse" />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Cargando centro de operaciones...</p>
        </div>
      </div>
    )
  }

  return (
    <ReservationsProvider>
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
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center text-white shrink-0">
            <FaDog size={16} />
          </div>
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
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const active = pathname === item.href || (item.href === '/admin' && pathname === '/admin')
            return (
              <a
                key={item.id}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  active ? 'bg-brand-500/10 text-brand-400' : ''
                }`}
                style={{ color: active ? undefined : 'var(--text-secondary)' }}
                title={collapsed ? item.label : undefined}
              >
                <Icon size={16} className="shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </a>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t shrink-0" style={{ borderColor: 'var(--border)' }}>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all hover:bg-danger-500/10 hover:text-danger-400"
            style={{ color: 'var(--text-secondary)' }}
          >
            <FaSignOutAlt size={16} className="shrink-0" />
            {!collapsed && <span>Cerrar sesión</span>}
          </button>
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute top-20 -right-3 w-6 h-6 rounded-full flex items-center justify-center text-xs border"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}
        >
          {collapsed ? <FaChevronRight size={8} /> : <FaChevronLeft size={8} />}
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
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileOpen(false)}
          />
          <motion.div
            initial={{ x: -256 }}
            animate={{ x: 0 }}
            exit={{ x: -256 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="absolute left-0 top-0 bottom-0 w-64 p-3 overflow-y-auto"
            style={{ background: 'var(--bg-card)' }}
          >
            <div className="flex items-center gap-3 mb-6 px-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center text-white">
                <FaDog size={16} />
              </div>
              <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>PET Ap</span>
            </div>
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              const active = pathname === item.href
              return (
                <a
                  key={item.id}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    active ? 'bg-brand-500/10 text-brand-400' : ''
                  }`}
                  style={{ color: active ? undefined : 'var(--text-secondary)' }}
                >
                  <Icon size={16} className="shrink-0" />
                  <span>{item.label}</span>
                </a>
              )
            })}
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
              className="lg:hidden w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ color: 'var(--text-secondary)' }}
            >
              <FaBars size={16} />
            </button>
            <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Centro de Operaciones
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <a href="/" className="text-xs px-3 py-1.5 rounded-lg transition-all hover:bg-white/5" style={{ color: 'var(--text-muted)' }}>
              Ver sitio
            </a>
          </div>
        </div>

        {/* Page content */}
        <main className="p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
    </ReservationsProvider>
  )
}
