'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { FaBell, FaCheckCircle } from 'react-icons/fa'
import { brand } from '@/lib/brand'

export default function WalkReminder() {
  const [phone, setPhone] = useState('')
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    if (phone.replace(/\D/g, '').length < 10) return
    const reminderUrl = `https://wa.me/${brand.whatsapp}?text=${encodeURIComponent(
      '🐾 Hola, quiero activar el recordatorio para mi paseo. Mi número es: ' + phone
    )}`
    window.open(reminderUrl, '_blank')
    setSaved(true)
    setTimeout(() => setSaved(false), 5000)
  }

  return (
    <div className="glass-card p-5 sm:p-6">
      <div className="flex items-center gap-2 mb-3">
        <FaBell className="text-primary" size={16} />
        <h3 className="text-sm font-semibold text-white">Recordatorio por WhatsApp</h3>
      </div>
      <p className="text-xs text-white/50 mb-3 leading-relaxed">
        Te enviamos un mensaje por WhatsApp antes de tu paseo para que no se te olvide 🐾
      </p>
      <div className="flex items-center gap-2">
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Tu WhatsApp"
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary placeholder:text-white/20"
        />
        <button
          onClick={handleSave}
          disabled={phone.replace(/\D/g, '').length < 10 || saved}
          className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-gradient-to-r from-primary to-amber-600 text-white hover:opacity-90 transition-all disabled:opacity-50"
        >
          {saved ? <FaCheckCircle /> : <FaBell size={11} />}
          {saved ? 'Listo' : 'Activar'}
        </button>
      </div>
      {saved && (
        <motion.p
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-green-400 text-xs mt-2 text-center"
        >
          ¡Te enviaremos un recordatorio antes del paseo!
        </motion.p>
      )}
    </div>
  )
}
