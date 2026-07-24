# PET Ap Enterprise v5.0 — Auditoría + Arquitectura

> Fecha: 24 de Julio, 2026
> Repo: `github.com/abransitonena-blip/pet`
> Deploy: Vercel (`pet-euhz.vercel.app`)
> Stack: Next.js 14 · React 18 · Firebase · Tailwind · Framer Motion

---

## 1. ESTADO ACTUAL DEL PROYECTO

### Métricas

| Métrica | Valor |
|---------|-------|
| Archivos totales | 129 |
| Líneas de código | ~15,421 |
| Componentes React | 43 (9 UI primitivos) |
| Rutas/Páginas | ~28 |
| Context Providers | 5 |
| Utilidades lib/ | 6 |
| Colecciones Firestore | 18 |
| Cloud Functions | 2 |

### Stack Tecnológico

```
Frontend:  Next.js 14 (App Router) · React 18 · TypeScript · Tailwind CSS
Animación: Framer Motion 11.1
Backend:   Firebase (Firestore · Auth · Storage · Cloud Functions · FCM)
Deploy:    Vercel (frontend) + Firebase (backend)
PWA:       Custom service workers + manifest
Analytics: Google Analytics (G-HQTMCZX66M)
```

### Dependencias

| Paquete | Versión | Peso aprox |
|---------|---------|------------|
| firebase | ^10.12.0 | ~200KB gz |
| framer-motion | ^11.1.0 | ~60KB gz |
| react-icons | ^5.2.0 | Tree-shakeable |
| next | ^14.2.0 | Framework core |
| react/react-dom | ^18.3.0 | Framework core |

---

## 2. ARQUITECTURA ACTUAL

### Árbol de Providers

```
ThemeProvider
  └─ ConfigProvider
       └─ PricesProvider
            └─ ToastProvider
                 └─ {children}
```

### Autenticación

```
Firebase Auth (Email + Google)
  → Session cookie (__session) — solo presencia, no validación
  → Middleware protege /admin, /mi-cuenta, /paseador
  → Roles en Firestore users/{uid}: { role: 'admin' | 'walker' | 'client' }
  → Clientes en clients/{uid}
```

### Colecciones Firestore

| Colección | Propósito | Reglas |
|-----------|-----------|--------|
| `reservations` | Reservas de paseos | Pública lectura, auth creación |
| `reviews` | Reseñas públicas | Pública lectura, auth creación |
| `gallery-images` | Galería de fotos | Pública lectura, admin escritura |
| `coupons` | Cupones de descuento | Pública lectura, admin escritura |
| `admin/prices` | Precios de servicios | Pública lectura, admin escritura |
| `admin/config` | Configuración del sitio | Pública lectura, admin escritura |
| `admin/banner` | Banner promocional | Pública lectura, admin escritura |
| `admin/tokens` | Tokens FCM | Admin lectura, auth escritura |
| `audit-logs` | Logs de auditoría | Auth creación, admin lectura |
| `users` | Documentos de rol | Solo owner lee, sin escritura |
| `clients` | Perfiles de cliente | Owner CRUD |
| `pets` | Perfiles de mascotas | Owner + admin CRUD |
| `walk-logs` | Seguimiento de paseos | Walker/owner/admin |
| `conversations` + `messages` | Chat | Owner + admin |
| `referrals` | Referidos | Auth CRUD |
| `loyalty` | Puntos de lealtad | Owner lectura, admin escritura |
| `notifications/{uid}/items` | Notificaciones in-app | Owner lectura, admin escritura |
| `walkers` | Info de paseadores | Auth lectura, admin escritura |

---

## 3. PROBLEMAS ENCONTRADOS

### CRÍTICOS (Seguridad / Datos)

| # | Ubicación | Problema |
|---|-----------|----------|
| C1 | `AdminGallery.tsx` | **Imágenes base64 en Firestore** — documentos de 100KB+ en `gallery-images`. Firestore tiene límite de 1MB por documento. Costos de lectura exorbitantes. Debe usar Firebase Storage. |
| C2 | `ClientPanel.tsx` | **Sin autenticación** — cualquier persona con un teléfono puede ver y cancelar reservas ajenas. No hay verificación de identidad. |
| C3 | `firestore.rules` | **`reservations` lectura pública** — cualquiera puede leer todas las reservas del sistema (nombres, teléfonos, direcciones). |
| C4 | `firestore.rules` | **`admin/tokens` escritura sin ownership** — cualquier usuario autenticado puede inyectar tokens FCM, potencialmente redirigir notificaciones. |
| C5 | `firestore.rules` | **Sin rate limiting** — no hay protección contra abuso en creación de reservas, reseñas, o registros. |
| C6 | `middleware.ts` | **Cookie solo verifica presencia** — no valida firma ni expiración. Un cookie arbitrario bypass el middleware. |
| C7 | `ReferralSection.tsx` | **Links de referido basados en teléfono** — adivinables y spammeables. No hay token único. |

