# Reporte canónico de paseo y frontera de tickets

Actualizado: 24 de agosto de 2026. Reglas y runtime están publicados; la aceptación autenticada con una sesión completada existente continúa pendiente.

## Fuente de verdad

```text
walkSessions/{walkSessionId} completed
→ walkReports/{walkSessionId}
→ referencia de solo lectura para ticket futuro
```

`walkSessions` sigue siendo la fuente del servicio. El ID del reporte coincide exactamente con el ID de la sesión, por lo que un reintento no crea un segundo documento.

## Contrato v1

| Campo | Origen | Mutabilidad |
|---|---|---|
| `walkSessionId`, `orderId`, `customerId`, `walkerId`, `dogIds` | snapshot de la sesión | inmutable |
| `summary`, `behaviorNotes`, `bathroomNotes`, `waterProvided`, `incidentsSummary` | Walker asignado | editable solo en draft, con límites |
| `mediaReferences` | reservado | debe ser `[]`; uploads privados desactivados |
| `status` | `draft` o `submitted` | solo draft → submitted |
| `createdBy` | UID del Walker asignado | inmutable |
| `createdAt`, `updatedAt`, `submittedAt` | tiempo del servidor | controlado por reglas |
| `schemaVersion` | `1` | inmutable |

## Autorización activa

- Walker: claim `walker`, perfil `active`, sesión actualmente asignada a su UID; guarda draft y envía únicamente si la sesión está completada. Una reasignación invalida también la edición de un draft existente.
- Customer: claim `customer`, legacy `client` o sin claim explícito; únicamente propietario de la sesión y solo `get` de `submitted`.
- Admin/Supervisor: lectura operativa.
- Claim desconocido, Walker ajeno/inactivo y Customer ajeno: sin acceso.
- Ningún actor cliente elimina reportes; un reporte enviado no vuelve a borrador.

## Estados de interfaz

`loading`, `empty`, `unavailable`, `permission-denied`, `network-error`, draft editable y submitted de solo lectura. El flag está activo; Familia/Admin usan lecturas puntuales y solo el editor Walker mantiene listener mientras está abierto.

## Medios

No se aceptan URLs públicas como fotos privadas. `mediaReferences` permanece vacío hasta disponer de un backend firmado, reglas de medios, consentimiento y evidencia de propiedad. El modal legacy no se reutiliza.

## Frontera con tickets

`toReportTicketReference()` produce únicamente `walkSessionId`, `reportId`, ruta autorizada, estado `submitted` y versión del esquema. No crea ticket, folio, pago, movimiento financiero ni snapshot fiscal. Un `InternalTicket` futuro solo podrá enlazar un reporte enviado; la reimpresión no modificará el reporte ni generará movimientos.

## Validación local

- Dominio puro: 4/4.
- UI/flags focal: 24/24.
- Firestore Emulator, Java 21 y proyecto demo: 10/10 focal.
- Suite: 389/389.
- Typecheck y lint: PASS.
- Build/prerender: 51/51.
- Candidato de reglas SHA-256: `e5babfe55a248b42af7b621cfa7cb447213955a55583c9d5bb82b4a7f7fe6bcb`.
- Codex Security diff scan del payload final: `e3d3eeed-2d48-4042-a13e-3fb3f1d41dba`, 9 superficies y 0 hallazgos.

## Estado de publicación y siguiente gate

1. Ruleset `d0008740-b8ce-4744-805f-342aa0f6aaa0` y SHA `6f5fa93f55e4d2058b554bf00bea97f9715e1ffdddbdbc9c02bbd711a1eec94c` verificados.
2. Runtime base promovido mediante Preview `dpl_BWim6wNoxtsTUq25KJcsY2Rrz1dd`; la visibilidad operativa focal se publicó desde `dpl_BtJ3jkPWcpud5jyqy4poEomwrF9G` a Production `dpl_6b8g76T6mRrfTAVQaTcHoj7RxCLF`; rollback inmediato `dpl_Cy9SWvTJhHvJ5amrUytCFTwoJrLP`.
3. Pendiente QA autenticada de Walker, Familia y staff con una sesión completada existente.
4. Diseñar filtros Admin e índices únicamente si la operación los requiere.
5. Mantener fotos privadas desactivadas.

## Corrección P0 y visibilidad operativa — 24-ago-2026

