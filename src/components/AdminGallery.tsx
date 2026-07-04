'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { FaUpload, FaTrash, FaImage, FaLink } from 'react-icons/fa'

interface GalleryImage {
  id: string
  url: string
  title: string
  dog: string
  createdAt: Timestamp
}

export default function AdminGallery() {
  const [images, setImages] = useState<GalleryImage[]>([])
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [dog, setDog] = useState('')

  useEffect(() => {
    const q = query(collection(db, 'gallery-images'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      setImages(snap.docs.map((d) => ({ id: d.id, ...d.data() } as GalleryImage)))
    })
    return unsub
  }, [])

  const handleAdd = async () => {
    if (!url.trim()) return
    await addDoc(collection(db, 'gallery-images'), {
      url: url.trim(),
      title: title.trim() || '🐾 Cliente feliz',
      dog: dog.trim() || '',
      createdAt: Timestamp.now(),
    })
    setUrl('')
    setTitle('')
    setDog('')
  }

  const handleDelete = async (id: string) => {
    await deleteDoc(doc(db, 'gallery-images', id))
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <FaImage className="text-primary" size={14} />
        <h4 className="text-sm font-semibold text-white">Galería de fotos</h4>
      </div>

      <div className="space-y-2 mb-6">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="URL de la imagen (Imgur, etc.)"
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-primary"
        />
        <div className="flex gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título (opcional)"
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-primary"
          />
          <input
            value={dog}
            onChange={(e) => setDog(e.target.value)}
            placeholder="Nombre del perro"
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-primary"
          />
        </div>
        <button
          onClick={handleAdd}
          className="flex items-center justify-center gap-1.5 w-full text-xs px-3 py-2 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 transition-all"
        >
          <FaLink size={10} />
          Agregar imagen
        </button>
      </div>

      {images.length === 0 ? (
        <div className="text-center py-10 text-white/20">
          <FaImage className="text-3xl mx-auto mb-2" />
          <p className="text-xs">Agrega URLs de imágenes para mostrarlas en la galería</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {images.map((img) => (
            <motion.div
              key={img.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative group aspect-square rounded-xl overflow-hidden bg-white/5"
            >
              <img src={img.url} alt={img.title} className="w-full h-full object-cover" />
              <button
                onClick={() => handleDelete(img.id)}
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
              >
                <FaTrash size={8} />
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
