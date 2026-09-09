import { BRAND } from './brand'
import { PRIVACY_DRAFT_VERSION } from './privacyConfig'

export interface PrivacyProvider {
  name: string
  purpose: string
  country: string
}

export interface PrivacySection {
  title: string
  content: string
  providers?: PrivacyProvider[]
}

export const PRIVACY_LAST_UPDATED = '8 de agosto de 2026'

export const privacySections: PrivacySection[] = [
  {
    title: '1. Responsable y alcance',
    content: `${BRAND.name}, operación ubicada en Ciudad de México y disponible en ${BRAND.email}, prepara este aviso para describir el tratamiento realizado por el sitio y el servicio de paseo. La identidad jurídica, domicilio completo y canales formales deben validarse antes del lanzamiento comercial. Versión operativa: ${PRIVACY_DRAFT_VERSION}.`,
  },
  {
    title: '2. Categorías de datos',
    content: 'Podemos tratar identificadores de cuenta, nombre, correo, teléfono, perfiles de perros, dirección de recogida, agenda, órdenes, sesiones, pagos confirmados, reportes, reseñas, reportes de errores técnicos y comunicaciones. Información de salud o conducta del perro solo debe proporcionarse cuando sea necesaria para realizar el paseo de forma segura. No solicitamos diagnósticos médicos de personas.',
  },
  {
    title: '3. Finalidades necesarias',
    content: 'Crear y proteger la cuenta; gestionar perfiles de perros y direcciones; recibir, confirmar y ejecutar solicitudes de paseo; asignar personal; atender incidencias; mantener notificaciones internas; gestionar pagos y soporte; diagnosticar fallas técnicas reportadas por el navegador; y conservar evidencia operativa cuando sea necesario. Negarse a proporcionar un dato indispensable puede impedir esa operación concreta.',
  },
  {
    title: '4. Finalidades opcionales y consentimientos separados',
    content: 'Son opcionales y no condicionan el servicio: Analytics, marketing, comunicaciones promocionales, testimonios públicos (reseñas), publicación en galería y publicación en redes sociales. Una reseña puede publicarse desde cualquier cuenta de Familia PET con sesión iniciada; permitir capturar una foto para un reporte privado no equivale a autorizar su publicación. Las cargas operativas y la publicación automática permanecen desactivadas durante el MVP.',
  },
  {
    title: '5. Proveedores y comunicaciones',
    content: 'Los proveedores pueden procesar datos fuera de México conforme a su propia infraestructura y condiciones. El alcance contractual y las transferencias deben revisarse profesionalmente antes del lanzamiento comercial.',
    providers: [
      { name: 'Firebase / Google', purpose: 'Autenticación y Firestore. FCM permanece desactivado.', country: 'Infraestructura internacional' },
      { name: 'Vercel', purpose: 'Hosting actual. La producción comercial deberá cambiar de plan o proveedor.', country: 'Infraestructura internacional' },
      { name: 'Cloudflare', purpose: 'Alternativa futura preparada, todavía no desplegada.', country: 'No aplica todavía' },
      { name: 'Cloudinary', purpose: 'Galería con carga firmada por el navegador (consentimiento y derechos registrados antes de publicar).', country: 'Infraestructura internacional' },
      { name: 'WhatsApp / Meta', purpose: 'Solo cuando la persona decide abrir WhatsApp y confirma el mensaje.', country: 'Infraestructura internacional' },
      { name: 'Google Analytics', purpose: 'Solo si configuración y consentimiento analítico están activos; publicidad siempre denegada.', country: 'Infraestructura internacional' },
    ],
  },
  {
    title: '6. Retención',
    content: 'La matriz mostrada abajo contiene plazos operativos propuestos, no plazos legales definitivos. En el MVP los procesos de revisión y eliminación son manuales. Pueden existir excepciones por servicios activos, controversias u obligaciones aplicables, que deben documentarse.',
  },
  {
    title: '7. Derechos ARCO, revocación y retiro de fotografías',
    content: `Puede solicitar acceso, rectificación, cancelación u oposición, revocar consentimientos o pedir el retiro de una fotografía desde Familia PET o escribiendo a ${BRAND.email}. Se asignará un folio y se verificará identidad antes de revelar o modificar datos. No prometemos eliminación inmediata: deben revisarse Firestore, autenticación, proveedores, derivados, cachés y excepciones documentadas.`,
  },
  {
    title: '8. Seguridad de la información',
    content: 'Aplicamos controles de acceso por rol y documento, minimización, feature flags y procedimientos manuales. Ninguna medida elimina por completo el riesgo. Las credenciales legacy detectadas requieren revocación manual y no se consideran una protección válida.',
  },
  {
    title: '9. Cookies y analítica',
    content: 'Analytics está desactivado por defecto. Antes de aceptar no se carga gtag.js ni se envían eventos. Aceptar concede únicamente analytics_storage; ad_storage, ad_user_data y ad_personalization permanecen denegados. El control "Privacidad" permite rechazar, retirar o borrar la elección. La eliminación de cookies accesibles es de mejor esfuerzo y no borra automáticamente información ya procesada por un proveedor.',
  },
  {
    title: '10. Cambios al aviso de privacidad',
    content: 'Los cambios se identificarán mediante fecha y versión. Cuando una nueva finalidad opcional requiera consentimiento, no se asumirá aceptación por silencio o por el uso del servicio.',
  },
  {
    title: '11. Estado jurídico del documento',
    content: 'Este documento es un borrador operativo y requiere revisión jurídica profesional antes del lanzamiento comercial. La referencia general utilizada es el texto vigente de la Ley Federal de Protección de Datos Personales en Posesión de los Particulares publicado por la Cámara de Diputados; esta página no constituye asesoría legal ni afirma cumplimiento absoluto.',
  },
]

export interface EditablePrivacyText {
  title: string
  content: string
}

/** Same merge contract as mergeTermsSections: position-matched, all-or-nothing. */
export function mergePrivacySections(overrides?: EditablePrivacyText[] | null) {
  if (!overrides || overrides.length !== privacySections.length) return privacySections
  return privacySections.map((section, index) => ({
    ...section,
    title: overrides[index]?.title?.trim() || section.title,
    content: overrides[index]?.content?.trim() || section.content,
  }))
}