- `get` de `walkReports/{walkSessionId}` inexistente: permitido únicamente a customer propietario compatible o Walker activo actualmente asignado; `list`, creación, envío e inmutabilidad no cambiaron.
- Ruleset activo `b1998c37-9e7f-4cba-8c45-f133cae16b18`, SHA `3c84a994dbbc0e7eb6fd3c977c9577eab765a7377b52cd542e91a75ae03f0792`.
- Walker expone completados anteriores en inicio e historial; Familia enlaza reportes desde su historial canónico; Admin conserva lectura acotada a 50 con filtros locales.
- La aceptación manual draft → submit → lectura Familia/Admin sigue en paralelo; no bloquea T1 y no se crearán reportes automáticamente.

## T1 — vista previa temporal ESC/POS (25-ago-2026)

Flujo implementado localmente:

```text
walkSession completed + walkReport puntual
→ TemporaryTicketSnapshot (internal-receipt, isCfdi=false, isPersistent=false)
→ PetApTicketBuilder
→ Uint8Array ESC/POS 58 mm / CP850 / logo raster / QR nativo
→ ManualHexTransport o MockPrinterTransport
```

- `/admin/printing/test` exige custom claim `admin`, consulta como máximo 50 sesiones recientes y realiza solo lecturas puntuales de la selección.
- Sin snapshot financiero histórico confiable, todos los importes permanecen `null` y la salida dice `Pago: NO REGISTRADO`; no consulta precios actuales ni presenta `$0`.
- El folio y código de verificación son demostrativos y deterministas para la vista previa; no se persisten ni reservan una secuencia.
- La herramienta no importa APIs de escritura Firestore, no imprime automáticamente, no crea `tickets`, no incrementa `printCount` y no genera pagos o movimientos.
- Pruebas T1: 19/19; suite completa: 411/411; emulador focal de reportes: 11/11. La suite histórica reproduce 21 divergencias conocidas y ajenas a T1.
- Build del repositorio con configuración local: 52/52. Escaneo Codex Security `e166a311-7feb-466e-9b6a-deafd2ffe653`: cobertura completa, 0 hallazgos.
- Fixture determinista: 982 bytes, 1964 caracteres HEX continuos; comienza con inicialización/CP850/logo raster y termina con alimentación/reset.
- Payload aislado: manifiesto SHA-256 `af27dbe5b5f03c0fe817070c9884ca4f0f50775c72e2dc6c05838451f7460098`, 12 diferencias runtime y cero archivos administrativos o secretos.
- Preview `dpl_9vw2GBGfTzpcTDNp6Xt73v3nBL4C` y Production `dpl_EC8yYszuaGVHozxPix8oqDiu5uHB` están `READY`; alias estable confirmado. Rollback manual: `dpl_6b8g76T6mRrfTAVQaTcHoj7RxCLF`.
- Verificación pública: rutas/redirecciones PASS, consola y logs sin errores, service worker `pet-ap-static-v3` excluye `/admin`, `/familia` y `/walker`.
- Firebase permaneció intacto: ruleset `b1998c37-9e7f-4cba-8c45-f133cae16b18`, SHA `3c84a994dbbc0e7eb6fd3c977c9577eab765a7377b52cd542e91a75ae03f0792`, 12/12 índices `READY` y facturación desactivada.
- Pendiente: prueba física manual con SUZWIP mediante nRF Connect y aceptación autenticada de la herramienta Admin.

## T2 — persistencia inmutable y eventos de impresión (25-ago-2026)

```text
walkSession completed + walkReport submitted
→ tickets/{walkSessionId} (snapshot inmutable)
→ ESC/POS / HEX
→ tickets/{walkSessionId}/printEvents/{eventId} (append-only)
```

