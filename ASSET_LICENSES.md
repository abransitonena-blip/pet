# Registro de licencias de assets (ASSET_LICENSES)

Última actualización: 30 de julio de 2026

Este registro documenta el origen y licencia de cada asset usado en PET Ap. El manifiesto técnico está en `public/assets-manifest.json`.

| Asset | Tipo | Origen | Licencia | Estado |
|-------|------|--------|----------|--------|
| `public/icons/icon-192.svg` | Logo / icono de app | Diseño propio de PET Ap | Propiedad de PET Ap | ✓ Uso permitido |
| `public/icons/icon-512.svg` | Logo / icono de app | Diseño propio de PET Ap | Propiedad de PET Ap | ✓ Uso permitido |
| `public/og-image.png` (referenciado) | Imagen OpenGraph | Fotografía propia de perros de clientes (con autorización) | Autorización específica de cada cliente | ⚠ Verificar permiso por perro |
| Íconos de la interfaz | Íconos vectoriales | `lucide-react` | ISC License | ✓ Libre uso con atribución en THIRD_PARTY_NOTICES |
| Fotos de la galería (`gallery-images` en Firestore) | Fotografías | Tomadas por PET Ap durante paseos | Sin cesión automática: se publican SOLO con autorización previa del dueño | ⚠ Requiere auditoría individual |
| Logos de Uber / DiDi | Logos de marcas ajenas | — | — | ✓ Eliminados del código (no existen referencias) |

## Reglas para futuros assets

1. **Sin assets sin origen.** Todo asset nuevo debe registrarse en `public/assets-manifest.json` y en este documento ANTES de publicarse.
2. **Fotos de perros en galería**: solo se publican con consentimiento previo y escrito del propietario (opt-in). Sin consentimiento, las fotos solo van al reporte privado del paseo.
3. **Logos de terceros** (Uber, DiDi, etc.): prohibidos, salvo licencia comercial específica.
4. **Fuentes**: Inter (OFL) y JetBrains Mono (OFL) cargadas por Google Fonts — licencias OFL permiten uso libre.
5. Antes de consolidar logo/marca: realizar búsqueda de marcas en el IMPI (Instituto Mexicano de la Propiedad Industrial).

## Pendientes señalados por auditoría

- [ ] Auditar las fotografías actuales en `gallery-images` y obtener/registrar consentimiento por perro, o reemplazarlas por fotos propias con cesión firmada.
- [ ] Verificación de marca "PET Ap" ante IMPI antes de consolidar el logo.
