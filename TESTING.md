# Pruebas E2E — Smoke checklist

Última actualización: 30 de julio de 2026

Prerrequisitos: reglas de Firestore desplegadas (`npx firebase deploy --only firestore:rules`) y documento `appSettings/public` creado (ver `scripts/seed-appsettings.json`). Sitio: `npm run dev`.

## 1. Cotizador (zona)

- [ ] Público no autenticado abre `/` → el selector de zona carga zonas **sin** error y **sin** "Cargando zonas..." infinito (`allow read: if true` en `firestore.rules`)
- [ ] "Zona Quebrada" **no** aparece en el selector ni en ninguna parte del sitio
- [ ] Fallback: con reglas que bloqueen la lectura, el cotizador muestra error + botón "Reintentar" (`aria-busy` mientras carga)

## 2. Landing solo cotizador

- [ ] `/` ya no muestra el formulario de reserva viejo (solo `QuoteForm`)
- [ ] Usuario no autenticado ve CTA "Cotizar mi paseo" → `#cotizar`
- [ ] Usuario autenticado ve enlace a `/mi-cuenta/nueva-reserva`

## 3. Login con Google

- [ ] `/login`, modo "familia": el botón de Google se renderiza (no queda vacío)
- [ ] Sin GIS (offline), aparece el mensaje exacto: "El acceso con Google no está disponible temporalmente. Continúa con correo o inténtalo más tarde."
- [ ] El botón de Google no se duplica tras cambiar de modo (paseador ↔ familia)

## 4. Teléfono único

- [ ] Footer, ContactSection, QuoteResult y WhatsAppButton muestran `55 2305 3772`
- [ ] El link de WhatsApp usa `5215523053772` (E.164) en todos los casos

## 5. Consentimiento / GA

- [ ] Primera visita pública: banner "Tu privacidad importa" (Aceptar / Rechazar)
- [ ] Antes de aceptar: **sin** petición de red a `googletagmanager.com` (DevTools → Network)
- [ ] Tras "Aceptar": el tag `G-HQTMCZX66M` carga y dispara `page_view`
- [ ] En `/login`, `/admin`, `/paseador`, `/familia`, `/mi-cuenta`: GA **nunca** carga, aunque haya consentimiento previo
- [ ] Tras "Rechazar": no se carga GA, incluso recargando
- [ ] `analyticsEnabled: false` en `appSettings/public`: GA no carga pese al consentimiento

## 6. Contraste / legibilidad

- [ ] `html` con `forced-colors: active` (Chrome DevTools → Rendering): los textos con `.gradient-text` siguen legibles (fallback sólido)
- [ ] Precios: **sin** gradiente, usan `text-primary` (legibles en tema claro y oscuro)

## 7. Privacidad y términos

- [ ] `/privacidad` (última actualización 30-jul-2026): tablas de proveedores, retención, ARCO, consentimiento GA
- [ ] TermsModal: sin "primeros auxilios", sin "incluyen IVA", sin "no compartimos con terceros"; sí menciona proveedores reales y opt-in de fotos
- [ ] FAQ: sin la afirmación de "registro GPS del paseo"

## 8. Accesibilidad (filtro general)

- [ ] Todos los botones de solo ícono tienen `aria-label` y `focus-visible`
- [ ] Targets táctiles ≥ 24×24 px (clase `.btn` con `min-height: 44px`)

## 9. Iconos / assets

- [ ] No quedan logos de Uber/DiDi en el sitio
- [ ] Todos los íconos usan `lucide-react` (única librería); sin `react-icons`
- [ ] `public/assets-manifest.json`, `ASSET_LICENSES.md`, `THIRD_PARTY_NOTICES.md` presentes

## 10. Build guard

- [ ] Introducir la palabra "Quebrada" en `src/` o `public/` hace fallar `npm run build` (prebuild)

## 11. Config — única fuente + errores visibles

- [ ] `ConfigContext` **solo** lee `appSettings/public` (sin fallback a `admin/config`)
- [ ] Guardar config desde `/admin/config` actualiza `updatedAt` (serverTimestamp), `updatedBy` (uid) y `schemaVersion: 2`
- [ ] Borrar `appSettings/public` en la consola de Firebase → aparece el banner "⚠ Los precios y config del sitio están desactualizados" en todo el sitio
- [ ] Con reglas que bloqueen la lectura de `appSettings` → mismo banner visible (sin fallback silencioso)
- [ ] Cliente (no admin) intentando escribir `appSettings` o `admin/config` desde DevTools → permisos denegados por reglas (`isAdmin()`)

## 12. Acceso a rutas `/admin` (matriz de roles)

| Rol | `/admin` | `/admin/*` | Resultado esperado |
|-----|----------|------------|--------------------|
| Visitante (no autenticado) | redirige a `/login` | redirige a `/login` | Admin layout: `onAuthStateChanged` sin user → `router.push('/login')` |
| Cliente (`role=client`) | cierra sesión + redirige a `/login` | igual | Admin layout: `getDoc(users/{uid}).role !== 'admin'` → `signOut` + `/login` |
| Paseador (`role=walker`) | cierra sesión + redirige a `/login` | igual | Ídem |
| Admin (`role=admin`) | carga el panel | carga | Admin layout: `loading=false` |

- [ ] Verificar los 4 casos de la matriz arriba en `npm run dev`

## 13. Login — errores diferenciados + recuperación

- [ ] Correo no registrado → "No encontramos una cuenta con este correo"
- [ ] Contraseña incorrecta → "Contraseña incorrecta"
- [ ] Cuenta desactivada → "Esta cuenta fue desactivada"
- [ ] Demasiados intentos → "Demasiados intentos fallidos. Espera unos minutos e intenta de nuevo."
- [ ] "¿Olvidaste tu contraseña?" con correo registrado → llega el correo de reset (Firebase)
- [ ] "¿Olvidaste tu contraseña?" con correo no registrado → mismo mensaje de éxito (no revela si existe) + sin error

## Suite automatizada

- [ ] `npx tsc --noEmit` sin errores
- [ ] `npx jest --passWithNoTests` → 59 tests / 6 suites pasando (incluye `auth.test.ts` con `classifyLoginError`)
- [ ] `npm run build` correcto