- `ticketId == walkSessionId`; folios visibles deterministas `TKT-{walkSessionId}` y `PET-{walkSessionId}`. No hay contador, secuencia ni cálculo basado en cantidad de documentos.
- El contrato fuerza `documentType: internal-receipt`, `isCfdi: false`, `currency: MXN`, `status: active`, `paymentStatus: not_recorded` y todos los importes/método de pago en `null`.
- Solo Admin crea mediante transacción. Una sesión debe estar completada y su reporte enviado; IDs, Customer, Walker, perros, servicio y horario deben coincidir. Un reintento idéntico es idempotente y uno distinto falla con conflicto.
- Admin/Supervisor listan como máximo 50; Customer propietario y Walker activo actualmente asignado solo hacen `get` puntual. Tickets y eventos no se actualizan ni eliminan desde el navegador.
- Eventos permitidos: `payload_exported`, `operator_confirmed` y `failed`; `printed` no existe porque FF02 Write Without Response no confirma papel. El hash SHA-256 y el tamaño describen el payload; imprimir/reimprimir no crea movimientos financieros.
- Reglas activas: `0a64444e-b676-4112-a616-bddd48803b58`, SHA `d079c7cd16f65cd14ce48812af69250d7025b614f5396d869f718514de3db6a0`; 12 índices `READY`, sin índice nuevo.
- Validación: T2 unit/runtime 26/26, suite 418/418, emulador focal 5/5, build autoritativo 53/53. Codex Security `e0023165-ea85-40ec-bab2-37201420ad61`: 0 hallazgos; las reglas omitidas por su inventario fueron revisadas manualmente y ejercitadas en emulador.
- Payload aislado de 17 archivos: `/private/tmp/pet-t2-runtime.5b8qnL`; manifiesto SHA `7f42f6e0ff2384a3a9c937f77b30ebbb1880047ba048574d5a22bb97c9a51ff8`. El build aislado compila, pero el prerender local no recibe las variables públicas excluidas deliberadamente; Production/Preview sí las administra Vercel.
- Publicación: Vercel CLI temporal `59.5.0`; Preview `dpl_2crB4nhkxNhuXTMFeorCMncu1NDn`; Production derivado `dpl_8pSTBxrkeUjRrz8KtA32ccU4DK45`; alias estable confirmado. Rollback manual `dpl_EC8yYszuaGVHozxPix8oqDiu5uHB`.
- Build remoto 53/53; rutas públicas 200, rutas privadas 307 a su entrada, `pet-ap-static-v3` excluye paneles privados y Vercel no reporta errores de runtime. No existen tickets o eventos reales creados automáticamente.
- Siguiente gate T2: creación manual Admin de un único ticket para una sesión completada con reporte enviado; exportación/reimpresión y prueba física nRF Connect. T3 de pagos/ledger continúa sin iniciar.

## Evidencia autenticada y mejora visual local — 26-ago-2026

- La sesión `CXlmRT…Q1Ph` conserva un único reporte `submitted` y un único ticket determinista con relaciones coherentes.
- El ticket cumple el contrato exacto: recibo interno, no CFDI, pago no registrado e importes en `null`; el reintento no creó un segundo documento.
- Se registró exactamente un evento `payload_exported`: 982 bytes, SHA-256 `53339c8153e55ce8a2084bd5d251d657207288dce183bedf6afe3b8710e721f9`. La impresión física continúa sin confirmar.
- El rediseño local sustituye la huella por el perrito geométrico PET Ap tanto en la vista térmica como en el raster ESC/POS, compacta la jerarquía del recibo y elimina el fallback visual “Pendiente (legacy)” para estados T2.
- Validación local del rediseño: typecheck/lint PASS, 26/26 pruebas focalizadas, 418/418 suite y build/prerender 53/53. No se creó otro ticket, evento, pago o movimiento.
- Estado: aceptación lógica PASS; acceso Familia/Walker y prueba física nRF Connect continúan pendientes. El rediseño no está publicado.

## Cierre físico T2 — 27-ago-2026

- El propietario confirmó papel completo, logo, texto y QR correctos.
- Se registró exactamente un evento manual e idempotente `operator_confirmed` para `CXlmRT…Q1Ph`: identificador abreviado `operator-confirmed-22f558f4…`, modo `reprint`, 2964 bytes y hash `22f558f4f5e29577b805e5e18ca11067af57f57e8ae5285705060723656c83a7`.
- Read-back: `ticketWrites: 0`, `financialWrites: 0`; no se creó ticket, reporte, pago ni movimiento adicional. T2 queda con aceptación física PASS.

## R1/G1 local — 27-ago-2026

- R1 reduce la reserva a Servicio → Perro/dirección → Fecha/slot → Revisión; `appSettings/bookingSchedule` controla zona horaria, intervalo, anticipación, horario semanal y fechas cerradas. El submit vuelve a comprobar perro, dirección, zona, servicio y slot antes de crear referencias o batch.
- G1 usa firma Cloudinary server-only con claim Admin, `fl_strip_profile`, UUID opaco, borrador/consentimiento/derechos/publicación/retiro y proyección pública mínima desde `/api/gallery` dinámica. Firestore directo queda limitado a Staff; el público no enumera borradores.
- Validación final local: typecheck/lint PASS, focal 6/6, suite 425/425, emulador focal R1/G1 7/7, build/prerender 54/54 y Codex Security `cb5d9d56-cf6f-45dd-9c02-dddd42fa65e1` sin hallazgos. La línea `force-dynamic` posterior al snapshot fue revisada manualmente.
- Pendiente externo: comprobar presencia (sin revelar valores) de `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` y credenciales server-side Firebase en Vercel; capturar el horario comercial real desde Admin. No se inventan horarios.

