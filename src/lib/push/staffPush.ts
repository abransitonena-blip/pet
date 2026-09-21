import 'server-only'

import type { Firestore } from '@google-cloud/firestore'
import { staffUidsAmong } from '@/lib/serverAuth'
import { notifyUser, type PushMessage } from '@/lib/push/pushServer'

/**
 * Un aviso al teléfono de quien opera: administración y supervisión.
 *
 * Quién opera no se lee de una colección: se lee de los claims de rol, que es
 * donde las reglas lo leen. Se parte de las cuentas con teléfono registrado y se
 * filtran por rol.
 *
 * Es de las cosas que fallan callado -- sin teléfonos registrados, o sin
 * identidad para consultar los roles, nadie recibe nada y nada avisa --, así que
 * cuando había teléfonos y no salió ninguno, queda en el registro del servidor.
 */

/** Cuántas cuentas con teléfono se revisan como mucho. */
const MAX_DEVICE_ACCOUNTS = 100

export interface StaffPushResult {
  /** Cuentas con teléfono registrado que se revisaron. */
  accounts: number
  /** De ellas, las que son de administración o supervisión. */
  staff: number
  /** A cuántas les salió al menos un aviso. */
  notified: number
}

export async function notifyStaff(firestore: Firestore, message: PushMessage): Promise<StaffPushResult> {
  const devices = await firestore.collection('pushTokens').limit(MAX_DEVICE_ACCOUNTS).get()
  const staff = await staffUidsAmong(devices.docs.map((item) => item.id))

  let notified = 0
  for (const uid of staff) {
    const result = await notifyUser(firestore, uid, message)
    if (result.sent > 0) notified += 1
  }

  if (notified === 0) {
    console.warn(
      `staff push not delivered: ${devices.size} account(s) with devices, ${staff.length} staff, tag=${message.tag ?? ''}`,
    )
  }
  return { accounts: devices.size, staff: staff.length, notified }
}
