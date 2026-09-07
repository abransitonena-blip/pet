# AGENTS.md — Resumen del plan maestro y continuar

## Resumen del plan maestro de 17 fases

### Completado (pusheado)

- **Fase 1** (81669c0): hardening de config: single source `appSettings`, banner visible `appSettings`, errores de login diferenciados, reset de password.
- **Fase 2** (src/app/layout.tsx): contenedor base (modo light, contenedor, logo).
- **Fase 3** (e433cd1): tema claro único sin selector ni paneles oscuros, contraste AA:
  - Paleta maestra + 8 alias de tokens (`--color-primary`, `--color-primary-hover`, `--color-primary-light`, `--color-canvas`, `--color-ink`, `--color-muted`, `--color-border`, `--color-brand-soft`, `--color-trust`, `--color-trust-light`, `--color-danger`, `--color-success`, `--color-warning`, `--color-dark`, `--color-secondary`, `--color-accent`, `--color-dark-50`...)
  - Conversiones a light: AdminConfig, EditReservationModal, TermsModal, cancelar, AvailabilityCalendar, etc.
  - STATUS_COLORS y maps de estado a `-600/-700/-800`.
  - Contraste AA verificado numéricamente (textos naranjas → `#9F3D00`, badges → `-600/-700/-800`, danger → rojo-700, etc.).
  - Bug `danger` (botones Eliminar/errores invisibles) → alias de `error` añadido.
  - tsc/jest/build limpios.

