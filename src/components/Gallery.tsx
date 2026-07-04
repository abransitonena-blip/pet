'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { listAll, getDownloadURL, ref } from 'firebase/storage'
import { storage } from '@/firebase/config'
import { FaDog, FaPaw, FaTimes, FaChevronLeft, FaChevronRight, FaImage } from 'react-icons/fa'

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
  const [realImages, setRealImages] = useState<{ url: string; title: string; dog: string }[]>([])
  const [selected, setSelected] = useState<number | null>(null)

  useEffect(() => {
    const listRef = ref(storage, 'gallery')
    listAll(listRef)
      .then((result) =>
        Promise.all(result.items.map((item) => getDownloadURL(item)))
      )
      .then((urls) => {
        if (urls.length > 0) {
          setRealImages(urls.map((url) => ({ url, title: '🐾 Cliente feliz', dog: '' })))
        }
      })
      .catch(() => {})
  }, [])

  const images = realImages.length > 0 ? realImages : fallbackImages

  const open = (i: number) => setSelected(i)
  const close = () => setSelected(null)
  const prev = () => selected !== null && setSelected(selected === 0 ? images.length - 1 : selected - 1)
  const next = () => selected !== null && setSelected(selected === images.length - 1 ? 0 : selected + 1)

  return (
    <section id="galeria" className="relative py-24 sm:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span
            className="text-sm uppercase tracking-widest font-medium"
            style={{ color: "rgba(230, 126, 34, 0.8)" }}
          >
            Galería
          </span>
          <h2 className="section-title mt-3">
            Nuestros{' '}
            <span className="gradient-text">perritos</span>
          </h2>
          <p className="section-subtitle">
            Mira lo felices que son nuestros clientes durante sus paseos por Zona Quebrada.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {images.map((img, i) => (
            <motion.div
              key={img.url}
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              whileHover={{ y: -4 }}
              onClick={() => open(i)}
              className="glass-card overflow-hidden cursor-pointer group aspect-[4/3]"
            >
              <div className="relative w-full h-full overflow-hidden rounded-[inherit]">
                <img
                  src={img.url}
                  alt={img.title}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                  <div>
                    <p className="text-white font-semibold text-sm">{img.title}</p>
                    <p className="text-white/60 text-xs flex items-center gap-1">
                      <FaPaw className="text-primary" size={10} />
                      {img.dog}
                    </p>
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
            className="fixed inset-0 z-[300] bg-black/95 backdrop-blur-md flex items-center justify-center p-4"
            onClick={close}
          >
            <button
              onClick={close}
              className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all z-10"
            >
              <FaTimes />
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); prev() }}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all z-10"
            >
              <FaChevronLeft />
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); next() }}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all z-10"
            >
              <FaChevronRight />
            </button>

            <motion.div
              key={selected}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="max-w-4xl max-h-[80vh] w-full"
              onClick={(e) => e.stopPropagation()}
            >
                <img
                  src={images[selected].url}
                  alt={images[selected].title}
                  className="w-full h-full object-contain rounded-2xl"
                />
                <div className="text-center mt-4">
                  <p className="text-white font-semibold">
                    {images[selected].title}
                  </p>
                  <p className="text-white/50 text-sm">
                    {images[selected].dog}
                  </p>
                </div>
            </motion.div>

            <div className="absolute bottom-6 flex items-center gap-2">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => { e.stopPropagation(); setSelected(i) }}
                  className={`w-2 h-2 rounded-full transition-all ${
                    i === selected ? 'bg-primary w-6' : 'bg-white/30 hover:bg-white/50'
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
