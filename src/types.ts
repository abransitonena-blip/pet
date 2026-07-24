export interface WalkMedia {
  photo: string
  lat: number
  lng: number
  timestamp: { seconds: number; nanoseconds: number }
}

export interface Reservation {
  id: string
  name: string
  phone: string
  petName: string
  petType: string
  service: string
  date: string
  time: string
  status: string
  notes: string
  internalNotes: string
  assignedWalker: string
  history?: { status: string; timestamp: string }[]
  createdAt?: { seconds: number; nanoseconds: number }
  completedAt?: { seconds: number; nanoseconds: number } | string
  paymentStatus?: 'pending' | 'paid'
  walkCheckIn?: WalkMedia
  walkCheckOut?: WalkMedia
  walkNotes?: string
  uid?: string
}
