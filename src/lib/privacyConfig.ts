export const PRIVACY_DRAFT_VERSION = '2026-09-11-draft'
export const PHOTO_CONSENT_VERSION = '2026-08-08-v1'

export const PHOTO_CONSENT_FIELDS = [
  'captureAllowed',
  'publicGalleryAllowed',
  'socialMediaAllowed',
  'consentRecordedAt',
  'consentVersion',
  'consentSource',
  'consentVerified',
  'revokedAt',
  'usageRights',
  'publicationStatus',
] as const

export type PrivacyRequestType =
  | 'access'
  | 'rectification'
  | 'cancellation'
  | 'opposition'
  | 'consent-revocation'
  | 'photo-removal'
  | 'photo-consent-update'

export const PRIVACY_REQUEST_TYPES: Array<{ value: PrivacyRequestType; label: string }> = [
  { value: 'access', label: 'Acceso a mis datos' },
  { value: 'rectification', label: 'Rectificación' },
  { value: 'cancellation', label: 'Cancelación' },
  { value: 'opposition', label: 'Oposición' },
  { value: 'consent-revocation', label: 'Revocar consentimiento' },
  { value: 'photo-removal', label: 'Retirar una fotografía' },
  { value: 'photo-consent-update', label: 'Registrar preferencias de fotografía' },
]

export const RETENTION_MATRIX = [
  { category: 'Perfiles de cuenta', purpose: 'Cuenta y soporte', period: 'Cuenta activa y revisión manual hasta 90 días después del cierre verificado', starts: 'Cierre verificado', owner: 'Administración', deletion: 'Manual', provider: 'Firebase', exception: 'Órdenes activas, controversias u obligación aplicable', evidence: 'Folio de cierre' },
  { category: 'Perros y direcciones', purpose: 'Seguridad y prestación del paseo', period: 'Cuenta activa y hasta 90 días después del cierre, si no existen servicios activos', starts: 'Cierre verificado', owner: 'Administración', deletion: 'Manual', provider: 'Firestore', exception: 'Servicio activo o incidencia abierta', evidence: 'Checklist por UID' },
  { category: 'Órdenes y sesiones', purpose: 'Ejecución, soporte y comprobación del servicio', period: 'Propuesta operativa: 24 meses desde la última sesión', starts: 'Última sesión', owner: 'Administración', deletion: 'Manual', provider: 'Firestore', exception: 'Revisión fiscal/jurídica o controversia', evidence: 'Acta de depuración' },
  { category: 'Reportes operativos', purpose: 'Evidencia del paseo', period: 'Propuesta operativa: 12 meses desde el paseo', starts: 'Paseo completado', owner: 'Operaciones', deletion: 'Manual', provider: 'Firestore', exception: 'Incidencia abierta', evidence: 'Registro de retiro' },
  { category: 'Ubicación durante el paseo', purpose: 'Avisar si el paseo sale de la zona acordada', period: '30 días desde la captura del punto', starts: 'Captura del punto', owner: 'Operaciones', deletion: 'Automática: política TTL de Firestore sobre expiresAt', provider: 'Firestore', exception: 'Incidencia abierta que requiera conservar el recorrido', evidence: 'Política TTL activa; ver TRACKING_POLICY.md' },
  { category: 'Fotografías operativas', purpose: 'Reporte privado', period: 'Propuesta: 30 días después de entrega; uploads desactivados en MVP', starts: 'Entrega del reporte', owner: 'Operaciones', deletion: 'Manual y por proveedor', provider: 'Cloudinary si se habilita', exception: 'Incidencia o conservación solicitada', evidence: 'Asset, derivados y caché verificados' },
  { category: 'Galería pública', purpose: 'Difusión autorizada', period: 'Hasta revocación, retiro o vencimiento del alcance documentado', starts: 'Publicación', owner: 'Privacidad/administración', deletion: 'Manual', provider: 'Firestore y proveedor de medios', exception: 'Conservación mínima de evidencia de consentimiento', evidence: 'Documento retirado, asset y cachés verificados' },
  { category: 'Reseñas', purpose: 'Calidad y testimonio cuando se autorice', period: 'Propuesta: 24 meses o hasta retiro/moderación', starts: 'Creación', owner: 'Administración', deletion: 'Manual', provider: 'Firestore', exception: 'Incidencia abierta', evidence: 'Registro de moderación' },
  { category: 'Notificaciones internas', purpose: 'Avisos del servicio', period: 'Propuesta: 90 días', starts: 'Creación', owner: 'Operaciones', deletion: 'Manual en MVP', provider: 'Firestore', exception: 'Incidencia abierta', evidence: 'Reporte de depuración' },
  { category: 'Auditoría', purpose: 'Seguridad e investigación', period: 'Propuesta: 24 meses', starts: 'Evento', owner: 'Seguridad', deletion: 'Manual', provider: 'Firestore', exception: 'Investigación activa', evidence: 'Acta de depuración' },
  { category: 'Consentimientos', purpose: 'Demostrar alcance y revocación', period: 'Propuesta: 24 meses después de revocación o término del uso', starts: 'Revocación o término', owner: 'Privacidad', deletion: 'Manual', provider: 'Firestore/archivo controlado', exception: 'Revisión jurídica', evidence: 'Folio y versión' },
  { category: 'Solicitudes ARCO', purpose: 'Atender y demostrar cierre', period: 'Propuesta: 24 meses después del cierre', starts: 'Cierre', owner: 'Privacidad', deletion: 'Manual', provider: 'Firestore/registro interno', exception: 'Impugnación o controversia', evidence: 'Folio cerrado' },
  { category: 'Analytics', purpose: 'Métricas opcionales', period: 'Desactivado; definir en GA4 antes de habilitar', starts: 'Evento', owner: 'Producto', deletion: 'Configuración del proveedor y solicitud manual', provider: 'Google Analytics', exception: 'Datos ya procesados sujetos a capacidades del proveedor', evidence: 'Captura de configuración' },
  { category: 'WhatsApp', purpose: 'Contacto iniciado por la persona', period: 'Según cuenta y controles de Meta; PET Ap debe revisar chats manualmente', starts: 'Mensaje', owner: 'Atención', deletion: 'Manual y dependiente del proveedor', provider: 'Meta/WhatsApp', exception: 'Conversación necesaria para servicio o controversia', evidence: 'Folio de revisión' },
  { category: 'Backups', purpose: 'Recuperación', period: 'Propuesta: 30 días, después de revocar credenciales comprometidas', starts: 'Creación del backup', owner: 'Seguridad', deletion: 'Manual', provider: 'Almacenamiento local controlado', exception: 'Retención autorizada y cifrada', evidence: 'Inventario firmado' },
] as const