### ALTOS (Arquitectura / Data)

| # | Ubicación | Problema |
|---|-----------|----------|
| A1 | `page.tsx` (admin) | **6 `onSnapshot` concurrentes** — costos de Firestore crecientes con escala. Cada reserva abierta mantiene un listener vivo. |
| A2 | `ClientDashboard.tsx` | **Consulta por `displayName` en vez de `uid`** — frágil. Si el nombre no coincide, 0 resultados. |
| A3 | `ReservationForm.tsx` | **Componente monolítico de 1131 líneas** — maneja 5 pasos, resumen, cupones, y envío en un solo archivo. |
| A4 | Layouts (admin, mi-cuenta) | **Usan `<a>` en vez de `<Link>`** — recarga completa de página en cada navegación, pierde estado. |
| A5 | `AdminChat.tsx` | **Componente huérfano** — existe pero no tiene ruta `/admin/chat`. |
| A6 | `CalendarView.tsx` | **Componente huérfano** — existe pero no es importado por ninguna página. |
| A7 | `mi-cuenta/page.tsx` | **Puntos de lealtad hardcodeados** — dashboard dice `completed.length * 10`, pero `LoyaltyProgram` consulta por teléfono. Dos fuentes de verdad diferentes. |
| A8 | `perros/page.tsx` | **Sin toast de error** — errores de escritura solo van a `console.error`, usuario no sabe qué falló. |
| A9 | `fotos/page.tsx` | **Dead end** — enlaza a `/#reservar` (landing) en vez de `/mi-cuenta/nueva-reserva`. |

### MEDIOS (UX / Calidad)

| # | Ubicación | Problema |
|---|-----------|----------|
| M1 | `AdminConfig.tsx` | **Estado stale** — sub-componentes inicializan estado local desde props, no se actualiza si cambia externamente. |
| M2 | `AdminCoupons.tsx` | **Sin edición** — solo crear/eliminar. No se puede editar un cupón existente. |
| M3 | `AdminCoupons.tsx` | **`usedCount` nunca se incrementa** — se crea en 0 pero nadie lo actualiza cuando se usa un cupón. |
| M4 | `admin/logs/page.tsx` | **Sin paginación** — limitado a 200 entradas hardcoded. |
| M5 | `admin/ia/page.tsx` | **Sin IA real** — solo matemáticas determinísticas. Título "Centro de IA" es engañoso. |
| M6 | `rutas/page.tsx` | **Sin mapa real** — muestra coordenadas GPS como texto, no renderiza un mapa. |
| M7 | `admin/resenas/page.tsx` | **Sin respuesta a reseñas** — solo se pueden eliminar. |
| M8 | `TermsModal.tsx` | **Fecha hardcodeada** — "Julio 2024" nunca se actualiza. |
| M9 | `admin/reservas/page.tsx` | **Historial inconsistente** — usa `getDocs` (one-shot) mientras el resto usa `onSnapshot` (real-time). |
| M10 | `notificaciones/page.tsx` | **Memory leak potencial** — `onSnapshot` no se limpia correctamente al cambiar `uid`. |

### BAJOS (Dead Code / Lint)

| # | Ubicación | Problema |
|---|-----------|----------|
| B1 | `WalkReminder.tsx` | Componente huérfano — nunca importado. |
| B2 | `PetProfileManager.tsx` | Componente huérfano — nunca importado. |
| B3 | `ClientAuth.tsx:50` | Código muerto — `localStorage.setItem('pq_google_pending')` comentado. |
| B4 | `ClientDashboard.tsx` + `ClientPanel.tsx` | Constantes duplicadas — `SERVICE_LABELS` definida en ambos. |
| B5 | `admin/config/page.tsx` + `admin/cupones/page.tsx` | Wrappers delgados — 19 líneas cada uno, solo delegan a componente. |

---

## 4. MODELO DE DATOS ACTUAL (Firestore)

