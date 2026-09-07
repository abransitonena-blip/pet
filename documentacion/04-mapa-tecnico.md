# Mapa técnico vivo — PET Ap

Actualizado: 24 de agosto de 2026. Fuente: código del árbol de trabajo PET-ORN; la documentación histórica se considera evidencia secundaria cuando contradice al código.

Hecho nuevo (24-ago-2026, bloque Walker): cada transición operativa se confirma mediante una transacción que vuelve a leer `walkSessions/{id}`, comprueba `walkerId`, estado anterior y siguiente estado, y escribe únicamente el estado y su timestamp canónico. La tarjeta Walker presenta una línea de progreso y una sola acción siguiente; no calcula ETA ni expone finanzas.

Hecho nuevo: el selector local de reserva contrasta cada `address.zoneId` con la consulta limitada de zonas activas antes de permitir continuar. Production todavía requiere un Preview focalizado para incorporar este cierre; no se infiere ni migra una zona legacy.

## Convenciones

- **Autoridad:** custom claims de Firebase Auth y reglas Firestore. `users.role` es solo mirror visual (`src/lib/roles.ts:1-8`).
- **Modelo canónico:** `customerProfiles`, `dogs`, `addresses`, `serviceOrders` y `walkSessions`.
- **Legacy:** `clients`, `pets` y `reservations`; adaptadores solo lectura (`src/lib/repositories/customerRepository.ts:2-41`, `src/lib/repositories/dogRepository.ts:2-35`).
- **Spark:** Cloud Functions, FCM, PET Ahora, mutaciones de créditos, canje, referidos automáticos y uploads privados están apagados por defecto (`src/lib/featureFlags.ts:1-35`).
- **Estados:** IMPLEMENTADO, PARCIAL, PROPUESTO, REQUIERE VALIDACIÓN HUMANA, BLOQUEADO POR PLAN/COSTO o FUERA DE LA FASE ACTUAL.

## Inventario de arquitectura

