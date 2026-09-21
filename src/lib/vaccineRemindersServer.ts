import 'server-only'

import { FieldPath, type Firestore } from '@google-cloud/firestore'
import { notifyUser } from '@/lib/push/pushServer'
import {
  buildVaccineReminders,
  vaccineReminderMarker,
  type ReminderDog,
  type ReminderVaccine,
} from '@/lib/vaccineReminders'

/**
 * Lee los perros y manda los avisos de refuerzo que toquen hoy.
 *
 * La fecha del refuerzo vive dentro de una lista de vacunas, y Firestore no
 * consulta por lo que hay dentro de una lista de mapas: hay que leer los perros
 * y decidir aquí. Se lee por páginas y con tope, y si el tope se alcanza se dice
 * (`capped`) en vez de dar por buena una cuenta a medias.
 *
 * Es el servidor con su identidad privilegiada, así que no le pesan los topes de
 * las reglas que sí obligan al navegador.
 */

const PAGE_SIZE = 300
/** Cuántas páginas como mucho: 1 500 perros. Más que eso pide otra estrategia. */
const MAX_PAGES = 5

export interface VaccineRunResult {
  scanned: number
  capped: boolean
  reminders: number
  sent: number
  repeated: number
}

function vaccinesOf(data: FirebaseFirestore.DocumentData): ReminderVaccine[] {
  const list = data.health?.vaccines
  if (!Array.isArray(list)) return []
  return list.map((entry: unknown) => {
    const item = (entry ?? {}) as Record<string, unknown>
    return { name: typeof item.name === 'string' ? item.name : '', nextDue: typeof item.nextDue === 'string' ? item.nextDue : '' }
  })
}

export async function runVaccineReminders(firestore: Firestore, today: string, dryRun: boolean): Promise<VaccineRunResult> {
  const dogs: ReminderDog[] = []
  let capped = false
  let cursor: FirebaseFirestore.QueryDocumentSnapshot | null = null

  for (let page = 0; page < MAX_PAGES; page += 1) {
    let query = firestore.collection('dogs').orderBy(FieldPath.documentId()).limit(PAGE_SIZE)
    if (cursor) query = query.startAfter(cursor)
    const snapshot = await query.get()
    for (const item of snapshot.docs) {
      const data = item.data()
      dogs.push({
        id: item.id,
        ownerId: typeof data.ownerId === 'string' ? data.ownerId : '',
        name: typeof data.name === 'string' ? data.name : '',
        vaccines: vaccinesOf(data),
      })
    }
    if (snapshot.size < PAGE_SIZE) break
    cursor = snapshot.docs[snapshot.docs.length - 1]
    if (page === MAX_PAGES - 1) capped = true
  }

  const reminders = buildVaccineReminders(dogs, today)
  let sent = 0
  let repeated = 0
  if (dryRun) return { scanned: dogs.length, capped, reminders: reminders.length, sent: 0, repeated: 0 }

  for (const reminder of reminders) {
    try {
      // create() falla si ya existe: una segunda corrida del mismo día no repite.
      await firestore.collection('pushEvents').doc(vaccineReminderMarker(reminder)).create({
        step: 'vaccine-reminder',
        dogId: reminder.dogId,
        dueDate: reminder.dueDate,
        daysLeft: reminder.daysLeft,
        createdAt: new Date().toISOString(),
      })
    } catch {
      repeated += 1
      continue
    }
    const result = await notifyUser(firestore, reminder.uid, {
      title: reminder.title,
      body: reminder.body,
      url: reminder.url,
      tag: `vaccine-${reminder.dogId}`,
    })
    sent += result.sent
  }

  return { scanned: dogs.length, capped, reminders: reminders.length, sent, repeated }
}
