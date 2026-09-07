import type { BuildTicketSnapshotFromSessionInput } from './ticketSnapshotBuilder'

export function createDevelopmentTicketFixture(generatedAt: string): BuildTicketSnapshotFromSessionInput {
  if (process.env.NODE_ENV === 'production') throw new Error('development-fixture-disabled')
  return {
    session: {
      id: 'fixture-session-local',
      customerId: 'fixture-customer-local',
      dogIds: ['fixture-dog-local'],
      walkerId: 'fixture-walker-local',
      serviceId: 'paseo-individual',
      serviceDisplayName: 'Paseo individual',
      durationMinutes: 60,
      scheduledDate: '08/08/26',
      scheduledStart: '10:30',
      scheduledEnd: '11:30',
      status: 'completed',
    },
    names: {
      customerName: 'Familia de prueba local',
      dogNames: { 'fixture-dog-local': 'Tobi' },
      walkerName: 'José Muñoz',
    },
    reportStatus: 'submitted',
    siteOrigin: 'https://pet-euhz.vercel.app',
    generatedAt,
    mode: 'original',
  }
}
