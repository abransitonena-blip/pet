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
  status: 'pending' | 'confirmed' | 'assigned' | 'en_camino' | 'paseando' | 'completed' | 'cancelled'
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
  client?: { uid: string; name: string; phone: string }
  assignment?: { walkerId: string; walkerName: string; assignedAt: any; assignedBy: string }
  walk?: {
    status: string
    checkIn?: WalkMedia
    checkOut?: WalkMedia
    notes?: string
    distance?: number
    duration?: number
    weather?: string
    photos?: string[]
  }
  payment?: {
    finalPrice: number
    coupon?: string
    discount: number
    referralDiscount: number
    paid: boolean
  }
  referralCode?: string
  finalPrice?: number
  appliedCoupon?: string
  discountApplied?: number
}

export interface Conversation {
  id: string
  clientId: string
  clientName: string
  clientPhone?: string
  lastMessage?: string
  lastTimestamp?: { seconds: number; nanoseconds: number }
  unreadAdmin: number
  unreadClient: number
  createdAt?: { seconds: number; nanoseconds: number }
}

export interface ChatMessage {
  id?: string
  text: string
  senderId: string
  senderRole: 'admin' | 'client' | 'walker'
  timestamp?: { seconds: number; nanoseconds: number }
}

export interface Walker {
  id: string
  name: string
  phone: string
  email: string
  photo?: string
  status: 'active' | 'inactive' | 'vacation' | 'suspended'
  zones: string[]
  capacity: { maxDaily: number; maxWeekly: number }
  schedule: Record<string, { start: string; end: string }[]>
  performance: {
    rating: number
    totalWalks: number
    completedWalks: number
    avgDuration: number
    avgDistance: number
    incidents: number
  }
  currentLoad: {
    todayAssigned: number
    todayCompleted: number
    weekAssigned: number
  }
}

export interface Zone {
  id: string
  name: string
  center: { lat: number; lng: number }
  active: boolean
  walkerIds: string[]
  stats: {
    totalClients: number
    totalWalks: number
    avgDemand: number
  }
}

export interface Pet {
  id: string
  ownerId: string
  name: string
  petType: 'perro' | 'gato' | 'otro'
  breed: string
  size: 'pequeño' | 'mediano' | 'grande'
  sex?: 'macho' | 'hembra'
  age: string
  weight: string
  notes: string
  personality?: {
    energyLevel: 'bajo' | 'medio' | 'alto'
    temperament: string[]
  }
  health?: {
    allergies: string[]
    medications: string[]
    vaccines: { name: string; date: string; nextDue?: string }[]
    vetName: string
    vetPhone: string
  }
  preferences?: {
    favoriteToys: string[]
    commands: string[]
    specialNeeds: string
  }
  photos?: string[]
}

export interface Client {
  uid: string
  name: string
  phone: string
  email: string
  avatar?: string
  address?: string
  emergencyContact?: { name: string; phone: string }
  loyalty: {
    points: number
    totalWalks: number
    freeWalksEarned: number
    freeWalksUsed: number
  }
  referral: {
    code: string
    totalReferred: number
    totalRewards: number
  }
  metrics: {
    ltv: number
    avgFrequency: number
    lastWalkDate?: any
    totalSpent: number
    joinDate: any
  }
}

export interface Loyalty {
  points: number
  totalWalks: number
  freeWalksEarned: number
  freeWalksUsed: number
  lastWalkAt?: any
}
