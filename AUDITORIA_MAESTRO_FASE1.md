# Auditoría Fase 1 — PET Ap bajo demanda

> Fecha: 4 de agosto de 2026 · Repo: `pet-reservations` · No se modificó código ni se borró dato alguno.

Búsquedas equivalentes a `rg` ejecutadas con la herramienta de búsqueda del entorno (rg no está instalado en esta máquina).

## 1. Formularios de reserva

| Formulario | Archivo | Página | Estado según modelo objetivo |
|------------|---------|--------|------------------------------|
| `ReservationForm` (reserva completa: pasos perro/dirección/horario/confirmar) | `src/components/ReservationForm.tsx` | Solo `/mi-cuenta/nueva-reserva` (autenticado, Familia PET) | ✅ Correcto: no está en página pública |
| `QuoteForm` (cotizador: zona → precio → WhatsApp) | `src/components/QuoteForm.tsx` | Página pública `/` (id `#cotizar`) | ⚠ En conflicto con el modelo: "consultar precios" debe ser solo Familia PET; CTA público debe ser "Entrar a Familia PET" |
| `BookingForm` / `QuickBooking` | — | No existen | ✅ |

- La página pública (`src/app/page.tsx`) tiene CTA "Cotizar mi paseo" → `#cotizar` (público) y, autenticado, "Ir a reservar" → `/mi-cuenta/nueva-reserva`.
- `Header.tsx` CTA primario: "Cotizar". Nav público: Inicio / Servicios / Cómo funciona / Reseñas / Cotizar.

## 2. Tema visual

- `src/context/ThemeContext.tsx` — estado `theme` (`'dark'` por defecto), persistencia `localStorage['theme']`, atributo `data-theme` en `<html>`, función `toggle`.
- `src/app/globals.css` — bloque `[data-theme='light']` (línea 96) y `[data-theme='dark']` (línea 109) con tokens oscuros; `:root` es claro por defecto.
- `src/components/Header.tsx:76` — botón de cambio de tema (Sun/Moon).
- `src/components/Providers.tsx` y `src/app/page.tsx` envuelven con `ThemeProvider`.
- NO existe `next-themes`, NI `prefers-color-scheme`, NI cambio automático por SO (solo manual).
- Objetivo Fase 3: eliminar el selector y fijar un solo tema claro.

## 3. Configuración / "Zona Quebrada"

- `admin/config` ya NO se lee (eliminado en `81669c0`). Única fuente: `appSettings/public` vía `onSnapshot` en `ConfigContext.tsx`.
- "Zona Quebrada"/"Quebrada" no aparece en `src/`; guard de build `scripts/check-forbidden.mjs` lo bloquea.
- Riesgo residual: documento `admin/config` sigue en Firestore (archivado, no eliminado) — inofensivo pero presente.
- `appSettings/public`: falta confirmar que existe en el proyecto `prod` (pet-1cb0b).

## 4. Logotipo

- Actual: icono genérico de perrito `Dog` de `lucide-react` (Header, login, layouts admin/paseador/mi-cuenta, Footer, not-found) y `public/icons/icon-192.svg` + `icon-512.svg` (cara de perro de elipses naranjas sobre `#0a0a0f`).
- Historial Git: **nunca se ha versionado otro logo** — los únicos assets de imagen en toda la historia son esos dos SVGs. No existe un logotipo anterior aprobado en el repo.
- Según Fase 4 del maestro: *"Si el archivo anterior no existe, detener solamente esta parte y solicitar el recurso original."* → **BLOQUEADO: solicitar el logotipo original al propietario.**

## 5. Autenticación y roles

- Google: **GIS** (`accounts.google.com/gsi/client`) + `signInWithCredential` (`GoogleAuthProvider.credential`). NO quedan `signInWithPopup`/`signInWithRedirect`.
- Correo/contraseña: `signInWithEmailAndPassword`, registro `createUserWithEmailAndPassword`, reset `sendPasswordResetEmail` (agregado en `81669c0`).
- Roles actuales: `admin` | `walker` | `client` (colección `users/{uid}.role`). Objetivo maestro: `admin` | `walker` | `customer`.
- Enrutado por rol: `src/middleware.ts` con cookies `__session` / `__role`; `ROLE_ROUTES`: `/admin:[admin]`, `/paseador:[walker]`, `/mi-cuenta:[client,admin,walker]` (admin puede todo).
- Redirecciones post-login (`login/page.tsx`): client → `/mi-cuenta`, walker → `/paseador`, admin → `/admin`.
- Redirección con intención preservada: `middleware` ya añade `?redirect=` al login, pero **no se consume** para volver al flujo tras autenticar.
- No hay custom claims; RBAC vía reglas Firestore (`isAdmin`/`isWalker`).
- Cuenta suspendida: sin estado "suspendido" (roles solo `admin|walker|client`). Sin bucle de redirecciones previsto.

