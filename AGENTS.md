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

### Próximos pendientes

1. **Migración prod**: ejecutar `node scripts/migrate-collections.js` contra `pet-1cb0b` (requiere confirmación explícita del usuario). Backups + rollback disponibles.
2. **Deuda de lint repo-wide**: ~111 errores pre-existentes en código no tocado (mayormente `no-explicit-any` y unused vars). `src/app/admin` y `src/components/ui` quedaron limpios.
3. **CI**: `npm run lint` (`next lint`) está roto en Next 16 ("Unknown options: useEslintrc...") → usar `npx eslint <files>` o `npx eslint src` (cuenta de errores pre-existentes). `npm run typecheck` (tsc --noEmit), `npm run test` (jest, 59/59) y `npm run build` pasan.
4. **Fase 15+**: actualizar reglas de seguridad / índices de Firestore tras renames; refactorizar `services.ts` → `walkServices.ts` si aplica.

## Continuar

- Ejecutar migración prod con `node scripts/migrate-collections.js --backups-dir ./backups/renames/$(date +%F_%H-%M-%S) --renames '[{"from":"clients","to":"customerProfiles"},{"from":"pets","to":"dogs"},{"from":"client","to":"customer"}]'` (pedir confirmación).
- Limpiar deuda de lint (111 errores) o añadir excepción de CI.
- Probar `/api/presence-offline`, `/api/version`.
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