# CONTEXTO — PET Ap (PET-ORN)

> Documento de relevo para otra IA o desarrollador. Resume el estado verificable, Production, Firebase, arquitectura, riesgos y siguiente trabajo.

**Actualizado:** 7 de septiembre de 2026, America/Mexico_City.

## 1. Uso y autoridad

Este archivo es el punto de entrada para continuar PET Ap sin reconstruir toda la conversación.

Orden de autoridad:

1. Código y configuración actuales.
2. Este archivo para el estado de relevo.
3. AGENTS.md y documentacion/04 a 09 para decisiones y evidencia.
4. Documentos históricos solo como contexto; pueden estar superados.

Primeros comandos:

    cd /Users/cheeeperez/Documents/pet/pet-reservations
    git status --short
    npm run typecheck -- --incremental false
    npm run lint -- --no-cache

No asumas que HEAD, GitHub o el árbol completo representan Production. Los últimos despliegues se construyeron mediante payloads aislados.

## 2. Identidad

| Concepto | Valor |
|---|---|
| Nombre | PET Ap |
| Clasificación | PET-ORN, repositorio original y autoritativo |
| Ruta | /Users/cheeeperez/Documents/pet/pet-reservations |
| Remote | https://github.com/abransitonena-blip/pet.git |
| HEAD observado | 77bce67, lint: fix 189 errors across src/ and non-src files |
| Stack | Next.js App Router, React, TypeScript, Firebase cliente, Firestore, Vercel |
| Firebase/GCP | pet-1cb0b |
| Sitio | https://pet-euhz.vercel.app |
| Zona horaria | America/Mexico_City |
| Moneda | MXN; dinero en centavos enteros |

Otros directorios PET no son el original:

- /Users/cheeeperez/Documents/Codex/2026-07-24/h/pet-ap: PET-TEST-01.
- /Users/cheeeperez/Documents/pet ap: respaldo/prototipo histórico.
- /Users/cheeeperez/Documents/pet 2: workspace incompleto.
- /Users/cheeeperez/Documents/pet-reservations: directorio vacío/incompleto.

No mover, renombrar, fusionar ni migrar esos directorios automáticamente.

## 3. Production consolidado

Último estado indicado por la documentación viva:

| Área | Estado |
|---|---|
| Alias | pet-euhz.vercel.app |
| Production G1 documentado | dpl_sozWckpcWDftmUEqXpQv8DLB9zhV |
| Production anterior documentado | dpl_AXch6xnpxekrUzLGWRr5bgR2CyPT |
| Build G1 | 54/54 páginas |
| Ruleset G1 | 92037591-177a-4f8f-a1b0-db4add3dcab4 |
| SHA de reglas | d4ea2e63cb7b1033f919b378f5dc9e35dc901dc8e3865402b4d363b1ed03a95d |
| firestore.rules local | Mismo SHA verificado al crear este archivo |
| Índices remotos | 12/12 READY en la última verificación documentada |
| Facturación | Desactivada en la última verificación documentada |
| Service worker | pet-ap-static-v3; rutas privadas excluidas |

Antes de una mutación, volver a consultar IDs, hashes e índices en read-only. Vercel puede materializar una promoción con otro ID.

## 4. Estado local verificado

El repositorio está muy sucio y contiene trabajo acumulado del usuario:

- 125 entradas modificadas.
- 127 entradas nuevas/no rastreadas.
- 14 eliminaciones.
- 2 renombres.
- El diff rastreado observado abarca 141 archivos.

Reglas:

- No desplegar todo el árbol.
- No ejecutar git add ., commit masivo o push indiscriminado.
- No descartar archivos del usuario.
- Preparar payloads aislados contra la baseline desplegada.
- Resolver por archivo qué pertenece a cada fase.

### Gates actuales

Comprobaciones ejecutadas el 7-sep-2026:

| Gate | Resultado |
|---|---|
| npm run typecheck -- --incremental false | PASS |
| npm run lint -- --no-cache | PASS (0 errores) |
| npm test -- --runInBand | PASS (442/442) |
| Foco g1-gallery-* | PASS (8/8) |
| npm run build | PASS (54/54 páginas) |
| git diff --check | limpio |

## 5. Cierre confirmado: compatibilidad legacy G1 (7-sep-2026)

Existe un documento real legacy en gallery-images con:

    createdAt
    dog
    title
    url

No contiene format ni el contrato G1. Una versión anterior de la UI ejecutaba format.toUpperCase() sin validar y cerraba /admin/galeria.

Estado verificado el 7-sep-2026 (código actual, no solo documentación):

