'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { collection, query, orderBy, getDocs } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { FaDog, FaPaw, FaTimes, FaChevronLeft, FaChevronRight, FaHeart } from 'react-icons/fa'
import { useEscapeKey } from '@/lib/useEscapeKey'

interface GalleryImage {
  id: string
  url: string
  title: string
  dog: string
}

const fallbackImages = [
  { url: 'https://placedog.net/640/480?random=1', title: 'Max disfrutando su paseo', dog: 'Max' },
  { url: 'https://placedog.net/640/480?random=2', title: 'Luna en la zona verde', dog: 'Luna' },
  { url: 'https://placedog.net/640/480?random=3', title: 'Toby conociendo amigos', dog: 'Toby' },
  { url: 'https://placedog.net/640/480?random=4', title: 'Rocky explorando', dog: 'Rocky' },
  { url: 'https://placedog.net/640/480?random=5', title: 'Mimi feliz después del paseo', dog: 'Mimi' },
  { url: 'https://placedog.net/640/480?random=6', title: 'Thor corriendo libre', dog: 'Thor' },
  { url: 'https://placedog.net/640/480?random=7', title: 'Paseo grupal en Quebrada', dog: 'Coco' },
  { url: 'https://placedog.net/640/480?random=8', title: 'Nala disfrutando el sol', dog: 'Nala' },
]

export default function Gallery() {
  const [realImages, setRealImages] = useState<GalleryImage[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [loaded, setLoaded] = useState<Set<number>>(new Set())

  useEffect(() => {
    const q = query(collection(db, 'gallery-images'), orderBy('createdAt', 'desc'))
    getDocs(q).then((snap) => {
      const imgs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as GalleryImage))
      if (imgs.length > 0) setRealImages(imgs)
    }).catch(() => {})
  }, [])

  const images = realImages.length > 0 ? realImages : fallbackImages

  const close = useCallback(() => setSelected(null), [])
  const prev = useCallback(() => {
    setSelected((s) => (s !== null ? (s === 0 ? images.length - 1 : s - 1) : null))
  }, [images.length])
  const next = useCallback(() => {
    setSelected((s) => (s !== null ? (s === images.length - 1 ? 0 : s + 1) : null))
  }, [images.length])

  useEscapeKey(close, selected !== null)

  const handleKey = useCallback((e: KeyboardEvent) => {
    if (selected === null) return
    if (e.key === 'ArrowLeft') prev()
    if (e.key === 'ArrowRight') next()
  }, [selected, prev, next])

  useEffect(() => {
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [handleKey])

  const handleImgLoad = (i: number) => {
    setLoaded((prev) => new Set(prev).add(i))
  }

  return (
    <section id="galeria" className="relative py-24 sm:py-32 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-secondary/5 rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-primary/80 text-sm uppercase tracking-[0.2em] font-medium"
          >
            Galería
          </motion.span>
          <h2 className="section-title mt-3">
            Nuestros{' '}
            <span className="gradient-text">perritos</span>
          </h2>
          <p className="section-subtitle">
            La felicidad de nuestros peludos clientes habla por sí sola.
          </p>
        </motion.div>

        <div className="columns-2 sm:columns-3 lg:columns-4 gap-3 sm:gap-4 space-y-3 sm:space-y-4">
          {images.map((img, i) => (
            <motion.div
              key={img.url}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.05 }}
              whileHover={{ y: -6, scale: 1.02 }}
              onClick={() => setSelected(i)}
              className="break-inside-avoid cursor-pointer group relative rounded-2xl overflow-hidden shadow-lg"
              style={{ background: 'var(--glass-bg)' }}
            >
              <div className="relative w-full overflow-hidden" style={{ aspectRatio: i % 3 === 0 ? '3/4' : i % 3 === 1 ? '4/3' : '1/1' }}>
                {!loaded.has(i) && (
                  <div className="absolute inset-0 bg-white/5 animate-pulse" />
                )}
                <img
                  src={img.url}
                  alt={img.title}
                  className={`w-full h-full object-cover transition-all duration-700 group-hover:scale-110 ${loaded.has(i) ? 'opacity-100' : 'opacity-0'}`}
                  loading="lazy"
                  onLoad={() => handleImgLoad(i)}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-400">
                  <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                    <p className="text-white font-semibold text-sm flex items-center gap-2">
                      <FaHeart className="text-primary/80" size={10} />
                      {img.title}
                    </p>
                    <p className="text-white/50 text-xs flex items-center gap-1 mt-1">
                      <FaPaw className="text-primary" size={8} />
                      {img.dog}
                    </p>
                  </div>
                </div>
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <FaDog className="text-white" size={12} />
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {selected !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[300] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4"
            onClick={close}
          >
            <div className="absolute top-4 right-4 sm:top-6 sm:right-6 flex items-center gap-2 z-20">
              <span className="text-xs text-white/40 bg-black/40 px-3 py-1 rounded-full backdrop-blur-sm">
                {selected + 1} / {images.length}
              </span>
              <button
                onClick={close}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all backdrop-blur-sm"
              >
                <FaTimes size={16} />
              </button>
            </div>

            <button
              onClick={(e) => { e.stopPropagation(); prev() }}
              className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all backdrop-blur-sm z-20"
            >
              <FaChevronLeft size={16} />
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); next() }}
              className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all backdrop-blur-sm z-20"
            >
              <FaChevronRight size={16} />
            </button>

            <motion.div
              key={selected}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="max-w-4xl max-h-[85vh] w-full flex flex-col items-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative w-full h-full flex items-center justify-center rounded-2xl overflow-hidden">
                <img
                  src={images[selected].url}
                  alt={images[selected].title}
                  className="max-w-full max-h-[70vh] w-auto h-auto object-contain rounded-2xl shadow-2xl"
                />
              </div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center mt-5 space-y-1"
              >
                <p className="text-white font-semibold text-lg flex items-center justify-center gap-2">
                  <FaHeart className="text-primary" size={14} />
                  {images[selected].title}
                </p>
                <p className="text-white/50 text-sm flex items-center justify-center gap-1">
                  <FaPaw className="text-primary" size={10} />
                  {images[selected].dog}
                </p>
              </motion.div>
            </motion.div>

            <div className="absolute bottom-6 flex items-center gap-2 z-20">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => { e.stopPropagation(); setSelected(i) }}
                  className={`rounded-full transition-all duration-300 ${
                    i === selected
                      ? 'bg-primary w-8 h-2.5'
                      : 'bg-white/30 hover:bg-white/50 w-2 h-2'
                  }`}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
