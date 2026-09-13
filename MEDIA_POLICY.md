# Política operativa de medios — MVP

## Separación obligatoria

- **Galería pública:** acepta foto (JPG, PNG, WebP), GIF animado y video corto sin sonido (MP4 o WebM, máximo 20 MB y 20 segundos; se reproduce en bucle y silenciado). Únicamente recursos propios o con licencia documentada. Una fotografía de un cliente requiere consentimiento previo y verificable, `publicationStatus: published`, `publicGalleryAllowed: true`, `consentVerified: true`, `consentRecordedAt` válido, `usageRights: public-gallery`, sin revocación y sin eliminación pendiente. El marcador derivado nunca sustituye la evidencia.
- **Fotos operativas:** reportes de paseo, PET Ahora e incidencias son privadas y nunca deben reutilizarse como galería pública.
  - **Fotos del paseo — activas** por decisión del dueño (2026-09-10). Se suben como assets `type=authenticated` bajo `pet-ap-private/walk-reports/<uuid>`, máximo seis por reporte. Solo las ven la familia de ese paseo (una vez enviado el reporte), el paseador asignado y staff, mediante enlaces de descarga que caducan a los 10 minutos. Quitar una foto del reporte no borra el archivo en Cloudinary.
  - **Foto del perro — activa** por decisión del dueño (2026-09-11). La sube la familia desde el perfil de su perro, como asset `type=authenticated` bajo `pet-ap-private/dogs/<uuid>`, una por perro. El documento del perro guarda sólo esa referencia opaca en `photoReference`; la foto se ve con enlaces que caducan a los 10 minutos, y sólo para la familia dueña del perro y staff. Cambiar la foto no borra la anterior en Cloudinary. El paseador asignado también la recibe dentro de la ficha del paseo, con el mismo tipo de enlace temporal y sólo mientras el paseo siga asignado a él, porque necesita reconocer al perro en la puerta. No es galería pública: reutilizarla ahí exige el consentimiento verificable de la sección anterior.
  - **Foto del paseador — activa** por decisión del dueño (2026-09-13). La sube el propio paseador desde su perfil, como asset `type=authenticated` bajo `pet-ap-private/walkers/<uuid>`, una por persona; `walkerProfiles/{uid}.photoReference` guarda sólo la referencia opaca. Se ve con enlaces que caducan a los 10 minutos, y se pide **por paseo**, no por paseador: la familia dueña de ese paseo, el paseador asignado y staff. Con la foto sólo viaja el nombre — nunca su teléfono, correo, zonas ni horario.
  - **PET Ahora e incidencias:** sus uploads siguen desactivados hasta pasar la misma revisión.

## Datos prohibidos en rutas y URLs

No incluir nombres completos, dirección, teléfono, información de salud, notas de comportamiento, instrucciones de acceso ni otros datos sensibles en nombres de archivo, carpetas, `publicId` o URLs.

Usar identificadores opacos y no semánticos cuando exista un backend firmado.

## Publicación y retiro

1. Registrar origen, licencia o consentimiento y alcance de uso.
2. Verificar que la imagen no exponga ubicación, placas, interiores del domicilio, personas identificables ni datos sensibles.
3. Publicar solamente mediante un backend firmado e idempotente.
4. Para retirar una imagen, registrar la solicitud y verificar por separado:
   - retiro del documento o estado de publicación;
   - eliminación del asset en el proveedor;
   - invalidación de cachés y derivados.

Borrar únicamente un documento de Firestore nunca debe presentarse como eliminación del archivo externo.
