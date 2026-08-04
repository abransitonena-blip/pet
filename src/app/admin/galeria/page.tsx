'use client'

import { useState, useEffect } from 'react'
import { collection, query, orderBy, getDocs, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase/config'
import Image from 'next/image'
import { Image as ImageIcon, Loader2, Trash2, Upload, Dog, Tag } from 'lucide-react'

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'ktyauicg'
const UPLOAD_PRESET = 'pet_gallery'

interface GalleryImage {
  id: string
  url: string
  title: string
  dog: string
  createdAt: { seconds: number } | null
}

export default function AdminGalleryPage() {
  const [images, setImages] = useState<GalleryImage[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [dog, setDog] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    const q = query(collection(db, 'gallery-images'), orderBy('createdAt', 'desc'))
    getDocs(q).then((snap) => {
      setImages(snap.docs.map((d) => ({ id: d.id, ...d.data() } as GalleryImage)))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      alert('La imagen no debe superar 5MB')
      return
    }
    if (!file.type.startsWith('image/')) {
      alert('Solo se permiten imágenes')
      return
    }
    setSelectedFile(file)
    setPreview(URL.createObjectURL(file))
    setTitle('')
    setDog('')
  }

  const uploadToCloudinary = async (file: File): Promise<string> => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('upload_preset', UPLOAD_PRESET)
    formData.append('folder', 'gallery')

    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
      method: 'POST',
      body: formData,
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error?.message || `Error ${res.status} al subir a Cloudinary`)
    }

    const data = await res.json()
    return data.secure_url as string
  }

  const handleUpload = async () => {
    if (!selectedFile || !title.trim() || !dog.trim()) return
    setUploading(true)
    try {
      const url = await uploadToCloudinary(selectedFile)

      await addDoc(collection(db, 'gallery-images'), {
        url,
        title: title.trim(),
        dog: dog.trim(),
        createdAt: serverTimestamp(),
      })

      setSelectedFile(null)
      setPreview(null)
      setTitle('')
      setDog('')
      setImages([])
      setLoading(true)
      const q = query(collection(db, 'gallery-images'), orderBy('createdAt', 'desc'))
      const snap = await getDocs(q)
      setImages(snap.docs.map((d) => ({ id: d.id, ...d.data() } as GalleryImage)))
      setLoading(false)
    } catch (e) {
      console.error('Upload error:', e)
      alert(e instanceof Error ? e.message : 'Error al subir la imagen')
    }
    setUploading(false)
  }

  const handleDelete = async (img: GalleryImage) => {
    if (!confirm(`¿Eliminar "${img.title}" de la galería?`)) return
    setDeleting(img.id)
    try {
      await deleteDoc(doc(db, 'gallery-images', img.id))
      setImages((prev) => prev.filter((i) => i.id !== img.id))
    } catch (e) {
      console.error('Delete error:', e)
      alert('Error al eliminar')
    }
    setDeleting(null)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Galería</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Administra las imágenes de la galería pública
        </p>
      </div>

      <div className="rounded-xl p-5 space-y-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2">
          <ImageIcon size={14} className="text-primary" />
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Subir nueva imagen</span>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Seleccionar imagen
            </label>
            <label className="flex flex-col items-center justify-center h-40 rounded-xl border-2 border-dashed cursor-pointer transition-all hover:bg-white/[0.02]"
              style={{ borderColor: 'var(--border)', background: 'var(--glass-bg)' }}>
              {preview ? (
                <Image src={preview} alt="Preview" width={200} height={160} className="h-full w-full object-contain rounded-xl" />
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload size={20} style={{ color: 'var(--text-muted)' }} />
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Click para seleccionar</span>
                  <span className="text-2xs" style={{ color: 'var(--text-muted)' }}>Máx 5MB</span>
                </div>
              )}
              <input type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
            </label>
          </div>

          <div className="space-y-3">
            <div>
              <label htmlFor="img-title" className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                <Tag size={10} className="inline mr-1" /> Título
              </label>
              <input
                id="img-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Max disfrutando su paseo"
                className="input-field"
              />
            </div>
            <div>
              <label htmlFor="img-dog" className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                <Dog size={10} className="inline mr-1" /> Nombre del perro
              </label>
              <input
                id="img-dog"
                type="text"
                value={dog}
                onChange={(e) => setDog(e.target.value)}
                placeholder="Ej: Max"
                className="input-field"
              />
            </div>
            <button
              onClick={handleUpload}
              disabled={!selectedFile || !title.trim() || !dog.trim() || uploading}
              className="btn-primary w-full flex items-center justify-center gap-2 text-sm"
            >
              {uploading ? <><Loader2 className="animate-spin" size={14} /> Subiendo...</> : <><Upload size={14} /> Subir imagen</>}
            </button>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
          Imágenes actuales ({images.length})
        </h3>
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton h-40 rounded-xl" />
            ))}
          </div>
        ) : images.length === 0 ? (
          <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
            <ImageIcon className="text-3xl mx-auto mb-2" />
            <p className="text-xs">No hay imágenes. Sube la primera.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {images.map((img) => (
              <div key={img.id} className="relative group rounded-xl overflow-hidden"
                style={{ background: 'var(--glass-bg)', border: '1px solid var(--border)' }}>
                <div className="relative h-40">
                  <Image src={img.url} alt={img.title} fill className="object-cover" sizes="(max-width: 640px) 50vw, 25vw" />
                </div>
                <div className="p-2.5">
                  <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{img.title}</p>
                  <p className="text-2xs" style={{ color: 'var(--text-muted)' }}>{img.dog}</p>
                </div>
                <button
                  onClick={() => handleDelete(img)}
                  disabled={deleting === img.id}
                  className="absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all bg-black/60 hover:bg-red-500/80 text-white"
                  aria-label={`Eliminar ${img.title}`}
                >
                  {deleting === img.id ? <Loader2 className="animate-spin" size={12} /> : <Trash2 size={11} />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
