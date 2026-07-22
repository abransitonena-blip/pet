'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore'
import { db } from '@/firebase/config'
import Image from 'next/image'
import { FaUpload, FaTrash, FaImage, FaLink, FaSpinner } from 'react-icons/fa'
import { useToast } from '@/context/ToastContext'

interface GalleryImage {
  id: string
  url: string
  title: string
  dog: string
  createdAt: Timestamp
}

export default function AdminGallery() {
  const [images, setImages] = useState<GalleryImage[]>([])
  const [title, setTitle] = useState('')
  const [dog, setDog] = useState('')
  const [uploading, setUploading] = useState(false)
  const [showUrlInput, setShowUrlInput] = useState(false)
  const [url, setUrl] = useState('')
  const { toast } = useToast()

  useEffect(() => {
    const q = query(collection(db, 'gallery-images'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      setImages(snap.docs.map((d) => ({ id: d.id, ...d.data() } as GalleryImage)))
    })
    return unsub
  }, [])

  const compressImage = (dataUrl: string, maxW = 800, maxH = 800, quality = 0.7): Promise<string> => {
    return new Promise((resolve) => {
      const img = document.createElement('img')
      img.onload = () => {
        let w = img.width, h = img.height
        if (w > maxW || h > maxH) {
          const ratio = Math.min(maxW / w, maxH / h)
          w *= ratio; h *= ratio
        }
        const canvas = document.createElement('canvas')
        canvas.width = w; canvas.height = h
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.src = dataUrl
    })
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const reader = new FileReader()
      reader.onload = async () => {
        try {
          const compressed = await compressImage(reader.result as string)
          await addDoc(collection(db, 'gallery-images'), {
            url: compressed,
            title: title.trim() || '🐾 Cliente feliz',
            dog: dog.trim() || '',
            createdAt: Timestamp.now(),
          })
          setTitle('')
          setDog('')
          toast('Foto subida')
        } catch { toast('Error al subir foto', 'error') }
        setUploading(false)
      }
      reader.readAsDataURL(file)
    } catch { setUploading(false); toast('Error al procesar imagen', 'error') }
  }

  const handleUrl = async () => {
    if (!url.trim()) return
    try {
      await addDoc(collection(db, 'gallery-images'), {
        url: url.trim(),
        title: title.trim() || '🐾 Cliente feliz',
        dog: dog.trim() || '',
        createdAt: Timestamp.now(),
      })
      setUrl('')
      setTitle('')
      setDog('')
      setShowUrlInput(false)
      toast('Imagen agregada')
    } catch { toast('Error al agregar imagen', 'error') }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'gallery-images', id))
      toast('Imagen eliminada')
    } catch { toast('Error al eliminar imagen', 'error') }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FaImage className="text-primary" size={14} />
          <h4 className="text-sm font-semibold text-white">Galería de fotos</h4>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowUrlInput(!showUrlInput)}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-white/5 text-white/50 hover:text-white hover:bg-white/10 transition-all"
          >
            <FaLink size={9} />
            URL
          </button>
          <label className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-primary/20 text-primary hover:bg-primary/30 transition-all cursor-pointer">
            {uploading ? <FaSpinner className="animate-spin" size={10} /> : <FaUpload size={10} />}
            Subir foto
            <input type="file" accept="image/*" onChange={handleFile} className="hidden" disabled={uploading} />
          </label>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
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

      {showUrlInput && (
        <div className="flex gap-2 mb-4">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="URL de imagen"
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-primary"
          />
          <button
            onClick={handleUrl}
            className="text-xs px-3 py-2 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 transition-all"
          >
            Agregar
          </button>
        </div>
      )}

      {uploading && (
        <div className="text-center py-4 text-white/40">
          <FaSpinner className="animate-spin mx-auto mb-2" size={20} />
          <p className="text-xs">Procesando imagen...</p>
        </div>
      )}

      {images.length === 0 && !uploading ? (
        <div className="text-center py-10 text-white/20">
          <FaImage className="text-3xl mx-auto mb-2" />
          <p className="text-xs">Selecciona una foto para subirla a la galería</p>
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
              <Image src={img.url} alt={img.title} width={300} height={300} unoptimized className="w-full h-full object-cover" />
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