```
users/{uid}
  ├── role: 'admin' | 'walker' | 'client'
  └── name?: string

clients/{uid}
  ├── name: string
  ├── phone: string
  ├── email: string
  └── createdAt: timestamp

pets/{petId}
  ├── ownerId: string → clients/{uid}
  ├── name: string
  ├── petType: 'perro' | 'gato' | 'otro'
  ├── breed: string
  ├── size: 'pequeño' | 'mediano' | 'grande'
  ├── age: number
  ├── weight: number
  └── notes: string

reservations/{resId}
  ├── uid: string → clients/{uid}
  ├── name: string
  ├── phone: string
  ├── petName: string
  ├── petType: string
  ├── service: string
  ├── date: string (YYYY-MM-DD)
  ├── time: string (HH:MM)
  ├── status: 'pending' | 'en_camino' | 'paseando' | 'completed' | 'cancelled'
  ├── assignedWalker?: string
  ├── walkCheckIn?: { lat, lng, timestamp, photoUrl }
  ├── walkCheckOut?: { lat, lng, timestamp, photoUrl }
  ├── walkNotes?: string
  ├── referralPhone?: string
  ├── finalPrice: number
  ├── appliedCoupon: string
  ├── discountApplied: number
  ├── notes: string
  └── createdAt: timestamp

walk-logs/{logId}
  ├── reservationId: string → reservations/{resId}
  ├── walkerId: string
  ├── clientId: string
  ├── checkIn: { lat, lng, timestamp }
  ├── checkOut: { lat, lng, timestamp }
  ├── photos: string[]
  ├── notes: string
  ├── distance?: number
  └── duration?: number

walkers/{walkerId}
  ├── name: string
  ├── phone: string
  ├── email: string
  ├── zones: string[]
  ├── status: 'active' | 'inactive' | 'vacation'
  ├── maxCapacity: number
  ├── schedule: Record<dayOfWeek, { start, end }[]>
  └── rating: number

referrals/{refId}
  ├── referrerPhone: string
  ├── refereePhone: string
  ├── refereeName: string
  ├── status: 'pending' | 'completed' | 'rewarded'
  ├── rewardAmount: number
  └── createdAt: timestamp

coupons/{couponId}
  ├── code: string
  ├── type: 'percentage' | 'fixed'
  ├── discount: number
  ├── maxUses: number
  ├── usedCount: number
  ├── active: boolean
  └── createdAt: timestamp

reviews/{reviewId}
  ├── name: string
  ├── petName: string
  ├── rating: number
  ├── text: string
  └── createdAt: timestamp

gallery-images/{imgId}
  ├── url: string (base64 data URL ← PROBLEMA C1)
  ├── caption: string
  └── createdAt: timestamp

conversations/{convId}
  ├── participants: string[]
  ├── lastMessage: string
  ├── unreadAdmin: number
  ├── unreadClient: number
  └── createdAt: timestamp
  └── messages/{msgId} (subcollection)
      ├── sender: string
      ├── text: string
      └── createdAt: timestamp

notifications/{uid}/items/{notifId}
  ├── title: string
  ├── message: string
  ├── type: 'walk_update' | 'loyalty' | 'referral' | 'system'
  ├── read: boolean
  └── createdAt: timestamp

loyalty/{uid}
  ├── points: number
  └── history: array

audit-logs/{logId}
  ├── action: string
  ├── entity: string
  ├── entityId: string
  ├── before?: object
  ├── after?: object
  └── timestamp: timestamp

admin/prices
  ├── [serviceName]: number

admin/config
  ├── hero: { title, subtitle }
  ├── social: { facebook, instagram, tiktok }
  ├── hours: Record<day, { start, end }[]>
  ├── tips: string[]
  ├── faq: array
  ├── terms: array
  ├── walkers: string[]
  └── maintenance: boolean

admin/banner
  ├── active: boolean
  ├── text: string
  └── type: 'info' | 'promo' | 'warning'

admin/tokens
  └── fcmTokens: string[]
```

---

## 5. MAPA DE NAVEGACIÓN ACTUAL

```
/ (Landing)
├── Hero, TrustBar, Services, HowItWorks, Gallery
├── FAQ, Reviews, ReviewForm
├── ReservationForm (sección #reservar)
├── ContactSection, Footer
└── WhatsAppButton, ScrollToTop

/login
├── Modo Familia (cliente)
├── Modo Equipo (admin)
└── Modo Paseador

/cancelar — búsqueda por teléfono

/mi-cuenta (Client)
├── Dashboard (inicio)
├── Nueva Reserva
├── Mis Perros (CRUD)
├── Mi Historial
├── Fotos ← PLACEHOLDER
├── Notificaciones
├── Referir Amigo
├── Mi Lealtad
├── Centro de Ayuda
└── Configuración

/admin (Admin)
├── Dashboard Ejecutivo
├── Reservas
├── Clientes
├── Perros
├── Paseadores
├── Rutas
├── Finanzas
├── Referidos
├── Cupones
├── Reseñas
├── Analítica
├── IA ← Sin IA real
├── Logs
└── Configuración

/paseador (Walker)
├── Dashboard (hoy)
└── Historial
```

---

## 6. LO QUE FUNCIONA BIEN

