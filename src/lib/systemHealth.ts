/**
 * Qué está configurado de verdad, y qué se apaga cuando no lo está.
 *
 * PET Ap depende de cosas que viven fuera del código: una llave de avisos, una
 * identidad de servidor, credenciales de Cloudinary, un secreto para las tareas
 * programadas. Cuando falta una, la función no falla con un error: simplemente
 * no ocurre. Los avisos al teléfono estuvieron muertos semanas porque la llave
 * estaba guardada con otro nombre, y no había una sola pantalla donde verlo.
 *
 * Esta lista convierte cada dependencia invisible en una línea que se puede
 * leer. No devuelve ningún secreto: sólo si está o no, y qué deja de funcionar.
 */

export type HealthState = 'ok' | 'missing'

export interface HealthCheck {
  id: string
  label: string
  state: HealthState
  /** Qué no ocurre mientras falte. */
  consequence: string
  /** Qué hay que hacer, cuando falta. */
  fix?: string
  detail?: string
}

export interface HealthInputs {
  fcmEnabled: boolean
  vapidKey: boolean
  privilegedIdentity: boolean
  serviceAccount: boolean
  cloudinaryCloud: boolean
  cloudinaryKey: boolean
  cloudinarySecret: boolean
  cronSecret: boolean
  registeredDevices: number
  /** Servicios que la app ofrece pero no tienen tarifa publicada. */
  servicesWithoutPrice: readonly string[]
  /** Zonas activas a las que les falta el centro o el radio: no pueden avisar de una salida. */
  zonesWithoutArea: readonly string[]
}

export function buildHealthChecks(input: HealthInputs): HealthCheck[] {
  return [
    {
      id: 'fcm',
      label: 'Avisos al teléfono, encendidos en el código',
      state: input.fcmEnabled ? 'ok' : 'missing',
      consequence: 'Nadie recibe avisos de sus paseos.',
      fix: 'Encender FCM_ENABLED en featureFlags.ts.',
    },
    {
      id: 'vapid',
      label: 'Llave de avisos del navegador',
      state: input.vapidKey ? 'ok' : 'missing',
      consequence: 'La tarjeta para activar avisos no aparece, así que nadie registra su teléfono.',
      fix: 'Guardar NEXT_PUBLIC_FIREBASE_VAPID_KEY en Vercel, con la llave de Cloud Messaging.',
    },
    {
      id: 'identity',
      label: 'Identidad privilegiada del servidor',
      state: input.privilegedIdentity ? 'ok' : 'missing',
      consequence: 'No se envían avisos, no se firma la subida de fotos y las rutas de servidor responden 503.',
      fix: 'Configurar la federación de identidad de Google Cloud. Sólo funciona en Producción.',
    },
    {
      id: 'service-account',
      label: 'Cuenta de servicio de Firebase',
      state: input.serviceAccount ? 'ok' : 'missing',
      consequence: 'No se pueden verificar sesiones ni roles del lado del servidor.',
      fix: 'Guardar FIREBASE_SERVICE_ACCOUNT_JSON en Vercel.',
    },
    {
      id: 'cloudinary',
      label: 'Credenciales de fotos privadas',
      state: input.cloudinaryCloud && input.cloudinaryKey && input.cloudinarySecret ? 'ok' : 'missing',
      consequence: 'Las fotos de paseo y de los perros no se pueden subir ni mostrar.',
      fix: 'Guardar NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET.',
      detail: [
        input.cloudinaryCloud ? null : 'falta el nombre de la nube',
        input.cloudinaryKey ? null : 'falta la llave',
        input.cloudinarySecret ? null : 'falta el secreto',
      ].filter(Boolean).join(' · ') || undefined,
    },
    {
      id: 'cron',
      label: 'Secreto de las tareas programadas',
      state: input.cronSecret ? 'ok' : 'missing',
      consequence: 'No sale el recordatorio de la tarde anterior ni la guardia de la mañana.',
      fix: 'Guardar CRON_SECRET en Vercel con un texto largo y aleatorio, y volver a publicar.',
    },
    {
      id: 'prices',
      label: 'Tarifa publicada de cada servicio ofrecido',
      state: input.servicesWithoutPrice.length === 0 ? 'ok' : 'missing',
      // El formulario de reserva esconde lo que no tiene tarifa, así que sin
      // esta línea el dueño no se entera de que un plan no se puede pedir.
      consequence: 'Un servicio sin tarifa no aparece en el formulario de reserva: nadie puede pedirlo.',
      fix: 'Ponerle precio en Configuración → El negocio → Precios de servicios.',
      detail: input.servicesWithoutPrice.length > 0 ? `sin tarifa: ${input.servicesWithoutPrice.join(', ')}` : undefined,
    },
    {
      id: 'zones',
      label: 'Área recomendada de cada zona activa',
      state: input.zonesWithoutArea.length === 0 ? 'ok' : 'missing',
      // Sin centro y radio la ruta del seguimiento responde "sin zona" y no
      // compara nada: un paseador puede irse lejos y nadie recibe el aviso.
      consequence: 'Una zona sin centro y radio no puede avisar cuando un paseador sale de su área recomendada.',
      fix: 'Ponerle centro y radio en Zonas.',
      detail: input.zonesWithoutArea.length > 0 ? `sin área: ${input.zonesWithoutArea.join(', ')}` : undefined,
    },
    {
      id: 'devices',
      label: 'Teléfonos registrados para recibir avisos',
      state: input.registeredDevices > 0 ? 'ok' : 'missing',
      consequence: 'Aunque todo lo demás esté bien, no hay a quién avisarle.',
      fix: 'Activar los avisos desde el teléfono, en esta misma pantalla.',
      detail: `${input.registeredDevices} registrado${input.registeredDevices === 1 ? '' : 's'}`,
    },
  ]
}

/** Cuántas piezas faltan: lo que se pinta en grande. */
export function missingCount(checks: readonly HealthCheck[]): number {
  return checks.filter((check) => check.state === 'missing').length
}