- **Fase 4** (30f290d): rediseño de logo — huella canina en gradiente primary:
  - `src/components/ui/Logo.tsx`: exporta `PawMark` + `Logo` (bg-gradient-to-br from-primary-500 to-primary-700, rounded-xl, PawMark size*0.58, fill #FFF8F1).
  - Iconos PWA: `public/icons/icon-512.svg` e `icon-192.svg` (huella white sobre gradiente primary, círculo decorativo 6% opacidad, sin rx en el rect grande de 512).
  - `public/manifest.json`: background_color → `#FFF8F1` (theme_color `#C45100`), name/short_name intactos.
  - OG image (`src/app/opengraph-image.tsx`): fondo `#FFF8F1`, barra accent `#C45100`, título `#172033`, subtítulo `#5D6778`, CTAs "Entrar a Familia PET" (primary) + "Conoce cómo funciona" (trust), paw (🐾) 120px bottom-right.
  - Tokens: `--color-primary-hover` → `#9f3d00` (AA en canvas), `canvas #fff8f1`, `ink #172033`, `muted #5D6778`, `border #808897`.
  - Header (`src/components/Header.tsx`): motion.div whileHover={{scale:1.05}} envuelve <Logo size={36} />, wordmark "PET Ap" intacto.
  - Login (`src/app/login/page.tsx:334`): botón de logo <Logo size={56} rounded="rounded-2xl" shadow-glow>.
  - Familia (`src/app/familia/layout.tsx:80-81`): <Logo size={36} /> en lugar del anterior gradient-from-brand-500 to-brand-600 con Dog.
  - Admin (`src/app/admin/layout.tsx:99-100/194-195`): <Logo size={36} /> en lugar del anterior gradient-from-brand-500 to-brand-600 con Dog.
  - Terminos (`src/app/terminos/page.tsx:17-19`): <Logo size={48} rounded="rounded-2xl" /> en lugar del anterior gradient-from-primary to-amber-600 con Dog 24.
  - Not-found (`src/app/not-found.tsx`): CTA limpio "Ir a Familia PET" + <Logo size={36} />.
  - Consistencia visual: Header CTA "Entrar a Familia PET" (ya en-Header). Ejemplos de navigation: WalletCard, NotificationBell, StepContact, etc. ya usan <Logo> o routes `/familia` `/walker`.
  - WalkSessionModal: inline logo actual (Green gradient from-success-500 to-success-600 + Dog) mantenido (walker identidad).
  - Linter: `eslint` instalado con plugin de auto-reparación, tsconfig actualizado para reglas de lint.

- **Fase 5** (e558057): login Familia-first con rutas `/familia` y `/walker`:
  - Renames: `git mv mi-cuenta` → `familia` y `paseador` → `walker` (18 renames); next.config redirects 308.
  - middleware: `/familia: [client, admin, walker]`, `/walker: [walker]` + legacy `/mi-cuenta`, `/paseador`; `AUTH_PATHS` ampliado.
  - Login: mode default `'familia'`, ROLE_HOME (`admin:/admin`, `walker:/walker`, `client:/familia`), getSafeRedirect + resolveDestination (prefijos permitidos).
  - UI login: GoogleMark SVG, fallback `signInWithPopup`, GIS error → botón de respaldo "Continuar con Google".
  - FinalizarGoogle: asegura customerProfile, lee `users/{uid}.role`, ruta por rol.
  - Links en Header (WalletCard, NotificationBell, StepContact, etc.) ahora usan `/familia` `/walker`.
  - familia/layout: label "Mi cuenta" → "Familia PET".
  - .next stale tras renames → borrado antes de tsc/jest/build.

- **QuoteForm** (6e2fbf3): eliminado de la landing pública (`src/app/page.tsx`, Header, Hero, Services, not-found) → CTA claro y estilizado hacia `familia/nueva-reserva`.

- **Fase 6** (bd7034a): presencia offline sync:
  - `/api/presence-offline/route.ts`: Bearer token auth, validación de rol walker, backed por buffer local `presenceOffline`, writeBatch a `presenceHistory`, marca como `processed: true` tras sync.

- **robots.txt** (`src/app/robots.txt`):
  - Disallow: `/paseador`, `/mi-cuenta`
  - Allow: `/*/familia`, `/*/walker`, `/*/admin`

- **sitemap.xml** (`src/app/sitemap.xml`):
  - 14 URLs con lastmod (update) y priority (0.9 admin/familia/walker, 0.8 resto)

- **P1** (a3824f2): Eliminar sección RESERVA residual de landing page; cambiar CTA a "Solicitar paseo".
- **P2** (a3824f2): Cambiar fuente de Inter a Manrope.
- **P3-P9** (fc21af7, e0c4f3f, a3dd618): Touch targets ≥44px, admin sidebar w-56 on mobile, text-xs→text-sm, responsive typography, aria-live on toasts/banners, focus-visible on all interactive elements, reduced motion support.
- **P10** (2040d65): Normalizar data model — remove `orderId` from reservations, rename `clients`→`customerProfiles`, `client` field→`customer`.
- **P11** (4b09a0a): Fix walker search by name→UID — remove legacy `assignedWalker` name queries, use `assignment.walkerId` only.
- **P12** (ddd7c96): Create AppShell shared layout — Familia and Walker now use shared AppShell component.
- **P13** (475a90a): Create MediaProvider abstraction — Cloudinary provider with upload, delete, getUrl, list.
- **P14** (f104e0c): Add supervisor role to middleware, admin layout, and login page.
- **P15** (9ef6d52): Rename Firestore collections (`clients`→`customerProfiles`, `pets`→`dogs`) and fields (`client`→`customer`).
- **P16.1** (ccff40d): Fix RESERVA hero bug; Cloud Functions actualizados (clients→customerProfiles, client→customer); script de migración con dry-run/verify/resume/idempotencia.
- **P16.2** (f2e45cf): Google Auth — duplicados de "Volver" eliminados, `ensureCustomerProfile` → `customerProfiles`, fallback GIS.
- **P16.3** (2c05d21): `scripts/migrate-collections.js` con dry-run, verify, backup, rollback y migración gradual (sin ejecutar contra prod).
- **P16.4** (ce06deb): Rediseño de reservas Familia — flujo 6 pasos `reservation-steps-v2/` (compañero → dirección → momento → servicio → paseador → confirmar) con auto-search, rebooking rápido (`?repeat=`) y draft local.
- **P16.5** (e78c8c1): Shell admin compartido + librería de UI:
  - `src/components/layout/AdminShell.tsx` (sidebar colapsable, drawer móvil, logout, footer de versión); `src/app/admin/layout.tsx` refactorizado.
  - Librería `src/components/ui/`: PageHeader (title/description/icon/actions), SectionHeader, DataCard, StatusBadge (normaliza vía `STATUS_LABELS`/`LEGACY_STATUS_MAP` de `sessionMachine.ts`), EmptyState, LoadingState, ErrorState, FormField, ConfirmDialog, BottomSheet, Money, DateTime, EntityAvatar.
  - Brand config admin (`Diseño y marca`): `src/lib/brandPresets.ts` (presets primary/font/radius/motion, `derivePalette` hex→canales 50-900, `applyBrandPreset` setea CSS vars), `src/context/BrandContext.tsx` (draft/preview/publish/revert en `appSettings/public.brand`), `src/components/AdminBrandConfig.tsx`.
  - Tailwind: escalas `primary`/`brand` ahora `rgb(var(--brand-xxx) / <alpha-value>)`; tokens `--brand-50..900`, `--radius-control/button/card/panel/sheet/pill`.
  - `eslint.config.js` reparado (flat config con typescript-eslint/react/react-hooks/react-refresh; `react-hooks/set-state-in-effect` off).
- **P16.5c** (78601a1): Migración de páginas admin restantes a componentes compartidos (PageHeader/LoadingState/EmptyState/DataCard) + limpieza de imports muertos en admin.
- **P16.6** (400fe75): Radius tokens conectados a Tailwind (`rounded-lg/xl/2xl/3xl/4xl` → `--radius-button/card/panel/sheet`); consent banner compacto (`ConsentProvider.tsx` con link a /privacidad); touch targets 44px en botones de cierre de modales (WalkSessionModal, EditReservationModal, PetAhoraPhotoModal).
- **P0.8** (no pusheado): roles/claims de autoridad — `normalizeRole` (`client`→`customer`), `setUserRole`/`getUserRole` por claims, renovación de token (`refreshTokenAndGetRole`), gate middleware/layout, reglas Firestore propuestas, Cloud Functions autorizan por claims, `serverAuth.ts` para presence-offline. 15 casos de prueba (42 tests).
- **P1 (en curso, no pusheado)**: capa de compatibilidad de esquemas read-only — `CustomerRepository`/`DogRepository`/`ReservationRepository` con fallback new→legacy y **cero escrituras** (verificado por tests). `scripts/migrate-collections.js` reescrito como `--verify-only` puro (sin commander ni Firebase, `node` stdlib, protección `--project production`, reporte JSON en `artifacts/`). Fixtures sanitizados en `scripts/fixtures/`. 37 tests nuevos (20 repos + 10 script + 7 customerProfile).
- **Deuda de lint (limpia, no pusheado)**: `npm run lint` reparado para Next 16 (eslint flat config vía `eslint .`). Lint repo-wide **0 errores** tras quitar imports muertos (login, TeamLoginForm, presence-offline), disable directives redundantes en 6 páginas App Router, y override `react-refresh/only-export-components` para `src/app/**`.
- **Refactor `services.ts` → `walkServices.ts` (Fase 15+, no pusheado)**: `git mv` preserva historial; imports actualizados en 9 archivos (`PricesContext`, `EditReservationModal`, `Services`, `StepV2Service`, `submitReservation`, 4 páginas admin) + test renombrado `walkServices.test.ts` + comentario en `scheduling.ts`.
- **Fase 15+ reglas/índices (no pusheado)**: `firestore.rules` y mirror `src/lib/rules.ts` ya alineados con renames (match blocks `customerProfiles`/`dogs`/`reservations` con `customer`; sin colecciones legacy). Fix real: `functions/index.js` usaba `.where('client.uid', ...)` (legacy) en el límite diario → `customer.uid` (el chequeo nunca disparaba); etiqueta de auditoría `role: 'client'` → `'customer'`. `firestore.indexes.json`: índice legacy `assignedWalker` eliminado (P11: solo filtros en memoria); añadidos compuestos requeridos por queries actuales: (`phone`+`createdAt` desc, admin/reservas), (`uid`+`status`, familia/eligibility), (`date`+`status`, AvailabilityCalendar), (`customer.uid`+`date`+`status`, límite diario) y (`customer.uid`+`date`+`time`+`status`, duplicados). Validado: typecheck ✅, lint 0 errores ✅, 151/151 tests ✅, build ✅. Sin publicar (restricción).
- **Deploy a producción `pet-1cb0b` (2026-08-07, hecho en consola, no pusheado a Git)**:
  - Migración real ejecutada con `node scripts/migrate-prod.js --project pet-1cb0b --backups-dir backups/renames --execute --yes`: `clients`→`customerProfiles` (2 fuentes, targets ya existían → 0 escritos), `pets`→`dogs` (2 escritos, p. ej. `0acAa9npd8alNATeDzbq`), `reservations.client`→`customer` (2 reescritos con `customer.uid` preservando `uid` top-level). Fuentes legacy no borradas. Backups en `backups/renames/2026-08-07_13-00-57/` + `firebase-adc.json` (NO subir a Git) + reporte `artifacts/migrate-prod-report.json`.
  - `firebase deploy --only firestore:indexes` ✅ y `--only firestore:rules` ✅ (reglas P0.8 publicadas; orden seguro: migración → índices → reglas).
  - `vercel --prod` ✅ hosting en `https://pet-euhz.vercel.app` (preview `-abraham9`).
  - **Cloud Functions NO desplegadas**: Cloud Functions (1ª y 2ª gen) **requiere el plan Blaze** — Cloud Build + Artifact Registry son servicios de pago que no se pueden habilitar en Spark (confirmado en docs oficiales y bloqueado en TODAS las versiones de firebase-tools v9→v15, no es un flag de CLI). El usuario rechazó subir a Blaze y rechazó migrar a Vercel. **Decisión: quedarse en Spark sin Cloud Functions.** El fix `client.uid`→`customer.uid` de `functions/index.js` queda listo para desplegar si algún día se sube a Blaze. Consecuencia: sin push FCM por triggers, sin jobs programados, sin callables privilegiados en prod.

### Próximos pendientes

1. ~~**Migración prod**~~ ✅ ejecutada contra `pet-1cb0b` (2026-08-07) con `scripts/migrate-prod.js --execute --yes`; backups + reporte generados.
2. ~~**Deploy reglas/índices**~~ ✅ `firebase deploy --only firestore:rules,firestore:indexes` a `pet-1cb0b`.
3. ~~**Hosting**~~ ✅ `vercel --prod` (pet-euhz).
4. ~~**Deploy functions**~~ ❌ bloqueado por plan: Cloud Functions requiere Blaze; el usuario decidió quedarse en Spark sin functions.
5. **Pendiente**: push a Git de los cambios no commiteados (rules, indexes, functions fix, scripts, AGENTS.md) cuando el usuario lo pida.

### Nuevo dominio en roadmap — Caja, finanzas, tickets e impresión

- **F0 (2026-08-08, solo arquitectura local):** inventario y propuesta documentados en `FINANCIAL_ARCHITECTURE_F0.md`. No se crearon colecciones, pagos, tickets, folios, cierres, liquidaciones ni integración Bluetooth.
- **F1 (2026-08-08, contratos puros locales):** módulo aislado en `src/lib/finance/domain/` con Money en centavos/MXN, pricing y snapshots explícitos, pagos/allocations/reembolsos, ledger inmutable por contrato, caja/liquidaciones/gastos, tickets internos, capacidades, idempotencia y errores tipados. Sin Firebase, backend, pantallas, colecciones, folios persistentes, impresión o Bluetooth. Pruebas puras en `__tests__/f01-financial-domain.test.ts`.
- Flujo objetivo sujeto a validación: `serviceOrder → walkSession → payment → financialMovement → ticket → cashClosing / walkerSettlement`.
- `walkSessions` continúa como fuente canónica del paseo; no crear un modelo `Walk` duplicado.
- Principios obligatorios: centavos enteros, moneda MXN explícita, ledger inmutable, correcciones compensatorias, snapshots, idempotencia y backend privilegiado.
- Créditos PET/lealtad permanecen promocionales y separados del efectivo.
- Roadmap F1–F10: contratos y decisiones; claims/capacidades CAJA; backend; pagos/ledger; precios/promociones; caja/gastos; liquidaciones; tickets/folios; ESC/POS/Bluetooth; piloto controlado.
- **F2 no iniciado:** requiere autorización expresa; continúan pendientes la integración de claims/capacidades y cualquier backend o persistencia financiera.
- **Recuperación read-only de tarifas (2026-08-22):** Production no contiene `admin/prices` ni `appSettings/servicePrices`. Git conserva varias listas incompatibles; `67b2312` (10-jul-2026, mensaje “precios finales”) es evidencia histórica, no aprobación comercial vigente. Dos `serviceOrders` legacy/canónicas consultadas sin datos personales contienen `Paseo Extendido total=60` y `Paseo + Adiestramiento total=0`; el segundo es inválido y ninguno sustituye la confirmación del propietario. No sembrar ni guardar precios automáticamente.
- **Fases A/B posteriores al deploy (2026-08-08, local):** rutas públicas y redirecciones verificadas sin credenciales ni escrituras. El service worker usa actualización controlada, no cachea navegación/manifiesto/paneles/APIs, limpia únicamente cachés propiedad de PET Ap y ofrece aviso accesible de nueva versión. Pendiente publicar: el deploy activo todavía sirve `pet-v2-static` y robots/sitemap apuntan a localhost.
- **Epic futuro PET Ap Assistant (solo documentación):** arquitectura, dependencias, riesgos y fases A1–A12 registrados en la sección 15 de `FINANCIAL_ARCHITECTURE_F0.md`. No crear `/admin/assistant`, código, colecciones, endpoints ni dependencias de IA. A1 está bloqueado hasta autorización expresa del propietario y hasta completar y probar los módulos operativos/financieros indicados (F2–F10). El MVP previsto comienza con parser determinístico gratuito; cualquier proveedor de IA será opcional. Solo `admin` tendrá acceso inicial mediante claims y capabilities; no introducir `OWNER` dentro de este epic.

## Continuar

- Probar `/api/presence-offline`, `/api/version`.
- Si en el futuro se quiere functions: `firebase deploy --only functions` tras subir a Blaze (fix `customer.uid` ya en `functions/index.js`).
- Mantener AGENTS.md actualizado tras cada fase.

## Plantilla para siguientes fases

```markdown
### Fase X (commit <hash>): <título>

#### Completado (pusheado)
- <lista de cambios>
- <archivos relevantes>

#### Activo
- <tareas pendientes>

#### Bloqueado
- <bloqueadores>

#### Próximos pasos
- <acciones]
```

---

`Agentes continuadores`: cada vez que un miembro del equipo abre este AGENTS.md, copia la sección "Continuar", ejecuta las acciones, actualiza los hits, agrega nuevas tareas y crea el próximo bloque.

---

Notar: -- Ejemplo de `scripts/check-forbidden.mjs` bloquea tokens legacy "Quebrada". -- `npm run lint` roto en Next 16 → usar `npx eslint <files>`. -- Comandos de CI que pasan: `npm run typecheck`, `npm run test`, `npm run build`.

## Continuidad actual — reportes canónicos (24-ago-2026)

- Ruleset activo: `b1998c37-9e7f-4cba-8c45-f133cae16b18`, SHA `3c84a994dbbc0e7eb6fd3c977c9577eab765a7377b52cd542e91a75ae03f0792`; corrige el `get` puntual de un reporte inexistente sin ampliar `list` ni escrituras.
- Runtime publicado activa `WALK_REPORTS_ENABLED`; Familia/Admin leen una vez, Walker escucha solo en su editor y el guardado bloquea doble envío.
- Medios privados y campos financieros continúan fuera del contrato v1.
- Preview focal validado: `dpl_BtJ3jkPWcpud5jyqy4poEomwrF9G`; Production: `dpl_6b8g76T6mRrfTAVQaTcHoj7RxCLF`; rollback inmediato: `dpl_Cy9SWvTJhHvJ5amrUytCFTwoJrLP`.
- Runtime publicado: Walker muestra completados anteriores con acceso al reporte; Familia prioriza historial canónico y Admin filtra/reintenta su consulta limitada a 50.
- Siguiente gate: QA autenticada manual draft → submit → lectura Familia/Admin usando una sesión completada existente; no crear fixtures ni sesiones ficticias.

## Continuidad actual — tickets T1 (25-ago-2026)

- Implementación local: snapshot temporal `internal-receipt`, `isCfdi: false`, dinero nullable, ESC/POS 58 mm/CP850/logo/QR, `MockPrinterTransport`, `ManualHexTransport` y `/admin/printing/test` solo Admin.
- La herramienta es read-only: máximo 50 sesiones, lecturas puntuales de reporte/perfiles, cero escritura Firestore, cero persistencia financiera y cero impresión automática.
- Gates locales: typecheck/lint PASS, 411/411 suite, 19/19 T1, 11/11 emulador focal, build 52/52; 21 divergencias históricas del emulador general permanecen documentadas.
- Codex Security aislado `e166a311-7feb-466e-9b6a-deafd2ffe653`: 0 hallazgos; payload runtime exacto de 12 archivos basado en Production `dpl_6b8g76T6mRrfTAVQaTcHoj7RxCLF`.
- Publicación T1: Preview `dpl_9vw2GBGfTzpcTDNp6Xt73v3nBL4C` y Production derivado `dpl_EC8yYszuaGVHozxPix8oqDiu5uHB`, ambos `READY`; `pet-euhz.vercel.app` apunta al Production nuevo. Rollback manual conservado: `dpl_6b8g76T6mRrfTAVQaTcHoj7RxCLF`.
- QA pública: rutas y redirecciones correctas, consola/logs sin errores, `pet-ap-static-v3` no cachea paneles privados. Fixture determinista: 982 bytes (1964 caracteres HEX).
- Firebase no cambió: ruleset `b1998c37-9e7f-4cba-8c45-f133cae16b18`, SHA `3c84a994dbbc0e7eb6fd3c977c9577eab765a7377b52cd542e91a75ae03f0792`, 12/12 índices `READY`, facturación desactivada.
- Pendiente paralelo: aceptación manual del reporte canónico. Pendiente T1: prueba física con nRF Connect.

## Continuidad actual — tickets T2 (25-ago-2026)

- Modelo local implementado: `tickets/{walkSessionId}` inmutable y `tickets/{walkSessionId}/printEvents/{eventId}` append-only. ID y folios deterministas `TKT-{walkSessionId}` / `PET-{walkSessionId}`; recibo interno, nunca CFDI.
- Creación: solo Admin, sesión `completed`, reporte `submitted`, relaciones coherentes y todos los importes `null` con `paymentStatus: not_recorded`. Reintento idéntico devuelve el ticket existente; payload distinto produce conflicto.
- Lectura: Admin/Supervisor con listado máximo 50; Customer propietario y Walker activo asignado solo por `get` puntual. Ningún navegador actualiza o elimina tickets; solo Admin registra eventos de exportación/confirmación manual.
- Ruleset T2 publicado: `0a64444e-b676-4112-a616-bddd48803b58`, SHA `d079c7cd16f65cd14ce48812af69250d7025b614f5396d869f718514de3db6a0`; 12/12 índices `READY`; facturación desactivada.
- Gates: 418/418 suite, T2 unit/runtime 26/26, emulador focal 5/5, build autoritativo 53/53, Codex Security `e0023165-ea85-40ec-bab2-37201420ad61` sin hallazgos. Las 21 divergencias históricas del emulador general siguen como deuda conocida.
- Payload Vercel aislado: `/private/tmp/pet-t2-runtime.5b8qnL`, 17 archivos runtime, manifiesto SHA `7f42f6e0ff2384a3a9c937f77b30ebbb1880047ba048574d5a22bb97c9a51ff8`.
- Publicación T2: Preview `dpl_2crB4nhkxNhuXTMFeorCMncu1NDn` y Production derivado `dpl_8pSTBxrkeUjRrz8KtA32ccU4DK45`, ambos `READY`; alias `pet-euhz.vercel.app` confirmado. Rollback manual: `dpl_EC8yYszuaGVHozxPix8oqDiu5uHB`.
- No se creó ningún ticket ni evento real. Siguiente gate: creación manual Admin de un ticket para una sesión completada con reporte enviado y prueba de exportación/reimpresión.

## Aceptación autenticada T2 — 26-ago-2026

- Sesión canónica completada `CXlmRT…Q1Ph`: reporte `submitted`, relaciones coherentes y ticket determinista creado una sola vez desde Admin.
- Ticket `CXlmRT…Q1Ph`, folio abreviado `TKT-CXlmRT…Q1Ph`: contrato exacto, `paymentStatus: not_recorded`, siete campos monetarios/método en `null` y cero duplicados.
- Existe un único evento inmutable `payload_exported`, original de 982 bytes, hash `53339c8153e55ce8a2084bd5d251d657207288dce183bedf6afe3b8710e721f9`; no existe `operator_confirmed`.
- Mejora visual local posterior: perrito geométrico PET Ap compartido por vista térmica y raster ESC/POS; estados de ticket/evento dejan de usar el fallback “Pendiente (legacy)”. Gates locales: typecheck/lint PASS, 26/26 focales, 418/418 suite y build 53/53.
- Pendiente antes de publicar el rediseño: Preview aislado y autorización de Production. Pendiente de aceptación física: pegar el HEX en nRF Connect y confirmar el papel antes de registrar `operator_confirmed`.

## Continuidad actual — R1/G1 (28-ago-2026)

- T2 físico PASS: un único evento `operator_confirmed` idempotente para `CXlmRT…Q1Ph`; ticket/reporte intactos y cero pagos/movimientos.
- R1/G1 están implementados localmente: reserva de cuatro pasos con slots configurables y galería con carga firmada Admin/proyección pública server-only.
- Gates finales locales: typecheck/lint PASS, 425/425, emulador focal 7/7, build 54/54 y Security `cb5d9d56-cf6f-45dd-9c02-dddd42fa65e1` sin hallazgos.
- R1 completo publicado después de la captura humana de agenda: Preview `dpl_BYkSs7ZwakvavjVkUXc6ZLwGncVJ`, Production `dpl_AXch6xnpxekrUzLGWRr5bgR2CyPT`, rollback `dpl_4ZWAgtnBecnsj6oiqfW9BvZL9Z4p`; ruleset `ef451527-a4c1-4926-b8af-0f6ec441ecd4` (SHA `8634a6ea…`). Pendiente QA autenticada de Familia sin enviar reserva.
- G1 usa Cloudinary firmado y una proyección pública mínima `gallery-public`; el endpoint verifica el ID token sin credencial Firestore/Firebase Admin persistente. La cuenta vacía `pet-ap-gallery-reader` fue eliminada. Preview aislado `dpl_5wSFT34V7p7ojeRaK4ewf1eKAgkC` está `READY`; build 54/54, endpoint sin token `401` y Security `140a88e8-6e3b-49d3-a0da-2bdd52cbe311` sin hallazgos. Sigue pendiente autorización separada para publicar el candidato local de reglas; no promover a Production antes de ese gate.

## Cierre G1 — 29-ago-2026

- Ruleset G1 activo: `92037591-177a-4f8f-a1b0-db4add3dcab4`, SHA `d4ea2e63cb7b1033f919b378f5dc9e35dc901dc8e3865402b4d363b1ed03a95d`; 12/12 índices `READY` y facturación desactivada.
- Production G1: `dpl_sozWckpcWDftmUEqXpQv8DLB9zhV`, derivado del Preview `dpl_5wSFT34V7p7ojeRaK4ewf1eKAgkC`; `pet-euhz.vercel.app` apunta al nuevo Production.
- Build remoto 54/54; rutas, redirects, firma anónima `401`, logs, SW y QA 390/430/768/1024/1440 PASS. No se subió ninguna imagen ni se escribió metadata.
- R1 de cuatro pasos ya forma parte de esta baseline y no cambió durante el cierre G1; sigue pendiente QA autenticada de Familia sin enviar reserva.

## Cierre de compatibilidad legacy G1 — 31-ago-2026

- Causa real: un documento `gallery-images` anterior conserva `createdAt`, `dog`, `title` y `url`, pero no `format`; la UI anterior ejecutaba `format.toUpperCase()` sin validar y cerraba `/admin/galeria`.
- `galleryRecords.ts` clasifica cada lectura como G1 compatible, legacy observado o inválido. Solo los compatibles conservan acciones; legacy se muestra como “Registro anterior — pendiente de migración” y los inválidos se aíslan por registro.
- No se modificó, migró ni eliminó el documento real; no hubo uploads ni escrituras Firestore. Tests 8/8 focales, suite 430/430, typecheck/lint y build 54/54 PASS.
- Security diff `f4aef74b-582a-43f0-bf80-f5dcc13bef8e`: dos archivos, cobertura completa y cero hallazgos.
- Preview `dpl_CnSHPZuma1UdcdcWGGu9dSmFM3ow`; Production `dpl_3UKuaScTnkEhVy3c2Mc8MwZC75W7`; rollback `dpl_sozWckpcWDftmUEqXpQv8DLB9zhV`; alias `pet-euhz.vercel.app` confirmado.
- Pendiente únicamente la observación autenticada final del registro legacy en el dominio estable; no usar esa prueba para realizar acciones de escritura.

## Continuidad para OpenCode — O1 publicado (1-sep-2026)

- Production activa: `dpl_Gzys5ZJwnN9Rta2dTZgktvCX11L1` (`READY`), promovida desde Preview `dpl_6PXCey3Swi3vULMFLT4cC18uw2gB`; alias `pet-euhz.vercel.app` confirmado. Rollback manual: `dpl_3UKuaScTnkEhVy3c2Mc8MwZC75W7`.
- O1 unifica el comportamiento de navegación compartida: coincidencia de ruta única, grupos operativos Admin, drawer móvil con Escape/cierre explícito, enlaces internos con `Link`, objetivos táctiles de 44 px, foco visible y `prefers-reduced-motion`.
- Payload aislado: siete archivos runtime; manifiesto SHA-256 `f43e7b4a9eb2c4cc7190914c5e4ae99765d9e2e5dd5606a6b2caa3e75b017fa8`. Security diff `cb61738a-138b-468b-829e-be2ae3456d01`: cobertura 7/7, cero hallazgos.
- Gates: typecheck/lint PASS, 11/11 focales, 434/434 suite, build/prerender 54/54, rutas/redirecciones/SW/logs/consola PASS y cero overflow/controles menores de 44 px en 390/430/768/1024/1440.
- Firestore no cambió: ruleset `92037591-177a-4f8f-a1b0-db4add3dcab4`, SHA `d4ea2e63cb7b1033f919b378f5dc9e35dc901dc8e3865402b4d363b1ed03a95d`, índices 12/12 `READY`, facturación desactivada.
- Deuda preexistente: la suite histórica amplia de reglas conserva 18 divergencias en la ejecución actual; los conjuntos focales O1/onboarding/tickets pasan. No modificar reglas para ocultarlas.
- Siguiente fase: T3 backend privilegiado. Antes de cualquier mutación financiera debe resolverse una identidad server-only verificable en Vercel (OIDC/federación preferida o credencial autorizada), idempotencia persistente, auditoría y rate limiting. Sin IAM/secreto aprobado, solo preparar contratos, endpoints fail-closed y pruebas; no pagos ni ledger reales.
- OpenCode debe partir del repositorio PET-ORN actual, preservar el worktree sucio, no hacer `reset/restore/checkout`, no publicar desde el árbol completo y comparar cada payload con `dpl_Gzys5ZJwnN9Rta2dTZgktvCX11L1`.

## Verificación de continuidad — G1/O1 (7-sep-2026)

- CONTEXTO.md describía el cierre legacy G1 como roto (typecheck/lint FAIL); verificación directa del código y gates mostró que ya estaba cerrado (coincide con la entrada "Cierre de compatibilidad legacy G1 — 31-ago-2026" de este archivo). Se corrigió CONTEXTO.md para reflejar el estado real; no se modificó código de producto.
- Gates re-ejecutados: typecheck/lint PASS, 442/442 suite, focales `g1-gallery-*` 8/8, build 54/54, `git diff --check` limpio, secret scan sin hallazgos en los 4 archivos G1.
- Confirmado vía Vercel CLI autenticado (`vercel whoami` → `abransitonena-5407`) que el alias `pet-euhz.vercel.app` apunta a `dpl_Gzys5ZJwnN9Rta2dTZgktvCX11L1` (creado 1-sep-2026, el mismo deployment O1 documentado arriba). No se creó ningún deployment nuevo: no hacía falta, G1 ya vive en ese Production porque O1 se publicó encima sin revertirlo.
- Smoke test sin credenciales: `GET https://pet-euhz.vercel.app/admin/galeria` → `307` a `/equipo` (login), sin error 500.
- No se tocó Firestore, no hubo escrituras, no se subieron imágenes, no hubo commit/push.
- Siguiente fase concreta: T3 backend privilegiado.

## Verificación de continuidad — MP-001/MP-002 (7-sep-2026)

- `documentacion/08-mejoras-pendientes.md` marcaba MP-001 (zona inválida rompe el batch de reserva) como "en progreso". Verificación directa del código mostró que ya está resuelto: `ReservationFlow.tsx`/`StepV2Address.tsx` deshabilitan direcciones con zona inactiva y explican el problema, `validateAddressBeforeConfirmation` revalida antes de Confirmar, y `submitReservation.ts` revalida contra Firestore y falla con `BOOKING_ZONE_UNAVAILABLE` antes de construir cualquier referencia o `writeBatch`.
- MP-002 (selector de zona en direcciones) también verificado resuelto: `<select>` poblado solo con `zones` activas, sin texto libre, `required`.
- Evidencia: `__tests__/reservation-flow-p0.test.tsx`, 18/18 focal PASS (incluye "una zona desactivada falla antes de crear IDs, referencias o batches", que confirma `mockWriteBatch` nunca se invoca).
- No se modificó código de producto; solo se corrigió el estado documentado en `documentacion/08-mejoras-pendientes.md`.
- No se desplegó nada nuevo para esto: ya vive en el mismo Preview `dpl_5Z7Zom7noWC8TykNVGvH5kZ1NxPQ` publicado junto con el commit de consolidación (rama `backup/pre-auth-ui-migration-2026-08-05`, commit `a117aa8`).

## T3 — Workload Identity Federation (7-sep-2026)

- Bloqueador `T3-001` resuelto: identidad server-only vía OIDC Vercel → GCP (decisión del propietario), sin secreto de larga vida almacenado en ningún lado.
- GCP (`pet-1cb0b`): pool `vercel` + provider `vercel-provider`; service account `vercel-t3-finance@pet-1cb0b.iam.gserviceaccount.com` con solo `roles/datastore.user`; impersonación restringida a `principal://.../workloadIdentityPools/vercel/subject/owner:abraham9:project:pet-euhz:environment:production` — un único proyecto y ambiente, verificado con `gcloud iam service-accounts get-iam-policy`.
- Vercel: variables `GCP_PROJECT_ID/PROJECT_NUMBER/SERVICE_ACCOUNT_EMAIL/WORKLOAD_IDENTITY_POOL_ID/WORKLOAD_IDENTITY_POOL_PROVIDER_ID/AUDIENCE` en Production únicamente.
- Código: `src/lib/finance/serverFirestore.ts` (`@google-cloud/firestore` + `ExternalAccountClient` de `google-auth-library` + `@vercel/oidc`; falla cerrado sin variables) y `src/app/api/admin/finance/t3-identity-check/route.ts` (Admin-only, idempotente vía `src/lib/finance/domain/idempotency.ts`, escribe solo `financeAudit`).
- Gates: typecheck/lint PASS, 457/457 suite (5 nuevas focales en `__tests__/t3-identity-check.test.ts`), build 55/55.
- Preview `dpl_3pAwfKyxE2LEvGadwnhWPVnPtDBx`: sin token `401`, token inválido `403`. El intercambio OIDC real (camino feliz) solo es verificable en Production por el diseño restringido a `environment:production`; queda pendiente esa verificación autenticada post-promoción.
- Cero pagos, ledger, comisiones o precios creados. No inventado ningún contrato financiero — sigue pendiente autorización de negocio explícita para T3 más allá de esta plomería de identidad.
- Commit: `1589235` (rama `backup/pre-auth-ui-migration-2026-08-05`). No se hizo push ni promoción a Production en ese momento.

## Producción T3 y consolidación (7-sep-2026)

- El usuario promovió manualmente a Production (`vercel deploy --prod`, tras el bloqueo del clasificador de permisos para acciones de este tipo). Production actual: `dpl_3sqzwmJt6Hizs7Cm8VEjsVKqedrC`. Smoke test en vivo: `/` 200, `/admin/galeria` 307 a login, `/robots.txt` 200, `/api/admin/finance/t3-identity-check` sin token → 401 (confirmado en Production real).

## F2-F4, M1, N1 — plomería fail-closed (7-sep-2026)

- Decisión del propietario: construir F2-F4/M1/N1 como plomería real (sin invertir cifras ni contenido) detrás de feature flags apagados.
- **F2/F3**: `POST /api/admin/finance/payments` (registro, monto/método del Admin) y `POST /api/admin/finance/payments/confirm` (único camino a un movimiento de ledger, deriva el monto del pago ya registrado, transacción atómica). Flag nuevo `FINANCE_PAYMENTS_ENABLED` (false).
- **F4**: `GET /api/admin/finance/tickets/{sessionId}/financial-snapshot`, solo lectura; T2 (`src/lib/tickets.ts`) sin tocar, tickets siguen inmutables.
- **M1**: `POST /api/media/private/signature`, Cloudinary `type=authenticated`, Walker solo firma para su sesión asignada (verificado server-side), `public_id` opaco. Flag `PRIVATE_MEDIA_UPLOADS_ENABLED` sigue false.
- **N1**: `POST /api/admin/notifications/send`, FCM HTTP v1 vía identidad T3 (ampliado con `roles/firebasecloudmessaging.admin`, mismo alcance restringido). No requiere Cloud Functions/Blaze. Flag `FCM_ENABLED` sigue false; falta el registro cliente de tokens.
- Identidad compartida refactorizada a `src/lib/finance/serverIdentity.ts`.
- Gates acumulados: typecheck/lint PASS, 484/484 suite, build 59/59, 6 commits separados (uno por fase) en `backup/pre-auth-ui-migration-2026-08-05`.
- Cero dinero movido, cero notificaciones enviadas, cero contenido inventado. Pendiente: decisión de negocio para activar flags + QA manual antes de cualquier uso real.