| Área | Detalle |
|------|---------|
| **Diseño visual** | Sistema de diseño consistente con CSS variables, dark/light theme, tokens de color |
| **Animaciones** | Framer Motion bien integrado, transiciones suaves, microinteracciones |
| **PWA** | Service workers funcionales, manifest correcto, notificaciones push |
| **Firewalls** | Firestore rules con helpers `isAdmin()`, `isWalker()`, catch-all deny |
| **Real-time** | `onSnapshot` para reservas, notificaciones, chat |
| **Responsive** | Sidebar colapsable, mobile-first, hamburger animations |
| **SEO** | Metadata completa, OpenGraph, JSON-LD, sitemap, robots.txt |
| **Performance** | Dynamic imports, Suspense boundaries, skeleton loading, IntersectionObserver en FloatingParticles |
| **Accesibilidad** | `prefers-reduced-motion` respetado, aria labels, focus rings |

---

## 7. GAP ENTRE ESTADO ACTUAL Y OBJETIVO v5.0

### Lo que el usuario pide vs lo que existe:

| Requisito | Estado | Gap |
|-----------|--------|-----|
| **Role Manager con permisos Firebase** | Solo UI hiding, rules básicas | Necesita Cloud Functions para roles + rules granulares |
| **CRM con ficha completa de cliente** | No existe | Colección nueva `crm/{clientId}` con LTV, historial unificado |
| **Registro de perros completo** | CRUD básico (8 campos) | Faltan: sexo, energía, personalidad, alergias, medicamentos, vacunas, veterinario, emergencia, preferencias, fotos, comandos |
| **Reservas desde dashboard** | Existe pero redirige a landing | Mover completamente dentro del panel |
| **Zonas geográficas** | No existe | Colección `zones`, asignación a paseadores |
| **Horarios por paseador** | No existe | Subcolección en `walkers` con disponibilidad |
| **Asignación inteligente** | Manual (admin elige) | Cloud Function con algoritmo de matching |
| **Bitácora automática** | Parcial (check-in/out photos) | Falta: clima, comportamiento, socialización, recomendaciones IA |
| **Centro IA real** | Solo matemáticas | Necesita Cloud Functions con modelo de sugerencias |
| **Notificaciones completas** | Solo in-app + push admin | Falta: push a cliente, push a paseador, flujo completo |
| **Acceso admin oculto** | Link visible en UI | Implementar gesto secreto (6 clics / long press logo) |
| **Design System unificado** | Parcial | Falta documentación formal, tokens de spacing, tipografía |
| **Accesibilidad WCAG 2.2** | Parcial | Faltan: skip links, ARIA roles completos, contraste audit |
| **Supervisor role** | No preparado | Necesita colección `supervisors`, rules, UI |
| **Logs de auditoría** | Parcial (solo en cupones) | Necesita logging en todas las operaciones |
| **Calendario admin** | Componente huérfano | Integrar en panel de reservas |

---

## 8. ARQUITECTURA PROPUESTA v6.0

### 8.1 Principios

1. **Firebase-first** — toda lógica de negocio en Cloud Functions, nunca confiar en el frontend
2. **Role-based access** — permisos validados en Firestore rules Y en Cloud Functions (defensa en profundidad)
3. **Real-time everything** — todos los paneles comparten datos en tiempo real vía `onSnapshot`
4. **Modular** — cada feature es un módulo independiente con su propia colección, reglas, y UI
5. **Audit everything** — toda operación de escritura genera un log de auditoría

### 8.2 Nueva Arquitectura

```
┌─────────────────────────────────────────────────┐
│                    CLIENTE                       │
│  Dashboard · Perros · Reservas · Historial      │
│  Fotos · Bitácora · Lealtad · Referidos         │
│  Notificaciones · Perfil · Config · Ayuda       │
└──────────────────┬──────────────────────────────┘
                   │ onSnapshot / Cloud Functions
┌──────────────────▼──────────────────────────────┐
│                 FIREBASE                         │
│                                                  │
│  ┌─────────────┐  ┌─────────────┐              │
│  │  Firestore   │  │   Storage   │              │
│  │  (18+ cols)  │  │  (fotos)    │              │
│  └──────┬──────┘  └─────────────┘              │
│         │                                        │
│  ┌──────▼──────────────────────────┐            │
│  │      Cloud Functions             │            │
│  │  • Role Manager                  │            │
│  │  • Smart Assignment              │            │
│  │  • Notification Dispatcher       │            │
│  │  • AI Suggestions Engine         │            │
│  │  • Weather Integration           │            │
│  │  • LTV Calculator                │            │
│  │  • Audit Logger                  │            │
│  └──────┬──────────────────────────┘            │
│         │                                        │
│  ┌──────▼──────┐  ┌─────────────┐              │
│  │     Auth     │  │  Analytics   │              │
│  │  (roles)     │  │  (GA4)       │              │
│  └──────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────┘
         │                    │
┌────────▼────────┐  ┌───────▼────────┐
│    PASEADOR     │  │   SUPERVISOR    │
│  Hoy · Paseos   │  │  (futuro)      │
│  Mapa · Fotos   │  │  Monitoreo     │
│  Reporte        │  │  Asignación    │
└─────────────────┘  └────────────────┘
         │                    │
┌────────▼────────────────────▼───────┐
│         ADMINISTRADOR               │
│  Dashboard · Calendario · Clientes  │
│  Perros · Reservas · Paseadores     │
│  Zonas · Horarios · Rutas           │
│  Finanzas · Referidos · Cupones     │
│  Reseñas · Analítica · Logs         │
│  IA · Config · Permisos · Auditoría │
└─────────────────────────────────────┘
```