| # | Elemento | Propósito y archivo principal | Consumidores / E/S / fuente de verdad | Datos, acceso, reglas e índices | Pruebas | Estado, legado, riesgo y siguiente acción |
|---:|---|---|---|---|---|---|
| 1 | Rutas públicas | Landing y legales en `src/app/page.tsx`, `nosotros`, `preguntas-frecuentes`, `privacidad`, `terminos` | Entrada HTTP; salida HTML/metadata | Sin datos privados; metadata en `src/lib/seoMetadata.ts` | `p07-seo-security` | IMPLEMENTADO. Revisar enlaces en cada cambio de rutas. |
| 2 | Login Familia | `src/app/login/page.tsx` | Google popup/GIS y correo; destino `/familia` | Auth; claim ausente equivale solo a customer (`src/lib/roles.ts:56-66`) | `phase-c-family-onboarding`, `p03-auth-flow` | IMPLEMENTADO. Validación humana de navegadores reales. |
| 3 | Login equipo | `src/components/TeamLoginForm.tsx`, `/equipo` | Google popup/correo; admin/supervisor → `/admin`, walker → `/walker` | Claim interno obligatorio; walker requiere perfil activo | `phase-c-team-google-login` | IMPLEMENTADO. Nunca aceptar mirror como autoridad. |
| 4 | Roles y destinos | `src/lib/roles.ts` | Layouts, login, middleware | Claims `customer/walker/supervisor/admin`; `ROLE_ACCESS` | `p08-roles`, `p03-auth-flow` | IMPLEMENTADO. `caja` reservado para fase financiera. |
| 5 | Middleware/layouts | `src/middleware.ts`, layouts de familia/admin/walker/supervisor | Cookie `__session` solo navegación; layout valida token | Cabeceras privadas `no-store`; reglas son barrera de datos | `p08-middleware`, `p08-session` | IMPLEMENTADO. Comentario de middleware aún menciona Cloud Functions y debe corregirse. |
| 6 | Perfiles customer | `src/lib/customerProfile.ts`, `src/lib/familyOnboarding.ts`, `/familia/configuracion-inicial` | Login crea el perfil mínimo; el layout dirige al asistente si faltan contacto, dirección zonificada o perro | `customerProfiles/{uid}` por UID; fallback `clients` excluido del onboarding | `p10-customer-profile`, `family-onboarding`, `family-onboarding-ui-contract` | IMPLEMENTADO local. Validación identifica el campo exacto, permite volver y conserva los pasos ya persistidos por UID; suite local PASS. La QA autenticada del asistente sigue siendo manual antes de Production. |
| 7 | Perros | `src/app/familia/perros/page.tsx`, `dogRepository.ts` | Familia y reserva | `dogs.ownerId`; fallback puntual a `pets`; queries propias con límite | `p04`, `p08-repositories` | PARCIAL. CRUD canónico activo; adapter legacy solo lectura. |
| 8 | Direcciones | `src/app/familia/direcciones/page.tsx`, `familyOnboarding.ts`, `ReservationFlow.tsx` | Familia selecciona una zona activa por ID; reserva consume únicamente direcciones persistidas y zonificadas | `addresses.ownerId`, `zoneId`; ruleset activo exige zona existente/activa y propiedad; Admin resuelve nombre por lotes | `p04` emulador, `reservation-flow-p0`, `family-onboarding` | IMPLEMENTADO. Se retiró el ID temporal ficticio y el onboarding prefiere una dirección propia que ya tenga `zoneId`; sin migración legacy. |
| 9 | Servicios/precios | `src/lib/servicePricing.ts`, `AdminServicePricing.tsx`, `PricesContext.tsx` | Admin configura; Familia consume proyección pública | Admin `admin/prices`; público autenticado `appSettings/servicePrices`; centavos/MXN/versionado | `reservation-flow-p0`, reglas de precios | IMPLEMENTADO local/reglas activas. Falta captura humana de tarifas reales. |
| 10 | Reservas legacy | `ReservationsContext.tsx`, pestaña legacy de `admin/reservas`, paneles Familia legacy | Lectura histórica; escrituras bloqueadas por flag | `reservations`; siete índices legacy conservados | `p04`, `vertical-slice-canonical` | PARCIAL/P1. Sigue siendo consumidor activo de lectura y mezcla UX. No migrar automáticamente. |
| 11 | `serviceOrders` | `src/lib/submitReservation.ts`, `useServiceOrders.ts` | Reserva crea; Familia/Admin leen | Propiedad `customerId`; candidato valida dirección y único perro propios; precio no escrito por navegador; índice customerId+createdAt | `vertical-slice-canonical`, `reservation-flow-p0`, `p04` emulador | IMPLEMENTADO local. Query global Admin solo para rol interno; reglas reforzadas aún no publicadas. |
| 12 | `walkSessions` | `submitReservation.ts`, `useCanonicalWalkSessions.ts`, `useServiceOrders.ts` | Familia crea requested; Admin asigna; Walker ejecuta | Ruleset activo compara order/session en cliente, perro, dirección, zona, servicio, versión y horario; índices por customer/walker/order/status; límite 100 | vertical slice, walker panel, reglas focales | IMPLEMENTADO. Doble asignación protegida por transacción; no se hicieron escrituras reales en esta fase. |
| 13 | Panel Familia | `src/app/familia/*`, `FamilyLayoutClient.tsx`, `AppShell.tsx` | Perfil, perros, direcciones, reserva, historial | Menú móvil desplegable; mezcla canónico y lecturas `reservations` en inicio/historial | `vertical-slice-canonical`, sesión, `family-onboarding-ui-contract` | PARCIAL/P1. Navegación móvil corregida; falta unificar historial sin migrar legacy. |
| 14 | Panel Admin | `src/app/admin/*`, `AdminLayoutClient.tsx` | Operación, configuración, cola canónica | Claims admin/supervisor; varias pantallas legacy | tests de roles, vertical slice | PARCIAL/P1. Separar operación canónica de herramientas heredadas. |
| 15 | Panel Walker | `WalkerPanelContext.tsx`, `WalkerSessionCard.tsx`, rutas walker | Sesiones propias, historial, perfil | Query `walkerId == uid`, `orderBy scheduledDate`, `limit(100)` | `walker-panel`, emulador | IMPLEMENTADO local y desplegado. Perfil escribe allowlist. |
| 16 | Asignación | `useCanonicalWalkSessions.ts`, `CanonicalDispatchPanel.tsx`, `admin/reservas` | Admin/supervisor ve zona operativa y selecciona walker activo por UID | Transacción lee sesión/perfil; dirección→zona se resuelve en lotes limitados | vertical slice, `reservation-flow-p0` | IMPLEMENTADO local. Código autoassign legacy permanece aislado por flag. |
| 17 | Transiciones | `src/lib/domainStates.ts`, `walkerPanel.ts`, `useServiceOrders.ts`, reglas | Walker avanza secuencialmente; la UI muestra timeline y una sola acción | assigned→confirmed→on_the_way→arrived→in_progress→completed; transacción exige estado y UID todavía vigentes | `walker-panel`, `p04`; focal 17/17 | IMPLEMENTADO local. Conflicto concurrente se informa sin sobrescribir; no permite saltos, reasignación ni campos financieros. |
| 18 | Reportes | `src/lib/walkReports.ts`, `src/lib/useWalkReport.ts`, `src/components/walker/WalkReportEditor.tsx` y rutas `/walker|familia/reportes/[sessionId]`, `/admin/reportes` | `walkSessions/{id}` completada → `walkReports/{id}` determinista; Walker redacta/envía, Familia lee solo enviado y staff consulta operación | Ruleset activo `b1998c37…6b18` acepta customer explícito, legacy `client` y customer sin claim solo para `get` propio enviado o inexistente; Walker asignado activo vigente; Admin/Supervisor consulta limitada a 50; medios vacíos e inmutabilidad tras envío | `walk-reports`, `walk-reports-runtime`, emulador focal | DESPLEGADO: Production `dpl_6b8g76…`; flag activo, listener solo en editor Walker, historial canónico Familia y guard anti doble clic. Pendiente QA autenticada con una sesión completada existente. |
| 19 | Reseñas | `Reviews.tsx`, `ReviewForm.tsx` | Lectura pública moderada; formulario apagado | `reviews`, `moderationStatus`, `verified`; límite 20/50 | `p05`, `p06` | PARCIAL. Creación pública desactivada; futuro por sesión completada/pagada. |
| 20 | Notificaciones | `NotificationBell.tsx`, `/familia/notificaciones` | In-app propia, marcar leída | `notifications/{uid}/items`; FCM apagado | `p02`, `p04` | PARCIAL/P1. Dos `catch` silenciosos al marcar leídas. |
| 21 | Medios/Cloudinary | `Gallery.tsx`, `CloudinaryProvider.ts`, `cloudinaryAdmin.server.ts` | Galería pública consentida; uploads privados apagados | `gallery-images`; URLs públicas no equivalen a privacidad | `p05`, `p06` | PARCIAL. Eliminación de asset requiere backend confiable. |
| 22 | SW/caché | `public/sw.js`, `PWARegister.tsx` | Cache estática v3; excluye privadas | Un SW en `/`; FCM SW no se registra con flag apagado | `phase-b-cache-policy` | IMPLEMENTADO. Verificación manual tras cada deploy. |
| 23 | Firebase Auth | `src/firebase/config.ts`, `googleAuth.ts`, `auth.ts` | Persistencia, popup, claims, logout/cookie | Variables públicas; sin secretos cliente | auth/roles/team tests | IMPLEMENTADO. Safari y dominios estables requieren validación humana. |
| 24 | Consultas/listeners | Inventario en `src/lib/*`, contextos y componentes | onSnapshot/getDocs con cleanup mayoritario | Consultas canónicas limitadas; legacy aún incluye algunas consultas amplias | `duplication-listeners`, `p04-query-compatibility` | PARCIAL/P1. `AdminChat`, referidos y algunos contextos carecen de límites. |
| 25 | Reglas/índices | `firestore.rules`, `firestore.indexes.json` | Autoridad por documento y compatibilidad de queries | Ruleset activo `981bae3b…09ad`/`b6df2281…c61e`; valida precios, zona activa, dirección/perro propios y coherencia order/session | focal precios+integridad 12/12; suite unitaria 361/361; regresión positiva roles baseline 3/3 | IMPLEMENTADO en reglas activas. La suite P0.4 aspiracional conserva 21 divergencias preexistentes conocidas. |
| 26 | APIs | `/api/version`, `/api/presence-offline` | Versión pública; presencia usa Admin SDK servidor | Respuestas privadas/no-store; presencia desactivada en UI | `p07` | PARCIAL/BLOQUEADO Spark: `presence-offline` añade backend Vercel privilegiado y debe mantenerse fuera del MVP operativo. |
| 27 | Scripts admin | `scripts/onboard-walker.mjs`, `set-user-role-claim.mjs`, verificadores | Operación local explícita verify-only/execute confirmado | Admin SDK/ADC fuera del repo; salida sanitizada | fase C tests | IMPLEMENTADO como herramienta local. Nunca empaquetar en Vercel. |
| 28 | Migración/legacy | `migrate-collections.js`, `migrate-prod.js`, repositories | Migraciones manuales; adapters lectura | `clients→customerProfiles`, `pets→dogs`, `reservations` sin migración automática | `p09`, repository tests | BLOQUEADO hasta autorización. `run-migrate.sh` y artefactos deben quedar fuera de runtime. |
| 29 | Finanzas F1 | `src/lib/finance/domain/*` | Contratos puros | Money centavos/MXN; ledger inmutable; sin Firebase/React | `f01-financial-domain` | IMPLEMENTADO como dominio puro, no conectado. |
| 30 | Tickets/impresión | `finance/domain/tickets.ts`, F0 | Contrato futuro TicketBuilder/ESC-POS/transporte | Sin colecciones ni hardware | F1 pura | PROPUESTO. Siguiente fase solo local tras estabilizar flujo. |
| 31 | Vercel | `next.config.js`, `vercel.json`, `.vercelignore` | Hosting, headers, redirects, previews | Hobby no apto para operación comercial según documento de hosting | SEO/security/cache tests | PARCIAL/BLOQUEADO POR PLAN/COSTO para lanzamiento comercial. |
| 32 | Pruebas | `__tests__/*`, `jest.config.js`, scripts package | Unitarias, React, reglas emulador, build | `test:rules` carga reglas locales exactas | 30+ suites | IMPLEMENTADO. Falta E2E autenticado automatizado seguro. |
| 33 | Funciones Spark | `functions/index.js`, flags | Código legado no consumible en Spark | `CLOUD_FUNCTIONS_ENABLED=false`; no desplegar | `p02` | BLOQUEADO POR PLAN/COSTO; candidato a deprecación, no eliminación. |
| 34 | Mock/hardcode | Búsqueda estructural en `src` | Timers UI permitidos; PET Ahora no inicia por flag | No hay mocks en flujo canónico; quedan defaults/legacy | `p02`, `reservation-flow-p0` | PARCIAL/P2. Auditar copy y valores por pantalla. |
| 35 | Código muerto/duplicado | Componentes legacy, funciones PET Ahora, contexts antiguos | Sin consumidor o detrás de flags | No eliminar hasta confirmar historial/deploy | pruebas de duplicación | PARCIAL/P2. Crear inventario de importación antes de retirar. |

