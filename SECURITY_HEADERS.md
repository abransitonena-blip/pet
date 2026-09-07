# Cabeceras y CSP — propuesta local P0.7

Estado: preparación local; no publicada.

## Etapa A: Report-Only

`security-headers.js` genera `Content-Security-Policy-Report-Only`. No se configuró `report-uri` ni `report-to`, para evitar almacenar URLs, parámetros o tokens en un receptor no diseñado. Antes de convertirla en política efectiva se debe probar navegación pública, Firebase Auth por popup, GIS, Firestore, galería y Analytics con consentimiento.

Hosts permitidos y motivo:

| Directiva | Origen | Motivo |
|---|---|---|
| `script-src` | `accounts.google.com`, `apis.google.com`, `www.gstatic.com` | GIS y soporte de popup Google |
| `script-src` | `www.googletagmanager.com` | Loader de Analytics, solo tras consentimiento |
| `connect-src` | Firebase Auth, Secure Token, Firestore y `www.googleapis.com` | Autenticación y datos Firebase cliente |
| `connect-src` | Google Analytics | Eventos únicamente tras consentimiento |
| `frame-src` | `accounts.google.com`, dominio Firebase Auth configurado | GIS/popup y handler de Auth |
| `img-src` | `res.cloudinary.com` | Galería pública autorizada |
| `font-src` | `'self'` | Fuentes emitidas por `next/font` |
| `worker-src` | `'self' blob:` | Único service worker local y workers generados por el runtime |

No están permitidos Cloud Functions, `api.cloudinary.com`, Google Fonts en runtime, FCM, `placedog.net`, `pravatar` ni comodines generales de HTTPS.

## Etapa B: política propuesta

`PRODUCTION_CSP` es la candidata posterior. Elimina `unsafe-eval` e incorpora `upgrade-insecure-requests`. No se aplica todavía.

Deuda deliberada:

- `unsafe-inline` continúa en `script-src` y `style-src` por compatibilidad con Next.js, GIS y estilos existentes.
- Retirarlo requiere inventariar scripts/estilos inline y evaluar nonces o hashes en una rama de prueba.
- No se introducen nonces en P0.7 porque podrían forzar render dinámico y cambiar la compatibilidad con hosting estático/Cloudflare.
- Safari, popup bloqueado, dominio Firebase autorizado, previews y navegador privado requieren verificación manual.

## Cabeceras

- `X-Content-Type-Options: nosniff`.
- `Referrer-Policy: strict-origin-when-cross-origin`.
- `Permissions-Policy` deniega cámara, micrófono, geolocalización, pagos, USB y Topics.
- `Cross-Origin-Opener-Policy: same-origin-allow-popups` para conservar el popup Google.
- `X-Frame-Options: DENY` y `frame-ancestors 'none'`.
- HSTS se agrega solo cuando `NODE_ENV=production`; no se envía en desarrollo/localhost y no incluye `preload`.
- Paneles, autenticación, cancelación y APIs reciben `private, no-store` y `X-Robots-Tag`.

Robots y CSP no sustituyen autorización por claims, reglas por documento ni verificación de tokens.
