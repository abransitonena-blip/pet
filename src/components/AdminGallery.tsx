'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ref, uploadBytesResumable, getDownloadURL, listAll, deleteObject } from 'firebase/storage'
import { storage } from '@/firebase/config'
import { FaUpload, FaTrash, FaSpinner, FaImage } from 'react-icons/fa'

export default function AdminGallery() {
  const [images, setImages] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    loadImages()
  }, [])

  const loadImages = async () => {
    try {
      const listRef = ref(storage, 'gallery')
      const result = await listAll(listRef)
      const urls = await Promise.all(result.items.map((item) => getDownloadURL(item)))
      setImages(urls.reverse())
    } catch {}
  }

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setProgress(0)
    const storageRef = ref(storage, `gallery/${Date.now()}_${file.name}`)
    const task = uploadBytesResumable(storageRef, file)
    task.on(
      'state_changed',
      (snap) => setProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      () => setUploading(false),
      async () => {
        await loadImages()
        setUploading(false)
      }
    )
  }

  const handleDelete = async (url: string) => {
    try {
      const decodeUrl = decodeURIComponent(url)
      const start = decodeUrl.indexOf('/gallery%2F')
      if (start === -1) {
        const altStart = decodeUrl.indexOf('/gallery/')
        if (altStart === -1) return
        const path = decodeUrl.substring(altStart + 1).split('?')[0]
        const fileRef = ref(storage, path)
        await deleteObject(fileRef)
      } else {
        const path = decodeUrl.substring(start + 10).split('?')[0]
        const fileRef = ref(storage, path)
        await deleteObject(fileRef)
      }
      await loadImages()
    } catch {}
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FaImage className="text-primary" size={14} />
          <h4 className="text-sm font-semibold text-white">Galería de fotos</h4>
        </div>
        <label className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-primary/20 text-primary hover:bg-primary/30 transition-all cursor-pointer">
          <FaUpload size={10} />
          Subir foto
          <input type="file" accept="image/*" onChange={handleUpload} className="hidden" disabled={uploading} />
        </label>
      </div>

      {uploading && (
        <div className="mb-4">
          <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className="h-full bg-gradient-to-r from-primary to-amber-500 rounded-full"
            />
          </div>
          <p className="text-xs text-white/30 mt-1 text-center">{progress}%</p>
        </div>
      )}

      {images.length === 0 && !uploading ? (
        <div className="text-center py-10 text-white/20">
          <FaImage className="text-3xl mx-auto mb-2" />
          <p className="text-xs">Sube fotos de los perros para mostrarlas en la galería</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {images.map((url) => (
            <motion.div
              key={url}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative group aspect-square rounded-xl overflow-hidden bg-white/5"
            >
              <img src={url} alt="" className="w-full h-full object-cover" />
              <button
                onClick={() => handleDelete(url)}
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
