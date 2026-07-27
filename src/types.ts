import type { SessionStatus, AssignmentStatus } from './lib/sessionMachine'

export type { SessionStatus, AssignmentStatus }

export interface WalkMedia {
  photo: string
  lat: number
  lng: number
  timestamp: { seconds: number; nanoseconds: number }
}

export interface Address {
  id: string
  ownerId: string
  alias: string
  street: string
  exterior: string
  interior: string
  colony: string
  city: string
  state: string
  zip: string
  references: string
  instructions: string
  lat: number
  lng: number
  zoneId: string
  contactName: string
  contactPhone: string
  pickupInstructions: string
  deliveryInstructions: string
  isDefault: boolean
  createdAt?: { seconds: number; nanoseconds: number }
}

export interface ServiceOrder {
  id: string
  clientId: string
  clientName: string
  clientPhone: string
  dogIds: string[]
  dogName: string
  petType: string
  serviceId: string
  serviceName: string
  packageType: 'individual' | 'extended' | 'group' | 'weekly' | 'custom'
  numberOfSessions: number
  addressId: string
  address?: Address
  zoneId: string
  zoneName: string
  subtotal: number
  zoneAdjustment: number
  discount: number
  referralDiscount: number
  total: number
  paymentStatus: 'pending' | 'paid'
  status: 'active' | 'completed' | 'cancelled' | 'paused'
  notes: string
  referralCode?: string
  appliedCoupon?: string
  createdAt?: { seconds: number; nanoseconds: number }
}

export interface WalkSession {
  id: string
  orderId: string
  clientId: string
  clientName: string
  clientPhone: string
  dogName: string
  petType: string
  serviceName: string
  date: string
  startTime: string
  arrivalWindowStart?: string
  arrivalWindowEnd?: string
  expectedEndTime: string
  zoneId: string
  zoneName: string
  addressId: string
  address?: Address
  walkerId: string
  walkerName: string
  assignmentStatus: AssignmentStatus
  sessionStatus: SessionStatus
  notes: string
  internalNotes: string
  walkCheckIn?: WalkMedia
  walkCheckOut?: WalkMedia
  walkNotes?: string
  photos?: string[]
  history?: { status: string; timestamp: string }[]
  duration?: number
  distance?: number
  createdAt?: { seconds: number; nanoseconds: number }
  completedAt?: { seconds: number; nanoseconds: number } | string
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
  arrivalWindowStart?: string
  arrivalWindowEnd?: string
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
  addressId?: string
  address?: Address
  zoneId?: string
  zoneName?: string
  orderId?: string
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
  radius: number
  active: boolean
  walkerIds: string[]
  basePrice: number
  fixedAdjustment: number
  percentAdjustment: number
  transitIncluded: boolean
  coverageRadius: number
  minOrder: number
  availableHours: Record<string, { start: string; end: string }[]>
  stats: {
    totalClients: number
    totalWalks: number
    avgDemand: number
  }
  createdAt?: { seconds: number; nanoseconds: number }
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