### 8.3 Modelo de Datos v6

```
=== AUTENTICACIÓN ===

users/{uid}
  ├── role: 'admin' | 'walker' | 'client' | 'supervisor'
  ├── email: string
  ├── createdAt: timestamp
  └── lastLogin: timestamp

=== CLIENTE ===

clients/{uid}
  ├── personal: {
  │     name: string
  │     phone: string
  │     email: string
  │     avatar?: string
  │     address?: string
  │     emergencyContact?: { name, phone }
  │   }
  ├── loyalty: {
  │     points: number
  │     totalWalks: number
  │     freeWalksEarned: number
  │     freeWalksUsed: number
  │   }
  ├── referral: {
  │     code: string (unique, 8 chars)
  │     totalReferred: number
  │     totalRewards: number
  │   }
  ├── metrics: {
  │     ltv: number (lifetime value)
  │     avgFrequency: number (days between walks)
  │     lastWalkDate?: timestamp
  │     totalSpent: number
  │     joinDate: timestamp
  │   }
  └── preferences: {
        notifications: { push, email, sms }
        language: 'es' | 'en'
      }

=== MASCOTA ===

pets/{petId}
  ├── ownerId: string → clients/{uid}
  ├── basic: {
  │     name: string
  │     petType: 'perro' | 'gato' | 'otro'
  │     breed: string
  │     sex: 'macho' | 'hembra'
  │     size: 'pequeño' | 'mediano' | 'grande'
  │     age: number
  │     weight: number
  │     birthday?: string
  │   }
  ├── personality: {
  │     energyLevel: 'bajo' | 'medio' | 'alto'
  │     temperament: string[]
  │     notes: string
  │   }
  ├── health: {
  │     allergies: string[]
  │     medications: string[]
  │     vaccines: { name, date, nextDue }[]
  │     vetName: string
  │     vetPhone: string
  │   }
  ├── preferences: {
  │     favoriteToys: string[]
  │     commands: string[]
  │     specialNeeds: string
  │   }
  ├── photos: string[]
  └── createdAt: timestamp

=== RESERVA ===

reservations/{resId}
  ├── client: {
  │     uid: string → clients/{uid}
  │     name: string
  │     phone: string
  │   }
  ├── pet: {
  │     id: string → pets/{petId}
  │     name: string
  │     type: string
  │     breed: string
  │     notes?: string
  │   }
  ├── service: {
  │     type: string
  │     price: number
  │     duration: number
  │   }
  ├── schedule: {
  │     date: string
  │     time: string
  │     zone?: string
  │   }
  ├── assignment: {
  │     walkerId?: string → walkers/{walkerId}
  │     walkerName?: string
  │     assignedAt?: timestamp
  │     assignedBy?: 'system' | 'admin'
  │   }
  ├── walk: {
  │     status: 'pending' | 'assigned' | 'en_camino' | 'paseando' | 'completed' | 'cancelled'
  │     checkIn?: { lat, lng, timestamp, photoUrl }
  │     checkOut?: { lat, lng, timestamp, photoUrl }
  │     notes?: string
  │     distance?: number
  │     duration?: number
  │     weather?: string
  │     photos?: string[]
  │   }
  ├── payment: {
  │     finalPrice: number
  │     coupon?: string
  │     discount: number
  │     referralDiscount: number
  │     paid: boolean
  │   }
  ├── ai: {
  │     energyLevel?: string
  │     behavior?: string
  │     socialization?: string
  │     recommendations?: string[]
  │   }
  ├── referralPhone?: string
  ├── notes?: string
  ├── internalNotes?: string
  └── createdAt: timestamp

=== PASEADOR ===

walkers/{walkerId}
  ├── profile: {
  │     name: string
  │     phone: string
  │     email: string
  │     photo?: string
  │   }
  ├── status: 'active' | 'inactive' | 'vacation' | 'suspended'
  ├── zones: string[] (IDs de zonas)
  ├── capacity: {
  │     maxDaily: number
  │     maxWeekly: number
  │   }
  ├── schedule: {
  │     [dayOfWeek]: { start: string, end: string }[]
  │   }
  ├── performance: {
  │     rating: number
  │     totalWalks: number
  │     completedWalks: number
  │     avgDuration: number
  │     avgDistance: number
  │     incidents: number
  │   }
  ├── currentLoad: {
  │     todayAssigned: number
  │     todayCompleted: number
  │     weekAssigned: number
  │   }
  └── createdAt: timestamp

=== ZONA ===

zones/{zoneId}
  ├── name: string (ej: "Satélite Centro")
  ├── boundaries: GeoPoint[]
  ├── center: { lat, lng }
  ├── active: boolean
  ├── walkerIds: string[]
  ├── stats: {
  │     totalClients: number
  │     totalWalks: number
  │     avgDemand: number
  │   }
  └── createdAt: timestamp

=== CHAT ===

conversations/{convId}
  ├── participants: { id, role, name }[]
  ├── reservationId?: string
  ├── lastMessage: string
  ├── lastMessageAt: timestamp
  ├── unread: { admin: number, client: number, walker: number }
  └── messages/{msgId} (subcollection)
      ├── senderId: string
      ├── senderRole: 'admin' | 'client' | 'walker'
      ├── text: string
      ├── readBy: string[]
      └── createdAt: timestamp

=== NOTIFICACIONES ===

notifications/{uid}/items/{notifId}
  ├── title: string
  ├── message: string
  ├── type: 'reservation' | 'walk_update' | 'loyalty' | 'referral' | 'payment' | 'system' | 'promotion'
  ├── data?: { reservationId, walkerId, etc }
  ├── read: boolean
  ├── readAt?: timestamp
  ├── channel: 'in_app' | 'push' | 'email'
  └── createdAt: timestamp

=== CONFIGURACIÓN ===

admin/config
  ├── hero: { title, subtitle }
  ├── social: { facebook, instagram, tiktok, whatsapp }
  ├── hours: Record<day, { start, end }[]>
  ├── tips: string[]
  ├── faq: { question, answer, category }[]
  ├── terms: { title, content, icon }[]
  ├── maintenance: boolean
  └── features: {
        loyaltyEnabled: boolean
        referralsEnabled: boolean
        chatEnabled: boolean
        walkerAssignment: 'manual' | 'auto' | 'hybrid'
      }

admin/prices
  └── [serviceName]: { price, duration, active }

admin/banner
  ├── active: boolean
  ├── text: string
  ├── type: 'info' | 'promo' | 'warning'
  └── link?: string

=== AUDITORÍA ===

audit-logs/{logId}
  ├── actor: { uid, role, name }
  ├── action: 'create' | 'update' | 'delete' | 'login' | 'assign' | 'complete'
  ├── entity: 'reservation' | 'client' | 'walker' | 'pet' | 'coupon' | 'config'
  ├── entityId: string
  ├── before?: object
  ├── after?: object
  ├── ip?: string
  └── timestamp: timestamp
```

