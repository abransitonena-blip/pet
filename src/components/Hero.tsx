'use client'

import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'

export default function Hero() {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

  useEffect(() => {
    const handleMouse = (e: MouseEvent) => {
      setMousePos({ x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight })
    }
    window.addEventListener('mousemove', handleMouse)
    return () => window.removeEventListener('mousemove', handleMouse)
  }, [])

  const stagger = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.15 },
    },
  }

  const item = {
    hidden: { opacity: 0, y: 40 },
    show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: 'easeOut' } },
  }

  return (
    <section
      id="hero"
      className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20"
    >
      <div
        className="absolute inset-0 opacity-30"
        style={{
          background: `radial-gradient(circle at ${mousePos.x * 100}% ${mousePos.y * 100}%, rgba(139, 92, 246, 0.3) 0%, transparent 60%)`,
        }}
      />

      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          animate={{ y: [0, -30, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl"
        />
        <motion.div
          animate={{ y: [0, 30, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"
        />
      </div>

      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="relative z-10 max-w-5xl mx-auto px-4 text-center"
      >
        <motion.div variants={item} className="mb-6">
          <span className="inline-block px-4 py-1.5 rounded-full text-xs font-medium bg-primary/10 border border-primary/20 text-primary/80 uppercase tracking-wider">
            Zona Quebrada, Cuautitlán
          </span>
        </motion.div>

        <motion.h1
          variants={item}
          className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold mb-6 leading-tight"
        >
          <span className="gradient-text animate-gradient">
            Cuidado Premium
          </span>
          <br />
          <span className="text-white">para tu mascota</span>
        </motion.h1>

        <motion.p
          variants={item}
          className="text-lg sm:text-xl text-white/60 max-w-2xl mx-auto mb-10"
        >
          Baño, corte, guardería y más. Precios accesibles en Zona Quebrada,
          Cuautitlán. Tu mascota merece el mejor cuidado.
        </motion.p>

        <motion.div variants={item} className="flex flex-col sm:flex-row gap-4 justify-center">
          <motion.a
            href="#reservar"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="btn-primary text-lg"
          >
            Reserva ahora
          </motion.a>
          <motion.a
            href="#servicios"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="btn-secondary text-lg"
          >
            Ver servicios
          </motion.a>
        </motion.div>

        <motion.div
          variants={item}
          className="mt-16 flex items-center justify-center gap-8 sm:gap-16"
        >
          {[
            { value: '50+', label: 'Mascotas felices' },
            { value: '4.9', label: 'Calificación' },
            { value: '2 años', label: 'Experiencia' },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-2xl sm:text-3xl font-bold gradient-text">
                {stat.value}
              </div>
              <div className="text-xs sm:text-sm text-white/40 mt-1">{stat.label}</div>
            </div>
          ))}
        </motion.div>
      </motion.div>

      <motion.div
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <div className="w-6 h-10 border-2 border-white/20 rounded-full flex justify-center">
          <motion.div
            animate={{ y: [0, 12, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="w-1.5 h-3 bg-primary rounded-full mt-2"
          />
        </div>
      </motion.div>
    </section>
  )
}