## Gate de aceptación autenticada

El estado `IMPLEMENTADO` describe código y reglas validados, no sustituye la prueba de sesión. Al 22-ago-2026 el Preview `dpl_3JNwSg2QR1khBRtFL9dvZ5RVjbRH` fue promovido por Vercel a Production `dpl_A4vWbKScmp1vFKa3RcV4UJX9nC6X`, detrás de `pet-euhz.vercel.app`. Las rutas públicas, redirecciones, bundles y SW están verificados; la aceptación de Familia, Admin y Walker permanece `BLOQUEADO` hasta takeover autenticado en Safari.

## Fuentes de verdad vigentes

| Dominio | Fuente |
|---|---|
| Identidad/rol | Firebase Auth UID + custom claim |
| Customer | `customerProfiles/{uid}` |
| Perro | `dogs/{dogId}` con `ownerId` |
| Dirección | `addresses/{addressId}` con `ownerId` |
| Catálogo/precio | definición estable en `walkServices.ts`; proyección versionada en `appSettings/servicePrices` |
| Compra/paquete | `serviceOrders/{id}` |
| Paseo individual | `walkSessions/{id}` |
| Dinero futuro | contratos F1; ninguna mutación runtime actual |

## Actualización focal 24-ago-2026 — reportes visibles