---

## 9. SISTEMA DE ROLES Y PERMISOS

### Roles

| Rol | Nivel | Acceso |
|-----|-------|--------|
| **Client** | 0 | Solo su dashboard, sus reservas, sus perros |
| **Walker** | 1 | Sus paseos asignados, mapa, reportes |
| **Supervisor** | 2 | Lectura de todos los paseadores + reservas de zona (preparado, desactivado) |
| **Admin** | 3 | Todo el sistema |

### Matriz de Permisos

| Recurso | Client | Walker | Supervisor | Admin |
|---------|--------|--------|------------|-------|
| Ver landing | ✅ | ✅ | ✅ | ✅ |
| Crear reserva | ✅ (propia) | ❌ | ❌ | ✅ (cualquiera) |
| Ver reservas | ✅ (propias) | ✅ (asignadas) | ✅ (zona) | ✅ (todas) |
| Editar reserva | ❌ | ❌ | ❌ | ✅ |
| Cancelar reserva | ✅ (propia, pending) | ❌ | ❌ | ✅ |
| Ver clientes | ❌ | ❌ | ✅ (zona) | ✅ (todos) |
| Editar cliente | ❌ | ❌ | ❌ | ✅ |
| Ver perros | ✅ (propios) | ✅ (asignados) | ✅ (zona) | ✅ (todos) |
| Editar perros | ✅ (propios) | ❌ | ❌ | ✅ |
| Iniciar paseo | ❌ | ✅ (asignado) | ❌ | ❌ |
| Finalizar paseo | ❌ | ✅ (asignado) | ❌ | ❌ |
| Subir fotos | ❌ | ✅ (paseo propio) | ❌ | ✅ |
| Ver finanzas | ❌ | ❌ | ❌ | ✅ |
| Ver analítica | ❌ | ❌ | ✅ (zona) | ✅ |
| Gestionar paseadores | ❌ | ❌ | ❌ | ✅ |
| Gestionar zonas | ❌ | ❌ | ❌ | ✅ |
| Configuración | ❌ | ❌ | ❌ | ✅ |
| Ver logs | ❌ | ❌ | ❌ | ✅ |
| Enviar notificación | ❌ | ❌ | ❌ | ✅ |
| Chat | ✅ (con admin) | ✅ (con admin) | ✅ | ✅ |