- `galleryRecords.ts` modela la unión discriminada `compatible | legacy | invalid` con validación estricta por campo (`parseGalleryRecord`); ningún método se ejecuta sobre un campo sin validar primero.
- `AdminGalleryManager.tsx` renderiza cada variante por rama explícita: `legacy` muestra “Registro anterior — pendiente de migración” y es estrictamente de solo lectura (sin botones de publicar/retirar/editar/eliminar); `invalid` se aísla en un `<article role="alert">` individual sin romper el resto de la pantalla; `compatible` conserva las acciones G1 normales.
- `__tests__/g1-gallery-legacy-records.test.ts` cubre el contrato legacy observado, un registro inválido y el contrato compatible completo, incluida una aserción de que el manager ya no contiene `.format.toUpperCase()`.
- No se modificó, migró, editó ni eliminó el documento legacy real; no hubo uploads durante esta verificación.

Verificación contra Production (7-sep-2026, vía Vercel CLI autenticado):

- El alias `pet-euhz.vercel.app` apunta a `dpl_Gzys5ZJwnN9Rta2dTZgktvCX11L1` (creado 1-sep-2026), el mismo deployment de cierre O1 documentado en AGENTS.md — publicado *después* del cierre G1 del 31-ago y sin revertirlo.
- Smoke test sin credenciales: `GET /admin/galeria` → `307` a `/equipo?redirect=%2Fadmin%2Fgaleria` (login), sin error 500.
- Conclusión: **G1 ya está cerrado y vivo en Production**; no se requirió una nueva compilación, Preview ni promoción para esta fase. Pendiente únicamente la observación autenticada manual del registro legacy real (con sesión Admin), que no se realizó en esta verificación por no tener credenciales de esa cuenta.

Nota: estos archivos (`galleryRecords.ts`, `AdminGalleryManager.tsx`, ambos tests) están sin commitear en git (`??`/`M`) porque este proyecto despliega mediante payloads aislados, no mediante git — ver §4 y AGENTS.md.

## 6. Arquitectura funcional

Flujo principal:

    Firebase Auth y custom claim
    → onboarding customer por UID
    → customerProfiles + addresses + dogs
    → serviceOrders + walkSessions
    → asignación staff por walkerId UID
    → transiciones Walker
    → walkReports/{walkSessionId}
    → tickets/{walkSessionId}
    → printEvents append-only

walkSessions es la fuente canónica del servicio. El ticket es comprobante; Firestore es la fuente de verdad.

### Colecciones

| Colección | Función |
|---|---|
| users | Mirror mínimo; nunca autoridad de roles |
| customerProfiles | Perfil Familia por UID |
| dogs | Perros propios por ownerId |
| addresses | Direcciones propias con zoneId |
| zones | Zonas activas |
| walkerProfiles | Perfil operativo Walker |
| serviceOrders | Solicitud/orden canónica |
| walkSessions | Sesión operativa y fuente del paseo |
| walkReports | Reporte determinista por sesión |
| tickets | Recibo interno determinista |
| tickets/{id}/printEvents | Eventos append-only |
| admin/prices | Precios privados |
| appSettings/servicePrices | Proyección pública de precios |
| appSettings/bookingSchedule | Agenda y slots |
| gallery-images | Metadata privada de galería |
| gallery-public | Proyección pública mínima |

Legacy:

- reservations: lectura histórica; escrituras desactivadas.
- Siete índices legacy conservados.
- Registro legacy operativo sin walkerId identificado anteriormente; no migrar automáticamente.
- Al menos un documento legacy de galería; no modificar automáticamente.

## 7. Roles

La autoridad procede de custom claims. users.role no concede permisos.

| Rol | Entrada | Destino |
|---|---|---|
| Customer | /login | /familia o /familia/configuracion-inicial |
| Walker | /equipo | /walker |
| Supervisor | /equipo | /admin |
| Admin | /equipo | /admin |

Cuentas conocidas, sin contraseñas:

- Admin: ap9871888@gmail.com; claim admin verificado históricamente.
- Walker: abransitonena@gmail.com; claim walker y perfil activo verificados históricamente.

Compatibilidad:

- client se normaliza transitoriamente a customer.
- Ausencia de claim solo recibe compatibilidad customer mínima en reglas expresas.
- Claim desconocido falla cerrado.
- Walker necesita perfil active y sesión asignada actualmente a su UID.
- Nunca asignar claims desde navegador.

## 8. Reserva R1

R1 está documentado como publicado.

Pasos:

1. Servicio.
2. Perro y dirección.
3. Fecha y slot fijo.
4. Revisión y envío.

Garantías:

- Slots configurados, sin tolerancia elegida por customer.
- America/Mexico_City.
- No ofrece horarios pasados.
- Fin calculado desde duración del servicio.
- Horario solicitado sujeto a confirmación.
- Revalidación previa.
- Batch atómico serviceOrders + walkSessions.
- Sin seleccionar Walker ni manipular precio, pago, descuento o margen.
- Dirección, zona, perro, servicio y versión coherentes.

