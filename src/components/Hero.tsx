'use client'

import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { FaDog, FaMapMarkerAlt, FaPaw, FaStar } from 'react-icons/fa'

export default function Hero() {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [topReviews, setTopReviews] = useState<{ name: string; text: string; rating: number }[]>([])

  useEffect(() => {
    const q = query(collection(db, 'reviews'), orderBy('rating', 'desc'), limit(3))
    getDocs(q)
      .then((snap) => {
        const data = snap.docs.map((d) => d.data() as { name: string; text: string; rating: number })
        setTopReviews(data.filter((r) => r.text?.length > 10))
      })
      .catch(() => {})
  }, [])

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
        className="absolute inset-0 opacity-20"
        style={{
          background: `radial-gradient(circle at ${mousePos.x * 100}% ${mousePos.y * 100}%, rgba(230, 126, 34, 0.25) 0%, transparent 60%)`,
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
          className="absolute -bottom-40 -left-40 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl"
        />
      </div>

      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="relative z-10 max-w-5xl mx-auto px-4 text-center"
      >
        <motion.div variants={item} className="mb-6 flex items-center justify-center gap-2">
          <FaMapMarkerAlt className="text-primary" size={14} />
          <span className="inline-block px-4 py-1.5 rounded-full text-xs font-medium bg-primary/10 border border-primary/20 text-primary/80 uppercase tracking-wider">
            Zona Quebrada, Cuautitlán
          </span>
        </motion.div>

        <motion.h1
          variants={item}
          className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold mb-6 leading-tight"
        >
          <span className="flex items-center justify-center gap-3">
            <FaDog className="text-primary inline-block" />
            <span className="gradient-text animate-gradient">
              Paseos Caninos
            </span>
            <FaDog className="text-primary inline-block scale-x-[-1]" />
          </span>
          <br />
          <span className="text-white">en Zona Quebrada</span>
        </motion.h1>

        <motion.p
          variants={item}
          className="text-lg sm:text-xl text-white/60 max-w-2xl mx-auto mb-10"
        >
          Paseos supervisados y ejercicio para tu perro en Zona Quebrada, Cuautitlán.
          Precios accesibles, horario flexible y mucho amor canino.
        </motion.p>

        <motion.div variants={item} className="flex flex-col sm:flex-row gap-4 justify-center">
          <motion.a
            href="#reservar"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="btn-primary text-lg"
          >
            Reserva tu paseo
          </motion.a>
          <motion.a
            href="#servicios"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="btn-secondary text-lg"
          >
            Ver paquetes
          </motion.a>
        </motion.div>

        <motion.div
          variants={item}
          className="mt-16 flex items-center justify-center gap-8 sm:gap-16"
        >
          {[
            { value: '50+', label: 'Perros felices', icon: FaDog },
            { value: '4.9', label: 'Calificación', icon: FaPaw },
            { value: '2 años', label: 'Paseando', icon: FaPaw },
          ].map((stat) => {
            const Icon = stat.icon
            return (
              <div key={stat.label} className="text-center">
                <div className="text-2xl sm:text-3xl font-bold gradient-text flex items-center justify-center gap-2">
                  {stat.value}
                </div>
                <div className="text-xs sm:text-sm text-white/40 mt-1">{stat.label}</div>
              </div>
            )
          })}
        </motion.div>

        {topReviews.length > 0 && (
          <motion.div
            variants={item}
            className="mt-12 grid sm:grid-cols-3 gap-4 max-w-3xl mx-auto"
          >
            {topReviews.map((rev, i) => (
              <div key={i} className="glass-card p-4 text-center">
                <div className="flex items-center justify-center gap-0.5 mb-2">
                  {Array.from({ length: rev.rating }).map((_, j) => (
                    <FaStar key={j} className="text-secondary" size={10} />
                  ))}
                </div>
                <p className="text-xs text-white/50 line-clamp-3 mb-2">&ldquo;{rev.text}&rdquo;</p>
                <p className="text-xs text-white/60 font-medium">- {rev.name}</p>
              </div>
            ))}
          </motion.div>
        )}
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