### Implementación Firebase

```javascript
// firestore.rules (nuevo)

function isAuthenticated() {
  return request.auth != null;
}

function isAdmin() {
  return isAuthenticated() &&
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
}

function isWalker() {
  return isAuthenticated() &&
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'walker';
}

function isSupervisor() {
  return isAuthenticated() &&
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'supervisor';
}

function isClient() {
  return isAuthenticated() &&
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'client';
}

function isOwnerOf(userId) {
  return isAuthenticated() && request.auth.uid == userId;
}

function isInZone(zoneId) {
  // Walker can only access reservations in their assigned zones
  let walker = get(/databases/$(database)/documents/walkers/$(request.auth.uid));
  return zoneId in walker.data.zones;
}

// Reservas: lectura restringida por rol
match /reservations/{resId} {
  allow read: if isAdmin() ||
    (isClient() && resource.data.client.uid == request.auth.uid) ||
    (isWalker() && resource.data.assignment.walkerId == request.auth.uid) ||
    (isSupervisor() && resource.data.schedule.zone in getWalkerZones());
  allow create: if isAuthenticated();
  allow update: if isAdmin() ||
    (isWalker() && resource.data.assignment.walkerId == request.auth.uid);
  allow delete: if isAdmin();
}
```

---

## 10. CLOUD FUNCTIONS PROPUESTAS

### Core Functions

| Function | Trigger | Propósito |
|----------|---------|-----------|
| `assignWalker` | `reservations.onWrite` | Asignación inteligente de paseador |
| `notifyStatusChange` | `reservations.onUpdate` | Notificar cambios de estado |
| `calculateLTV` | `reservations.onWrite` | Actualizar valor de vida del cliente |
| `updateWalkerStats` | `reservations.onUpdate` | Actualizar métricas del paseador |
| `awardLoyaltyPoints` | `reservations` (status→completed) | Otorgar puntos de lealtad |
| `processReferral` | `reservations` (status→completed + referralPhone) | Procesar recompensa de referido |
| `generateWalkReport` | `reservations` (status→completed) | Generar reporte IA del paseo |
| `sendNotification` | Firestore write | Dispatch de notificaciones push |
| `auditLog` | All Firestore writes | Generar logs de auditoría |
| `roleGuard` | `users.onWrite` | Validar cambio de roles |

### AI Functions

| Function | Propósito |
|----------|-----------|
| `suggestWalkTime` | Analizar patrones de demanda por zona/hora |
| `detectInactiveClient` | Alertar clientes sin reservas en 20+ días |
| `predictDogEnergy` | Basado en historial de paseos del perro |
| `recommendService` | Basado en perfil del perro y historial |
| `generateWeatherAlert` | Clima adverso → notificar cancelación |

---

## 11. COMPONENTES NUEVOS NECESARIOS

| Componente | Ubicación | Propósito |
|------------|-----------|-----------|
| `RoleGuard` | `src/components/auth/` | HOC que valida rol antes de renderizar |
| `PermissionGate` | `src/components/auth/` | Render condicional por permiso |
| `ZoneManager` | `src/components/admin/` | CRUD de zonas con mapa |
| `WalkerScheduleEditor` | `src/components/admin/` | Editor de horarios por paseador |
| `SmartAssignModal` | `src/components/admin/` | Modal de asignación automática + override |
| `CRMClientCard` | `src/components/admin/` | Ficha completa de cliente (LTV, historial, perros) |
| `WalkReportCard` | `src/components/shared/` | Reporte completo de paseo con IA |
| `NotificationCenter` | `src/components/shared/` | Centro de notificaciones unificado |
| `CalendarView` | `src/components/admin/` | Calendario real con drag-and-drop |
| `MapWidget` | `src/components/shared/` | Widget de mapa con rutas (Leaflet/Google Maps) |
| `WeatherWidget` | `src/components/shared/` | Widget de clima para paseo |
| `AnalyticsDashboard` | `src/components/admin/` | Dashboard con charts reales (Recharts) |
| `AuditLogViewer` | `src/components/admin/` | Visor de logs con paginación |
| `ChatWidget` | `src/components/shared/` | Chat en tiempo real entre roles |
| `HiddenAdminAccess` | `src/components/shared/` | Gesto secreto para acceder a admin |
| `SkeletonLoader` | `src/components/ui/` | Skeleton unificado para todas las secciones |

---

## 12. COMPONENTES A REEMPLAZAR/OPTIMIZAR