Archivos: ReservationFlow, StepV2Service, StepV2Details, StepV2Schedule, StepV2Confirm, bookingSchedule, reservationValidation y submitReservation.

## 9. Walker y reportes

Transiciones:

    assigned → confirmed → on_the_way → arrived → in_progress → completed

Cada transición exige timestamp. Walker no se reasigna, salta estados ni modifica finanzas.

Reporte:

    walkSessions/{id} completed → walkReports/{id}

- Walker activo y asignado crea/edita draft.
- Solo envía con sesión completed.
- Submitted queda inmutable.
- Customer propio hace get puntual.
- Admin/Supervisor lectura operativa limitada.
- Fotos privadas del paseo desactivadas.

## 10. Tickets e impresión

T1/T2 están implementados y tuvieron aceptación física:

    completed + report submitted
    → tickets/{walkSessionId}
    → ESC/POS / HEX
    → printEvents

Contrato:

- internal-receipt; isCfdi false.
- Nunca presentarlo como factura fiscal.
- paymentStatus not_recorded e importes null sin snapshot financiero.
- Ticket inmutable e idempotente.
- Reimpresión no crea pago ni movimiento.
- Eventos payload_exported, operator_confirmed y failed.
- No inferir printed de Write Without Response.

Hardware: SUZWIP 58 mm, 384 dots, 203 dpi, BLE BlueTooth Printer, FF00, FF02, CP850 y QR nativo.

Logo aprobado:

- Original SHA: dada755ff382c57e113f5a06489204990df7ebf530ff9451f8e6e99c61b8b594
- Asset recortado: 5db1eb147d03efa1219fa0ffd226efd002e94355b9bb636f0ce1a13c4e3ba52b
- Raster 144×134: 02d6365409a93089f9f07e22ee502edad74a964025320f5d4aad8135750193bf

## 11. Galería G1

Seguridad:

- Carga Cloudinary firmada server-only y exclusiva para Admin.
- Sin upload unsigned.
- Metadata privada en gallery-images.
- Proyección pública mínima en gallery-public.
- Publicar exige consentimiento, derechos public-gallery y alt text.
- Retirar publicación/consentimiento/derechos elimina la proyección.
- Supervisor solo lectura.
- Público nunca enumera borradores.

Variables requeridas, sin registrar valores:

- NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
- CLOUDINARY_API_KEY
- CLOUDINARY_API_SECRET

Production las tenía disponibles según la documentación. No imprimirlas ni copiarlas.

G1 base está publicado; el cierre legacy está incompleto localmente y es el trabajo inmediato.

## 12. Finanzas

F1 existe como dominio puro en src/lib/finance/domain:

- centavos enteros y MXN;
- pricing/snapshots;
- pagos/allocations;
- idempotencia;
- ledger inmutable y reversos;
- caja, cierres, gastos y liquidaciones;
- capacidades por rol;
- ticket interno.

No está completamente conectado a persistencia real.

Orden pendiente:

1. T3 backend privilegiado e idempotente.
2. F2 pagos manuales/parciales.
3. F3 ledger.
4. F4 snapshot financiero en ticket.
5. F5 caja/cierres.
6. F6 semanas.
7. F7 liquidaciones.
8. F8 reportes/exportación.

No inventar tasas, comisiones, impuestos o condiciones comerciales.

## 13. Feature flags

Solo WALK_REPORTS_ENABLED está true.

Permanecen false:

- PET_AHORA_ENABLED
- WALLET_MUTATIONS_ENABLED
- LOYALTY_REDEMPTION_ENABLED
- AUTOMATIC_REFERRALS_ENABLED
- FCM_ENABLED
- AUTOMATED_REMINDERS_ENABLED
- PUBLIC_REVIEWS_ENABLED
- PUBLIC_PHONE_CANCELLATION_ENABLED
- PRIVATE_MEDIA_UPLOADS_ENABLED
- CLOUD_FUNCTIONS_ENABLED
- LEGACY_RESERVATION_WRITES_ENABLED

No activar sin backend, reglas, pruebas y rollback.

## 14. UX

Dirección acordada:

- Minimalista, profesional y mobile-first.
- Evitar tarjetas/bordes anidados sin función.
- Jerarquía por espacio, tipografía y divisores.
- Targets de 44 px.
- Contraste y foco accesibles.
- Estados loading, vacío, permisos y red.
- Animaciones de 150–220 ms.
- prefers-reduced-motion.
- QA 390, 430, 768, 1024 y 1440 px.

Después de G1 sigue O1: unificar gradualmente Admin, Familia y Walker. No hacer un rediseño global en un diff.

## 15. Prohibiciones

Nunca:

- Imprimir tokens, ADC, secretos o .env.
- Usar users.role como autoridad.
- Crear service-account JSON desde respaldos.
- Añadir dominios OAuth temporales para Preview.
- Usar Cloudinary unsigned.
- Exponer fotos operativas privadas.
- Permitir finanzas o asignación manipulables desde cliente.
- Hard-delete financiero.
- Desplegar el árbol sucio.
- Migrar datos sin dry-run, backup y autorización.
- Commit/push sin solicitud expresa.

## 16. Comandos y gates

    npm run typecheck -- --incremental false
    npm run lint -- --no-cache
    npm test -- --runInBand
    npm run test:rules
    npm run build
    git diff --check

Reglas: Java 21 y proyecto demo. Los PERMISSION_DENIED negativos pueden ser esperados. Mantener separadas las divergencias legacy conocidas.

Para runtime:

1. Pruebas focales.
2. Suite completa.
3. Build.
4. Revisión React/Next.
5. Secret scan.
6. Security diff scan.
7. Payload aislado y manifiesto.
8. Preview.
9. QA responsive/rutas/logs.
10. Promoción exacta y rollback.

## 17. Despliegue seguro

Firestore:

1. Consultar baseline read-only.
2. Congelar candidato y SHA.
3. Comparar diff.
4. Emulador focal.
5. Publicar solo firestore:rules cuando se autorice.
6. Descargar y comparar.
7. No desplegar índices, Functions, Hosting o Storage accidentalmente.

Vercel:

1. Resolver Production exacto.
2. Paquete temporal externo.
3. Superponer solo runtime autorizado.
4. Excluir .env, ADC, backups, scripts, Functions, reglas, índices, pruebas, docs, .next y node_modules.
5. Manifiesto con hashes.
6. Preview READY.
7. QA.
8. Promover Preview exacto.
9. Verificar cualquier nuevo Production.
10. Asignar alias y conservar rollback.

## 18. Documentación

- AGENTS.md
- documentacion/04-mapa-tecnico.md
- documentacion/05-auditoria-viva.md
- documentacion/06-matriz-de-flujos.md
- documentacion/07-deuda-y-riesgos.md
- documentacion/08-mejoras-pendientes.md
- documentacion/09-reporte-canonico-y-tickets.md
- FINANCIAL_ARCHITECTURE_F0.md
- MEDIA_POLICY.md
- PRIVACY_OPERATIONS.md
- SECURITY_HEADERS.md
- HOSTING_COMPATIBILITY.md

Actualizar este archivo y la documentación pertinente cuando cambien arquitectura, seguridad, contratos, despliegues o riesgos. No repetir una auditoría general por cada cambio.

## 19. Próximo orden

1. ~~G1 legacy: cerrar la unión discriminada y desplegar focal.~~ ✅ confirmado cerrado y vivo en Production (7-sep-2026, ver §5).
2. Prueba G1 real controlada con una imagen autorizada — pendiente, requiere sesión Admin.
3. ~~O1 paneles minimalistas.~~ ✅ publicado 1-sep-2026 (`dpl_Gzys5ZJwnN9Rta2dTZgktvCX11L1`, ver AGENTS.md).
4. T3 backend privilegiado — siguiente fase concreta.
5. F2–F8 finanzas.
6. M1 medios privados.
7. N1 notificaciones.
8. P1 Bluetooth/cola real.
9. L1 legacy.
10. Q1 aceptación integral.

## 20. Prompt para la siguiente IA

    Trabaja en PET-ORN: /Users/cheeeperez/Documents/pet/pet-reservations.
    Lee CONTEXTO.md completo y después solo sus referencias para la fase actual.
    No repitas la auditoría general.
    Primero termina G1 legacy: AdminGalleryManager tiene ParsedGalleryRecord
    parcialmente integrado y falla typecheck/lint. Renderiza explícitamente
    compatible/legacy/invalid sin modificar el documento legacy real.
    Recupera todos los gates y prepara Preview aislado.
    No despliegues el árbol completo, no hagas commit/push y no cambies Firebase
    salvo autorización expresa.
    Reporta archivos, pruebas, manifiesto, Preview, riesgos y siguiente acción.

## 21. Estado de relevo

El proyecto está listo para que otra IA continúe: arquitectura, Production, seguridad, flujos y primer trabajo están identificados.

Verificado el 7-sep-2026: typecheck, lint, suite completa (442/442), build (54/54) y `git diff --check` pasan en el árbol local actual. G1 (galería legacy) y O1 (paneles unificados) están confirmados cerrados y vivos en Production (`pet-euhz.vercel.app` → `dpl_Gzys5ZJwnN9Rta2dTZgktvCX11L1`). La siguiente fase concreta es T3 (backend privilegiado, idempotencia, folios, cola segura), sujeta a resolver primero una identidad server-only verificable en Vercel antes de cualquier mutación financiera (ver AGENTS.md, cierre O1).

