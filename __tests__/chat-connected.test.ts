import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(path, 'utf8')

/**
 * El chat conecta administración con familias y paseadores. Dos cosas lo
 * desconectan sin que nadie lo note: que el aviso de mensajes sin leer
 * desaparezca del menú, o que administración vuelva a depender de que el otro
 * lado escriba primero.
 */
describe('el menú avisa de los mensajes sin leer', () => {
  test('cada panel cuenta lo suyo', () => {
    expect(read('src/app/admin/AdminLayoutClient.tsx')).toContain('useUnreadAdminChats')
    expect(read('src/app/familia/FamilyLayoutClient.tsx')).toContain('useUnreadOwnChat')
    expect(read('src/app/walker/WalkerLayoutClient.tsx')).toContain('useUnreadOwnChat')
  })

  test('el badge no aparece cuando no hay nada que contar', () => {
    expect(read('src/components/ui/NavBadge.tsx')).toContain('if (count <= 0) return null')
  })

  test('sin permiso o sin red no se inventa un número', () => {
    const hook = read('src/lib/useUnreadChat.ts')
    expect(hook.match(/setUnread\(0\)/g)?.length ?? 0).toBeGreaterThanOrEqual(3)
  })

  test('con el menú de familia cerrado, el aviso sigue a la vista', () => {
    expect(read('src/components/layout/AppShell.tsx')).toContain('sin leer en el menú')
  })
})

describe('administración puede escribir primero', () => {
  test('crea el hilo con lastTimestamp, o la bandeja no lo mostraría', () => {
    const chat = read('src/lib/chat.ts')
    expect(chat).toContain('export async function startConversationAsAdmin')
    const fn = chat.slice(chat.indexOf('startConversationAsAdmin'))
    expect(fn.slice(0, 600)).toContain('lastTimestamp: serverTimestamp()')
  })

  test('el botón vive en la ficha del paseador; a una familia se le escribe por WhatsApp', () => {
    expect(read('src/app/admin/clientes/AdminClientesPanel.tsx')).not.toContain('<StartChatButton')
    expect(read('src/app/admin/paseadores/AdminPaseadoresPanel.tsx')).toContain('<StartChatButton')
  })

  test('la bandeja abre el hilo que le piden', () => {
    const inbox = read('src/components/AdminChat.tsx')
    expect(inbox).toContain("searchParams.get('c')")
    expect(inbox).toContain('Sin mensajes todavía')
  })
})
