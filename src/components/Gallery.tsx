'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import { Dog, PawPrint, X, ChevronLeft, ChevronRight, Heart } from 'lucide-react'
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { useEscapeKey } from '@/lib/useEscapeKey'

interface GalleryImage {
  id: string
  url: string
  assetPublicId: string
  altText: string
  width: number
  height: number
}

type GalleryReadState = 'loading' | 'ready' | 'permission-denied' | 'network-error'

function isGalleryImage(id: string, value: unknown): value is Omit<GalleryImage, 'id'> {
  if (!value || typeof value !== 'object') return false
  const data = value as Record<string, unknown>
  return typeof id === 'string'
    && typeof data.assetPublicId === 'string'
    && /^pet-ap-public\/[a-f0-9-]{36}$/.test(data.assetPublicId)
    && typeof data.url === 'string'
    && /^https:\/\/res\.cloudinary\.com\/[A-Za-z0-9_-]+\/image\/upload\/[^?#]+$/.test(data.url)
    && Number.isSafeInteger(data.width) && Number(data.width) > 0
    && Number.isSafeInteger(data.height) && Number(data.height) > 0
    && typeof data.altText === 'string' && data.altText.length > 0 && data.altText.length <= 240
}

export default function Gallery() {
  const [realImages, setRealImages] = useState<GalleryImage[]>([])
  const [readState, setReadState] = useState<GalleryReadState>('loading')
  const [selected, setSelected] = useState<number | null>(null)
  const [loaded, setLoaded] = useState<Set<number>>(new Set())

  useEffect(() => {
    let active = true
    getDocs(query(collection(db, 'gallery-public'), orderBy('updatedAt', 'desc'), limit(50))).then((snapshot) => {
      if (!active) return
      const images = snapshot.docs.flatMap((item) => isGalleryImage(item.id, item.data())
        ? [{ id: item.id, ...item.data() } as GalleryImage]
        : [])
      setRealImages(images)
      setReadState('ready')
    }).catch((error: unknown) => {
      if (!active) return
      const code = error && typeof error === 'object' && 'code' in error ? String((error as { code?: unknown }).code) : ''
      setRealImages([])
      setReadState(code.includes('permission-denied') ? 'permission-denied' : 'network-error')
    })
    return () => { active = false }
  }, [])

  const images = realImages

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
    <section aria-label="Galería" id="galeria" className="relative py-24 sm:py-32 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-trust/5 rounded-full blur-3xl" />
      </div>

      <div className="section-container relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.32 }}
          className="text-center mb-16"
        >
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-primary-hover text-sm uppercase tracking-[0.2em] font-medium"
          >
            Galería
          </motion.span>
          <h2 className="section-title mt-3">
            Nuestros{' '}
            <span className="gradient-text">perritos</span>
          </h2>
          <p className="section-subtitle">Imágenes publicadas únicamente con autorización previa.</p>
        </motion.div>

        {readState === 'loading' ? (
          <div className="mx-auto max-w-xl rounded-3xl border p-10 text-center" style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
            <PawPrint className="mx-auto mb-3 text-primary animate-pulse" size={28} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Consultando galería autorizada…</p>
          </div>
        ) : readState !== 'ready' ? (
          <div className="mx-auto max-w-xl rounded-3xl border p-10 text-center" style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
            <Dog className="mx-auto mb-3 text-primary" size={32} />
            <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Galería temporalmente no disponible</h3>
            <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
              {readState === 'permission-denied'
                ? 'No fue posible consultar las imágenes autorizadas.'
                : 'No pudimos conectar con la galería. Intenta nuevamente más tarde.'}
            </p>
          </div>
        ) : images.length === 0 ? (
          <div className="mx-auto max-w-xl rounded-3xl border p-10 text-center" style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
            <Dog className="mx-auto mb-3 text-primary" size={32} />
            <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Próximamente nuevas historias</h3>
            <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
              Estamos preparando una galería con imágenes propias y autorizadas para publicación.
            </p>
          </div>
        ) : <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-3 sm:gap-4 space-y-3 sm:space-y-4">
          {images.map((img, i) => (
            <motion.div
              key={img.assetPublicId}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.2, delay: Math.min(i * 0.02, 0.16) }}
              whileHover={{ y: -6, scale: 1.02 }}
              onClick={() => setSelected(i)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(i) } }}
              className="break-inside-avoid cursor-pointer group relative rounded-2xl overflow-hidden shadow-lg"
              style={{ background: 'var(--glass-bg)' }}
            >
              <div className="relative w-full overflow-hidden" style={{ aspectRatio: `${img.width} / ${img.height}` }}>
                {!loaded.has(i) && (
                  <div className="absolute inset-0 skeleton" />
                )}
                <Image
                  src={img.url}
                  alt={img.altText}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  className={`object-cover transition-all duration-200 motion-reduce:transition-none motion-reduce:transform-none group-hover:scale-[1.03] ${loaded.has(i) ? 'opacity-100' : 'opacity-0'}`}
                  onLoad={() => handleImgLoad(i)}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-400">
                  <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                    <p className="text-white font-semibold text-sm flex items-center gap-2">
                      <Heart className="text-primary/80" size={10} />
                      {img.altText}
                    </p>
                  </div>
                </div>
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <Dog className="text-white" size={12} />
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>}
      </div>

      <AnimatePresence>
        {selected !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="fixed inset-0 z-[var(--z-overlay)] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4"
            onClick={close}
          >
            <div role="presentation" className="absolute top-4 right-4 sm:top-6 sm:right-6 flex items-center gap-2 z-20">
              <span className="text-xs text-white/40 bg-black/40 px-3 py-1 rounded-full backdrop-blur-sm">
                {selected + 1} / {images.length}
              </span>
              <button
                onClick={close}
                    className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all duration-200 motion-reduce:transition-none backdrop-blur-sm"
                aria-label="Cerrar galería"
              >
                <X size={16} />
              </button>
            </div>

            <button
              onClick={(e) => { e.stopPropagation(); prev() }}
                  className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all duration-200 motion-reduce:transition-none backdrop-blur-sm z-20"
              aria-label="Imagen anterior"
            >
              <ChevronLeft size={16} />
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); next() }}
                  className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all duration-200 motion-reduce:transition-none backdrop-blur-sm z-20"
              aria-label="Imagen siguiente"
            >
              <ChevronRight size={16} />
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
                <Image
                  src={images[selected].url}
                  alt={images[selected].altText}
                  width={images[selected].width}
                  height={images[selected].height}
                  className="max-w-full max-h-[70vh] w-auto h-auto object-contain rounded-2xl shadow-2xl"
                />
              </div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center mt-5 space-y-1"
              >
                <p className="text-white font-semibold text-lg flex items-center justify-center gap-2">
                  <Heart className="text-primary" size={14} />
                  {images[selected].altText}
                </p>
              </motion.div>
            </motion.div>

            <div className="absolute bottom-6 flex items-center gap-2 z-20">
              {images.map((_, i) => (
                    <button
                      key={i}
                      onClick={(e) => { e.stopPropagation(); setSelected(i) }}
                      aria-label={`Ver imagen ${i + 1}`}
                      className={`flex h-11 min-w-11 items-center justify-center rounded-full transition-all duration-200 motion-reduce:transition-none ${
                        i === selected
                          ? 'bg-primary'
                          : 'bg-white/20 hover:bg-white/30'
                      }`}
                    ><span aria-hidden="true" className={`block rounded-full ${i === selected ? 'h-2.5 w-8 bg-white' : 'h-2 w-2 bg-white/70'}`} /></button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
