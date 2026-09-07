# Política operativa de medios — MVP

## Separación obligatoria

- **Galería pública:** únicamente recursos propios o con licencia documentada. Una fotografía de un cliente requiere consentimiento previo y verificable, `publicationStatus: published`, `publicGalleryAllowed: true`, `consentVerified: true`, `consentRecordedAt` válido, `usageRights: public-gallery`, sin revocación y sin eliminación pendiente. El marcador derivado nunca sustituye la evidencia.
- **Fotos operativas:** reportes de paseo, PET Ahora e incidencias son privadas. Durante el MVP sus uploads permanecen desactivados y nunca deben reutilizarse como galería pública.

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