| Componente Actual | Acción | Razón |
|-------------------|--------|-------|
| `ReservationForm.tsx` (1131 líneas) | **Descomponer** en 5 sub-componentes por paso | Mantenibilidad, testing, code splitting |
| `AdminGallery.tsx` | **Reescribir** para usar Firebase Storage | Base64 en Firestore es insostenible |
| `AdminChat.tsx` | **Crear ruta** `/admin/chat` | Huérfano, sin acceso |
| `CalendarView.tsx` | **Integrar** en `/admin/reservas` | Huérfano, sin uso |
| `ClientPanel.tsx` | **Eliminar o proteger** | Sin autenticación, riesgo de seguridad |
| `ClientDashboard.tsx` | **Unificar** con `mi-cuenta/page.tsx` | Dos dashboards para el mismo rol |
| `WalkReminder.tsx` | **Eliminar** | Huérfano |
| `PetProfileManager.tsx` | **Eliminar** | Huérfano |
| `AdminCoupons.tsx` | **Extender** con edición | Solo CRUD incompleto |
| `AdminConfig.tsx` | **Refactorizar** estado | Stale state entre sub-componentes |

---

## 13. ROADMAP PET Ap v6.0

### FASE 9 — Seguridad + Roles (CRÍTICO)
- Cloud Functions para Role Manager
- Firestore rules granulares por rol + zona
- Rate limiting en creación de reservas
- Validación de session cookie con Firebase Admin SDK
- Eliminar lectura pública de `reservations`
- Token único para referrals (no teléfono)
- Storage rules con ownership checks

### FASE 10 — Perros Completo
- Expandir ficha de mascota (16+ campos)
- Fotos de mascota en Storage
- Historial médico/vacunas
- Veterinario de contacto
- Comandos y preferencias

### FASE 11 — Zonas + Horarios + Asignación
- CRUD de zonas con límites geográficos
- Editor de horarios por paseador
- Cloud Function de asignación inteligente
- Capacidad y zona como filtros

### FASE 12 — CRM + Analytics
- Ficha de cliente con LTV
- Dashboard de analítica con charts reales (Recharts)
- Métricas por zona, paseador, servicio
- Exportación de datos

### FASE 13 — Chat + Notificaciones
- Chat en tiempo real entre cliente-paseador-admin
- Notificaciones push completas (todos los roles)
- Centro de notificaciones unificado
- Templates de notificación

### FASE 14 — IA + Bitácora
- Cloud Functions con sugerencias IA
- Bitácora automática con datos de clima
- Reportes de paseo con análisis de comportamiento
- Detección de clientes inactivos

### FASE 15 — Admin Panel Upgrade
- Calendario real con drag-and-drop
- Mapa de rutas con Leaflet
- Logs de auditoría con paginación
- Acceso admin oculto (gesto secreto)
- Gestión de permisos granular

### FASE 16 — Accesibilidad + Design System
- WCAG 2.2 audit completo
- Skip links, ARIA roles, contraste
- Documentación formal del Design System
- Tokens de spacing, tipografía, elevación

### FASE 17 — Performance + Testing
- Testing framework (Vitest + Testing Library)
- Unit tests para Cloud Functions
- E2E tests para flujos críticos
- Bundle analysis y optimization
- Core Web Vitals optimization

---

## 14. RECOMENDACIONES FINALES

### Inmediatas (antes de v6)
1. **Eliminar `ClientPanel.tsx`** de la landing o protegerlo con auth
2. **Mover galería a Firebase Storage** — los base64 van a causar problemas de costos y límites
3. **Crear ruta `/admin/chat`** para el componente AdminChat
4. **Agregar toast de error** en `perros/page.tsx` y `config/page.tsx`
5. **Cambiar `<a>` por `<Link>`** en todos los layouts de navegación

### A mediano plazo
6. **Cloud Functions para roles** — la seguridad actual depende solo del frontend
7. **Rates limits** — Firestore rules con `request.resource.data.keys().size()` y validaciones
8. **Unificar dashboards** — ClientDashboard.tsx y mi-cuenta/page.tsx hacen lo mismo
9. **Descomponer ReservationForm** — 1131 líneas es insostenible
10. **Integrar calendario** — CalendarView existe pero no se usa

### A largo plazo
11. **Testing** — 0 tests actualmente. Necesita mínimo Vitest + React Testing Library
12. **Monitoring** — Firebase Performance Monitoring + Sentry
13. **CI/CD** — GitHub Actions para lint + test antes de merge
14. **Documentación** — Storybook para el Design System
15. **Escalabilidad** — Considerar migrar a Next.js Server Components para reducir bundle del cliente

---

*Este documento fue generado por un equipo de auditoría de 16 roles especializados. Cada recomendación está respaldada por el análisis del código fuente actual.*