export const STORAGE_INVENTORY = [
  { name: '__session', kind: 'cookie', category: 'esencial', purpose: 'Señal de navegación; no autoriza', duration: '30 días, renovada mientras la sesión siga abierta', creator: 'PET Ap', removal: 'Logout o expiración' },
  { name: 'petap_consent_v1', kind: 'localStorage', category: 'preferencia', purpose: 'Elección de analítica', duration: 'Hasta borrar o cambiar elección', creator: 'PET Ap', removal: 'Control Privacidad > Borrar elección' },
  { name: 'pq_reservation_draft', kind: 'localStorage', category: 'esencial', purpose: 'Borrador local de reserva', duration: 'Hasta enviar o limpiar datos del sitio', creator: 'PET Ap', removal: 'Al completar la solicitud o desde el navegador' },
  { name: 'petap_banner_dismissed', kind: 'localStorage', category: 'preferencia', purpose: 'Recordar banner cerrado', duration: 'Hasta cambiar el mensaje o limpiar datos', creator: 'PET Ap', removal: 'Configuración del navegador' },
  { name: 'Firebase Auth/Firestore IndexedDB', kind: 'IndexedDB', category: 'esencial', purpose: 'Sesión y caché del SDK', duration: 'Gestionada por Firebase y el navegador', creator: 'Firebase SDK', removal: 'Logout y limpieza de datos del sitio' },
  { name: 'pet-ap-static-v3', kind: 'Cache Storage', category: 'esencial', purpose: 'Iconos PWA locales; no almacena manifiesto, navegación, paneles ni respuestas con datos', duration: 'Hasta una nueva versión del service worker o limpieza', creator: '/sw.js', removal: 'Actualización controlada del SW o limpieza del sitio' },
  { name: '_ga / _ga_*', kind: 'cookie', category: 'analítica', purpose: 'Medición opcional', duration: 'Solo si Analytics se habilita y acepta', creator: 'Google Analytics', removal: 'Retirar consentimiento; la eliminación accesible es de mejor esfuerzo' },
] as const