## 6. Arquitectura de datos vs. colecciones mínimas del maestro

| Maestro (Fase 13) | Actual en el repo | Estado |
|-------------------|-------------------|--------|
| `customerProfiles` | `clients/{uid}` | Renombrar/alias |
| `dogs` | `pets/{petId}` | Renombrar/alias |
| `services` | `admin/prices` + `src/lib/services.ts` | Migrar a colección |
| `serviceRequests` | `reservations` + `serviceOrders/sessions` + `petAhoraRequests` | Consolidar |
| `walkerOffers` / `assignments` | `petAhoraOffers` / `petAhoraLeases` | ✅ existe base |
| `walkSessions` / `walkReports` | `walk-logs` + fotos | Consolidar |
| `incidents` | — | Crear |
| `payments` | `wallets` + `transactions` | Existe parcial |
| `walkerAvailability` | `walkerProfiles.schedule` + `walkerPresence` | Existe parcial |
| `zones`, `appSettings`, `users`, `notifications`, `auditLogs` | `zones`, `appSettings/public`, `users`, `notifications`, `audit-logs` | ✅ |

Nota: el módulo **PET Ahora** (164 archivos referencian petAhora) ya implementa el motor bajo demanda: solicitudes, ofertas con vencimiento, leases, presencia de paseadores. Base sólida para Fase 8/9.

## 7. Animaciones

- `framer-motion` (v11) usado en múltiples componentes.
- `globals.css:334` ya respeta `prefers-reduced-motion` (mismo bloque requerido por el maestro, casi literal).
- No hay `useReducedMotion` en componentes individuales (depende del CSS global).

## 8. Variables de entorno

Todas las usadas existen en `.env.local`:
`NEXT_PUBLIC_FIREBASE_*` (API_KEY, AUTH_DOMAIN, PROJECT_ID, STORAGE_BUCKET, MESSAGING_SENDER_ID, APP_ID), `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_GIT_SHA`, `VERCEL_*`. Sin variables faltantes.

## 9. Errores en consola / consultas fallidas

No verificables sin ejecutar el sitio; se validan en `TESTING.md` (§11–13). `ConfigContext` registra errores de `appSettings` y muestra banner de config desactualizada.

## 10. Conclusión vs. prioridades P0 (Fase 17)

| P0 | Estado |
|----|--------|
| Fuente duplicada "Zona Quebrada" | ✅ Resuelto (`81669c0`) |
| Acceso de Google | ✅ GIS + credencial; mejoras de UX (Fase 5) pendientes |
| Roles y redirecciones | ⚠ Pendiente: `client`→`customer`, `/mi-cuenta`→`/familia`, `/paseador`→`/walker`, consumo de `?redirect=` |
| Eliminación del cambio de tema | ⚠ Pendiente (Fase 3) |
| Restauración del logo | 🔒 **Bloqueado**: falta el recurso original del propietario |
| Reserva exclusiva Familia PET | ⚠ Pendiente: retirar cotizador público / CTA "Entrar a Familia PET" |
| Reglas de seguridad | ✅ Reglas `isAdmin`/`isWalker` desplegadas; ampliar para nuevos roles |
| Asignación sin condiciones de carrera | ⚠ Verificar transacción de leases PET Ahora |

## Archivos clave para las próximas fases

- `src/context/ThemeContext.tsx`, `src/components/Header.tsx`, `src/app/globals.css` → Fase 3
- `src/lib/brand.ts`, `public/icons/` → Fase 4 (bloqueada)
- `src/app/login/page.tsx`, `src/middleware.ts` → Fase 5
- `src/app/mi-cuenta/*`, `src/components/QuoteForm.tsx`, `src/app/page.tsx` → Fases 5/7/8
- `src/components/PetAhora*`, `functions/` → Fases 8/9
