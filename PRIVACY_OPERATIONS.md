# Operación de privacidad — MVP

Estado: borrador operativo sujeto a revisión jurídica profesional en México antes del lanzamiento comercial.

La configuración canónica de categorías, almacenamiento y retención está en `src/lib/privacyConfig.ts` y se muestra en `/privacidad`. No debe mantenerse una segunda matriz con plazos distintos.

## Solicitudes ARCO, revocación y fotografías

Canales gratuitos durante el MVP:

- formulario autenticado en Familia PET;
- correo a `ap9871888@gmail.com` con asunto `Privacidad / ARCO`.

Tipos admitidos: acceso, rectificación, cancelación, oposición, revocación de consentimiento y retirada de fotografía.

Cada solicitud debe registrar únicamente:

- ID o folio;
- tipo;
- UID, cuando exista;
- fecha y canal;
- descripción breve, sin adjuntar credenciales ni expedientes completos;
- estado;
- responsable interno;
- proveedores afectados;
- resolución resumida;
- referencia de evidencia de cierre.

Procedimiento manual:

1. Acusar recepción y asignar responsable.
2. Verificar identidad por un canal separado antes de revelar o modificar datos. No solicitar documentos de identidad dentro de una colección pública.
3. Identificar datos, documentos, assets, derivados, cachés, backups y proveedores afectados.
4. Evaluar servicios activos, controversias y obligaciones aplicables con apoyo profesional cuando corresponda.
5. Ejecutar cada acción autorizada y conservar evidencia mínima de su resultado.
6. Comunicar resolución sin exponer datos de terceros.
7. Cerrar el folio solo después de comprobar cada proveedor afectado.

No se promete un plazo legal específico ni eliminación inmediata desde la aplicación. El responsable debe definir y validar los plazos antes del lanzamiento comercial.

## Consentimientos de fotografía

Captura operativa, galería pública y redes sociales son decisiones independientes y nunca premarcadas.

Campos canónicos: `captureAllowed`, `publicGalleryAllowed`, `socialMediaAllowed`, `consentRecordedAt`, `consentVersion`, `consentSource`, `revokedAt`, `usageRights` y `publicationStatus`. La galería añade `consentEvidenceId`, `consentVerified` y `pendingDeletion` como controles administrativos derivados; `consentVerified` nunca sustituye la solicitud cerrada que contiene la evidencia.

Un registro legacy sin evidencia verificable permanece no publicado. La revocación impide nuevas publicaciones y abre una revisión manual del documento, asset externo, variantes y cachés.

## WhatsApp

Antes de abrir WhatsApp se debe mostrar el destinatario y el mensaje exacto, con opciones equivalentes para cancelar o continuar.

Para una solicitud de paseo el mensaje se limita a:

- identificador de solicitud;
- fecha o ventana solicitada;
- petición de contacto.

No se agregan automáticamente dirección, teléfono del cliente, salud o conducta, notas libres, identidad del paseador, credenciales ni datos financieros internos. La URL completa y el texto nunca se envían a Analytics ni se registran en logs.

## Eliminación y retención

Todos los borrados son manuales durante el MVP. No existe cron de depuración. El operador debe usar la matriz canónica, registrar excepciones y guardar evidencia de cierre. Borrar un documento de Firestore no prueba que un archivo externo, derivado o caché haya sido eliminado.
