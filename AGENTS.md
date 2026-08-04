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
  - Iconos PWA: `public/icons/icon-512.svg` y `icon-192.svg` (huella white sobre gradiente primary, círculo decorativo 6% opacidad, sin rx en el rect grande de 512).
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

### Próximos pendientes

1. **Fase 12**: scripts/ — `rename-collections.js` creado (con backups y rollback).
2. **Fase 13**: Makefile.cd — objetivos para setup-eslint, setup-types, setup-tests, setup-build.
3. **Fase 14**: AGENTS.md — este archivo (resumen y continuar).
4. **Fase 15+** (por definir):
   - Refactorizar `services.ts` → `walkServices.ts` (si lo necesitas).
   - Actualizar reglas de seguridad / índices de Firestore tras reanames.
   - Validar scripts de CI (eslint, tsc, jest, build) y actualizar los scripts.

## Continuar

- Ejecutar `node scripts/rename-collections.js --backups-dir ./backups/renames/$(date +%F_%H-%M-%S) --renames '[{"from":"clients","to":"customerProfiles"},{"from":"pets","to":"dogs"},{"from":"client","to":"customer"}]'`
- Ejecutar `make setup-all` o `make lint typecheck jest build` para asegurar el entorno.
- Probar endpoints (`/api/presence-offline`, `/api/version`).
- Incorporar `Makefile.cd` a CI si lo necesitas.
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

Notar: -- Ejemplo de `scripts/check-forbidden.mjs` bloquea tokens legacy "Quebrada". -- Comandos de CI actuales: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`. -- Main Si hay que cambiar a usar `git -C pet-reservations` para componentes clientes.