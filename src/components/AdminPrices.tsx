'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { usePrices, DEFAULT_PRICES } from '@/context/PricesContext'
import { SERVICES } from '@/lib/services'
import { FaSave, FaUndo } from 'react-icons/fa'

export default function AdminPrices() {
  const { prices, savePrices } = usePrices()
  const [editing, setEditing] = useState<Record<string, number>>({ ...prices })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await savePrices(editing)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const resetDefaults = () => {
    setEditing({ ...DEFAULT_PRICES })
  }

  const hasChanges = JSON.stringify(editing) !== JSON.stringify(prices)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">💰 Editar precios</h3>
        <div className="flex gap-2">
          <button
            onClick={resetDefaults}
            className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-white/40 hover:text-white/70 transition-all flex items-center gap-1"
          >
            <FaUndo size={10} /> Restaurar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="text-xs px-3 py-1.5 rounded-lg bg-gradient-to-r from-primary to-amber-600 text-white font-semibold hover:opacity-90 transition-all disabled:opacity-30 flex items-center gap-1"
          >
            <FaSave size={10} /> {saving ? 'Guardando...' : saved ? '✓ Guardado' : 'Guardar'}
          </button>
        </div>
      </div>

      <div className="grid gap-3">
        {SERVICES.map((service) => (
          <motion.div
            key={service.name}
            layout
            className="glass-card p-4 flex items-center justify-between"
          >
            <div className="flex-1 min-w-0 mr-4">
              <p className="text-sm font-medium text-white truncate">{service.name}</p>
              <p className="text-[10px] text-white/30">
                Predeterminado: ${DEFAULT_PRICES[service.name]}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-white/40">$</span>
              <input
                type="number"
                min={0}
                value={editing[service.name] ?? service.price}
                onChange={(e) =>
                  setEditing({ ...editing, [service.name]: parseInt(e.target.value) || 0 })
                }
                className="w-20 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-sm text-center focus:outline-none focus:border-primary"
              />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
