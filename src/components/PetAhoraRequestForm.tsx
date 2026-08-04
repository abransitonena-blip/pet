'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { auth, db } from '@/firebase/config'
import { usePetAhoraDispatch } from '@/lib/usePetAhoraDispatch'
import { useConfig } from '@/context/ConfigContext'
import { Zap, Loader2, Dog, MapPin, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import type { Pet, Address } from '@/types'

interface Props {
  onRequestCreated?: (requestId: string) => void
}

export default function PetAhoraRequestForm({ onRequestCreated }: Props) {
  const { config } = useConfig()
  const { createRequest, dispatching, error } = usePetAhoraDispatch()
  const [user, setUser] = useState<{ uid: string; name: string; phone: string } | null>(null)
  const [pets, setPets] = useState<Pet[]>([])
  const [addresses, setAddresses] = useState<Address[]>([])
  const [selectedPet, setSelectedPet] = useState<string>('')
  const [selectedAddress, setSelectedAddress] = useState<string>('')
  const [requestId, setRequestId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { setLoading(false); return }
      setUser({ uid: u.uid, name: u.displayName || '', phone: u.phoneNumber || '' })
      try {
        const [petsSnap, addrSnap] = await Promise.all([
          getDocs(query(collection(db, 'pets'), where('ownerId', '==', u.uid))),
          getDocs(query(collection(db, 'addresses'), where('ownerId', '==', u.uid))),
        ])
        setPets(petsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Pet)))
        setAddresses(addrSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Address)))
        if (petsSnap.docs.length > 0) setSelectedPet(petsSnap.docs[0].id)
        if (addrSnap.docs.length > 0) setSelectedAddress(addrSnap.docs[0].id)
      } catch {} finally { setLoading(false) }
    })
    return unsub
  }, [])

  const handleRequest = async () => {
    if (!user || !selectedPet || !selectedAddress) return
    const pet = pets.find((p) => p.id === selectedPet)
    const addr = addresses.find((a) => a.id === selectedAddress)
    if (!pet || !addr) return

    const id = await createRequest({
      clientId: user.uid,
      clientName: user.name,
      clientPhone: user.phone,
      petId: selectedPet,
      petName: pet.name,
      petType: pet.petType,
      addressId: selectedAddress,
      address: addr,
      zoneId: addr.zoneId || '',
      zoneName: '',
      price: 35,
    })
    if (id) {
      setRequestId(id)
      onRequestCreated?.(id)
    }
  }

  if (!config.features.petAhoraEnabled) return null

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <span className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin" style={{ color: 'var(--text-muted)' }} />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="glass-card p-6 text-center">
        <Zap className="text-3xl mx-auto mb-3 text-secondary" />
        <h3 className="text-lg font-bold mb-2">PET Ahora</h3>
        <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>Inicia sesión para solicitar un paseo al instante</p>
        <Link href="/login" className="btn-primary inline-flex items-center gap-2 text-sm">Iniciar sesión</Link>
      </div>
    )
  }

  if (requestId) {
    return (
      <div className="glass-card p-6 text-center">
        <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: 'rgba(251,191,36,0.1)' }}>
          <Zap className="text-secondary" size={24} />
        </div>
        <h3 className="text-lg font-bold mb-2">Buscando paseador...</h3>
        <div className="flex items-center justify-center gap-2 mb-3">
          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" style={{ color: 'var(--color-primary)' }} />
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Asignando el mejor paseador disponible</span>
        </div>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>ID: {requestId.slice(0, 8)}...</p>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-6"
    >
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(251,191,36,0.1)' }}>
          <Zap className="text-secondary" size={18} />
        </div>
        <div>
          <h3 className="text-lg font-bold">PET Ahora</h3>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Paseo al instante</p>
        </div>
      </div>

      {pets.length === 0 ? (
        <div className="mb-4 p-3 rounded-lg text-sm" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
          <AlertTriangle size={12} className="inline mr-1 text-amber-500" />
          No tienes perros registrados.{' '}
          <Link href="/mi-cuenta/perros" className="text-primary underline">Registra uno</Link>
        </div>
      ) : (
        <div className="space-y-3 mb-4">
          <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>¿Quién sale a pasear?</label>
          <select value={selectedPet} onChange={(e) => setSelectedPet(e.target.value)} className="input-field">
            {pets.map((p) => <option key={p.id} value={p.id}>{p.name} {p.breed ? `(${p.breed})` : ''}</option>)}
          </select>
        </div>
      )}

      {addresses.length === 0 ? (
        <div className="mb-4 p-3 rounded-lg text-sm" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
          <AlertTriangle size={12} className="inline mr-1 text-amber-500" />
          No tienes direcciones guardadas.{' '}
          <Link href="/mi-cuenta/direcciones" className="text-primary underline">Agrega una</Link>
        </div>
      ) : (
        <div className="space-y-3 mb-4">
          <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Dirección de recogida</label>
          <select value={selectedAddress} onChange={(e) => setSelectedAddress(e.target.value)} className="input-field">
            {addresses.map((a) => <option key={a.id} value={a.id}>{a.alias || a.street}</option>)}
          </select>
        </div>
      )}

      {error && (
        <p className="text-xs mb-3" role="alert" style={{ color: 'var(--color-danger)' }}>{error}</p>
      )}

      <button
        onClick={handleRequest}
        disabled={dispatching || pets.length === 0 || addresses.length === 0}
        className="btn-primary w-full flex items-center justify-center gap-2 text-sm"
      >
        {dispatching ? <><Loader2 className="animate-spin" /> Buscando...</> : <><Zap /> Solicitar PET Ahora</>}
      </button>
    </motion.div>
  )
}
