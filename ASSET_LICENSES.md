# Registro de licencias de assets (ASSET_LICENSES)

Última actualización: 1 de septiembre de 2026

Este registro documenta el origen y licencia de cada asset usado en PET Ap. El manifiesto técnico está en `public/assets-manifest.json`.

| Asset | Tipo | Origen | Licencia | Estado |
|-------|------|--------|----------|--------|
| `public/icons/icon-192.svg` | Logo / icono de app | Diseño propio de PET Ap | Propiedad de PET Ap | ✓ Uso permitido |
| `public/icons/icon-512.svg` | Logo / icono de app | Diseño propio de PET Ap | Propiedad de PET Ap | ✓ Uso permitido |
| `src/app/opengraph-image.tsx` | Imagen OpenGraph generada | Diseño propio de PET Ap | Propiedad de PET Ap | ✓ Uso permitido |
| `public/brand/pet-ap-dog-logo.png` | Logo principal de marca | Imagen exacta proporcionada y autorizada por el propietario | Uso autorizado para PET Ap | ✓ Uso permitido; SHA `dada755f…8b594` |
| `public/brand/pet-ap-ticket-dog.png` | Logo monocromático de tickets | Imagen proporcionada y autorizada por el propietario | Uso autorizado para PET Ap | ✓ Uso permitido; SHA original `dada755f…8b594` |
| Íconos de la interfaz | Íconos vectoriales | `lucide-react` | ISC License | ✓ Libre uso con atribución en THIRD_PARTY_NOTICES |
| Fotos de la galería (`gallery-images` en Firestore) | Fotografías | Origen documentado por cada registro | Sin cesión automática: se muestran SOLO con consentimiento y derechos para galería pública | ⚠ Registros antiguos no se publican automáticamente |
| Manrope / Inter | Tipografías | Google Fonts, integradas mediante `next/font` | SIL OFL 1.1 | ✓ Servidas por el propio build |
| Logos de Uber / DiDi | Logos de marcas ajenas | — | — | ✓ Eliminados del código (no existen referencias) |

## Reglas para futuros assets

1. **Sin assets sin origen.** Todo asset nuevo debe registrarse en `public/assets-manifest.json` y en este documento ANTES de publicarse.
2. **Fotos de perros en galería**: solo se publican con consentimiento previo y verificable del propietario (opt-in), `publicationStatus: published`, `publicGalleryAllowed: true`, `consentVerified: true`, `consentRecordedAt` válido, `usageRights: public-gallery`, sin revocación y sin eliminación pendiente. `consentVerified` es un marcador administrativo derivado y nunca sustituye la evidencia. Sin evidencia no se publican.
3. **Logos de terceros** (Uber, DiDi, etc.): prohibidos, salvo licencia comercial específica.
4. **Fuentes**: Manrope e Inter se integran con `next/font` y se sirven desde el build; ambas usan SIL OFL 1.1.
5. Antes de consolidar logo/marca: realizar búsqueda de marcas en el IMPI (Instituto Mexicano de la Propiedad Industrial).

## Pendientes señalados por auditoría

- [ ] Auditar las fotografías actuales en `gallery-images` y obtener/registrar consentimiento por perro, o reemplazarlas por fotos propias con cesión firmada.
- [ ] Verificación de marca "PET Ap" ante IMPI antes de consolidar el logo.