## R1 por etapas — 28-ago-2026

- Se publicó exclusivamente la capacidad de configuración de agenda. Ruleset activo `ef451527-a4c1-4926-b8af-0f6ec441ecd4`, SHA `8634a6ea00ee87667d821db79b5e64b6e92d1269ff01cd213d5e19b51ffbf48e`; 12/12 índices `READY`.
- Payload runtime de tres archivos: `AdminBookingSchedule.tsx`, `AdminConfig.tsx` y `bookingSchedule.ts`. Preview `dpl_8PDNYNfek3j3jtFkLED89sRNksyE`; Production `dpl_4ZWAgtnBecnsj6oiqfW9BvZL9Z4p`; rollback `dpl_AxdiYHuQHW4kNhY5k3dBVeJEKXDX`.
- Build remoto 53/53, rutas/redirects, logs y service worker PASS. El flujo de reserva Familia no cambió: se activará R1 únicamente después de que Admin capture datos comerciales reales.
- G1 permanece `BLOCKED_OWNER`: las cuatro variables server-only requeridas no están configuradas; no se promovió el Preview completo ni se habilitó un fallback inseguro.
- Tras la confirmación humana de captura, se publicó el runtime R1 de nueve archivos: Preview `dpl_BYkSs7ZwakvavjVkUXc6ZLwGncVJ`, Production `dpl_AXch6xnpxekrUzLGWRr5bgR2CyPT`, rollback `dpl_4ZWAgtnBecnsj6oiqfW9BvZL9Z4p` y manifiesto SHA `5ae31c11d80b96200b4da75b95324eba1022cf655d106369706bb67c9f56423e`.
- Gates R1: 21/21 focales, typecheck/lint PASS, build remoto 53/53, rutas/redirects/logs/service worker PASS. No se creó ninguna reserva durante la publicación; queda QA autenticada manual hasta confirmación, sin enviar.

## Cierre G1 — 29-ago-2026

- Variables Cloudinary quedaron disponibles en Production sin exponer valores. El Production vigente `dpl_sozWckpcWDftmUEqXpQv8DLB9zhV` deriva del Preview G1 `dpl_5wSFT34V7p7ojeRaK4ewf1eKAgkC` y sirve `pet-euhz.vercel.app`.
- Ruleset G1 activo `92037591-177a-4f8f-a1b0-db4add3dcab4`, SHA `d4ea2e63cb7b1033f919b378f5dc9e35dc901dc8e3865402b4d363b1ed03a95d`; 12/12 índices `READY`, facturación desactivada.
- Build 54/54; firma sin token `401`; rutas, redirects, logs, service worker y responsive 390/430/768/1024/1440 PASS.
- No se cargó ningún asset ni se escribió metadata. La siguiente prueba G1 es manual: Admin selecciona una imagen autorizada y valida hasta el punto previo al upload o publica una sola imagen con consentimiento explícito.

## Compatibilidad legacy de galería — 31-ago-2026

- Este cierre no cambia reportes, tickets, ESC/POS ni finanzas. Añade únicamente lectura defensiva de `gallery-images` y su presentación administrativa.
- Production `dpl_3UKuaScTnkEhVy3c2Mc8MwZC75W7`; rollback `dpl_sozWckpcWDftmUEqXpQv8DLB9zhV`. Cero escrituras de documentos, pagos, tickets o eventos.

## O1 — navegación compartida publicada (1-sep-2026)

- Reportes, tickets, snapshots ESC/POS, `printEvents` y contratos financieros no cambiaron.
- `/admin/reportes` quedó visible dentro del grupo Operación; tickets y prueba de impresión permanecen en Cobros, sin ampliar permisos ni añadir consultas.
- Preview `dpl_6PXCey3Swi3vULMFLT4cC18uw2gB`; Production `dpl_Gzys5ZJwnN9Rta2dTZgktvCX11L1`; rollback `dpl_3UKuaScTnkEhVy3c2Mc8MwZC75W7`.
- El siguiente dominio T3 debe usar el ticket T2 como snapshot inmutable y nunca convertir una reimpresión en pago o movimiento. Sin backend privilegiado aprobado, pagos y ledger continúan desactivados de forma segura.