- `src/app/walker/page.tsx` conserva la consulta única `walkerId + scheduledDate + limit(100)` y ahora presenta hasta tres completados anteriores con su ruta determinista de reporte.
- `src/app/familia/historial/page.tsx` consume `CanonicalFamilyHistory`: `walkSessions` propias primero; `reservations` queda en una sección separada de solo lectura.
- `src/app/admin/reportes/page.tsx` mantiene `getDocs`, `orderBy(updatedAt desc)` y `limit(50)`; añade filtro local y reintento, sin listener ni mutación.
- Payload focal de seis archivos promovido desde Preview `dpl_BtJ3jk…` a Production `dpl_6b8g76…`; el alias estable quedó verificado y el Production anterior `dpl_Cy9SWv…` se conserva para rollback manual.

## Actualización G1 Production — 29-ago-2026

- `Gallery.tsx` consume exclusivamente `gallery-public`; `gallery-images` continúa siendo metadata administrativa privada.
- `/api/admin/gallery/signature` firma en servidor y responde `401` sin token; la autorización depende del custom claim Admin.
- Ruleset activo `92037591-177a-4f8f-a1b0-db4add3dcab4`, SHA `d4ea2e63cb7b1033f919b378f5dc9e35dc901dc8e3865402b4d363b1ed03a95d`; 12/12 índices `READY`.
- Production `dpl_sozWckpcWDftmUEqXpQv8DLB9zhV`; estado vacío público verificado sin exponer borradores ni usar credencial Firebase Admin persistente.

## Galería: frontera de compatibilidad legacy (31-ago-2026)

- `src/lib/media/galleryRecords.ts` es la frontera de lectura defensiva de `gallery-images`: unión discriminada `compatible | legacy | invalid` antes de renderizar o habilitar mutaciones.
- `AdminGalleryManager` consulta como máximo 50 documentos; solo `compatible` llega a edición/publicación/retiro. Legacy usa únicamente `title`/`dog` validados como texto y nunca renderiza ni enlaza su URL.
- El contrato observado `createdAt`, `dog`, `title`, `url` sin `format` se conserva sin migración ni escritura. Production: `dpl_3UKuaScTnkEhVy3c2Mc8MwZC75W7`.

## O1: shells y navegación canónica (1-sep-2026)

- `src/lib/navigation.ts` centraliza la coincidencia de ruta: una raíz de panel (`/admin`, `/familia`, `/walker`) solo queda activa por igualdad; las subrutas coinciden por segmento completo.
- `AppShell` continúa siendo la estructura compartida de Familia/Walker/Supervisor; `AdminShell` conserva su variante operativa y ahora agrupa destinos reales sin cambiar la autorización de layouts, claims o reglas.
- `AdminLayoutClient` es la fuente de navegación Admin; `/admin/reportes` es un consumidor existente, no una ruta inventada. `FamilyLayoutClient` usa navegación Next interna sin recarga completa.
- Production `dpl_Gzys5ZJwnN9Rta2dTZgktvCX11L1`; Preview origen `dpl_6PXCey3Swi3vULMFLT4cC18uw2gB`; rollback `dpl_3UKuaScTnkEhVy3c2Mc8MwZC75W7`.
