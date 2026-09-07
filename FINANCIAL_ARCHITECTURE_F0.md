# PET Ap — F0: auditoría y arquitectura financiera propuesta

Estado: **solo diseño; no implementado**

Fecha de revisión: 2026-08-08
Alcance: Caja, finanzas, pagos, movimientos, tickets, folios, cierres, liquidaciones e impresión.

Este documento no es asesoría fiscal, contable ni jurídica. Las decisiones marcadas para contador o abogado deben resolverse profesionalmente en México antes de operar comercialmente.

## 1. Principios aprobados

- `serviceOrders` representa la compra o paquete.
- `walkSessions` es la fuente canónica de cada paseo y se vincula a `serviceOrders`; no se creará un modelo `Walk` duplicado.
- `reservations` permanece legacy y solo lectura.
- Todo importe monetario se almacenará como entero en centavos y con `currency: "MXN"`. No se usarán flotantes para dinero.
- Los Créditos PET y puntos de lealtad son promocionales, no dinero ni saldo retirable. No entran a caja como efectivo.
- `financialMovements` será append-only. Una corrección crea reverso o ajuste compensatorio; nunca reescribe ni elimina el movimiento original.
- Tickets, cierres y liquidaciones conservan snapshots históricos.
- Reimprimir nunca crea pagos, movimientos ni folios.
- Toda mutación financiera requiere un backend privilegiado, claims/capacidades, idempotencia y auditoría. El navegador solo solicita comandos y realiza lecturas autorizadas.
- El comprobante PET Ap es un ticket interno, no un CFDI ni una factura.
- Se usará “resultado operativo estimado”, nunca “utilidad fiscal”.

## 2. Inventario financiero actual

| Elemento | Estado actual | Evidencia | Evaluación |
|---|---|---|---|
| `serviceOrders` | Existe; compra/paquete, creada junto con sesiones. Tiene estado de pago y campos financieros opcionales | `src/types.ts:25`, `src/lib/submitReservation.ts:71`, `firestore.rules:387` | Ampliable; debe recibir snapshots y resúmenes derivados, no ser el libro mayor |
| `walkSessions` | Existe como paseo canónico y referencia `orderId` | `src/types.ts:51`, `src/lib/submitReservation.ts:86`, `firestore.rules:452` | Ampliable; no duplicar con `Walk` |
| `reservations` | Legacy mezcla servicio, paseo, pago y asignación | `src/types.ts:90`, `firestore.rules:508` | Solo lectura; no usar como fuente financiera |
| Precios | Documento público `admin/prices`, escrito desde navegador admin; valores `number` sin unidad/moneda/versión | `src/context/PricesContext.tsx:7-42`, `firestore.rules:762` | No apto como histórico ni autoridad de cobro |
| Cotizador | Contiene fallback, multiplicadores, impuesto, margen, reparto y cancelación codificados sin decisión aprobada | `src/lib/walkServices.ts:140-211` | No confiable; no reutilizar en F1 sin especificación aprobada |
| Pagos | Solo campos `paymentStatus`; no existe entidad ni evidencia de pago | `src/lib/domainStates.ts:24`, `src/types.ts:42`, `src/types.ts:140` | Entidad nueva necesaria |
| Dashboard financiero | Deriva “ingresos/cobrado/ticket” de reservas completadas y del precio vigente | `src/app/admin/finanzas/page.tsx:47-112` | Métricas no contables; no usar para cierres |
| Cupones | Existe colección/UI; UI usa `discount`, reglas esperan `value`; mutación y delete directos | `src/components/AdminCoupons.tsx:47-99`, `firestore.rules:739-757` | Esquema incompatible; validación y canje privilegiados pendientes |
| Referidos | Automatización apagada, pero el código legacy conserva monto fijo y reglas incompletas | `src/app/admin/referidos/page.tsx:57-102`, `functions/index.js:331-361` | Mantener aislado; futura recompensa idempotente después de pago y paseo completado |
| Créditos PET | Lectura de wallet existente; mutaciones apagadas | `src/lib/useWallet.ts:34-88`, `firestore.rules:861` | Mantener separado del efectivo; ledger promocional posterior |
| Lealtad | Lectura y revisión manual; callable legacy concede puntos/canje sin modelo financiero nuevo | `src/components/LoyaltyProgram.tsx:38-91`, `functions/index.js:788-827` | Manual durante MVP; no convertir puntos a dinero |
| Cancelación/reembolso | Estados parciales y textos contradictorios de 2 h/24 h; no hay entidad de reembolso | `src/lib/walkServices.ts:153`, `src/app/preguntas-frecuentes/PublicFAQ.tsx:35`, `src/app/familia/ayuda/page.tsx:72` | Política y tratamiento contable pendientes |
| Auditoría | Reglas bloquean escritura cliente; dos helpers cliente silencian el fallo; CF legacy sí puede escribir | `src/lib/audit.ts:4-19`, `src/lib/auditLog.ts:16-31`, `firestore.rules:922` | Crear auditoría financiera privilegiada e inmutable |
| Exportación | CSV se genera en navegador usando precio vigente y datos personales | `src/app/admin/finanzas/page.tsx:104-118` | No es exportación contable; requiere snapshots, permisos y defensa contra CSV injection |
| Tickets/folios/cierres/liquidaciones/gastos/propinas/comisiones/impresión | No existen modelos ni backend | búsqueda F0 en `src`, `functions`, reglas e índices | Entidades nuevas o decisiones pendientes |
| Rol CAJA | No existe; roles actuales: customer, walker, supervisor y admin | `src/lib/roles.ts:9-21`, `functions/index.js:61` | Nuevo claim y capacidades explícitas en una fase posterior |

## 3. Inconsistencias y riesgos que bloquean F1

1. **Crítico — importes sin unidad canónica.** Los campos son `number` y se usan como pesos, porcentajes y cálculos con multiplicadores. No existe sufijo `Cents`, validación de entero ni moneda por documento.
2. **Crítico — cálculos no aprobados.** El cotizador conserva base 150, impuesto 8 %, reparto 70 %, margen 30 %, multiplicadores y política de cancelación. No tienen fuente aprobada y no deben migrarse.
3. **Crítico — cobro inferido.** “Cobrado” se calcula a partir de `reservation.paymentStatus == paid` y del precio actual, no de pagos confirmados ni snapshots.
4. **Alto — mutación financiera en navegador.** Precio y cupones se administran con SDK cliente. Las reglas permiten a admin cambiar totales, descuentos y pago de `serviceOrders` directamente.
5. **Alto — estados incompatibles.** Legacy usa `pending|paid`; el modelo canónico usa `pending|proof_uploaded|under_review|confirmed|rejected|refunded`.
6. **Alto — cupones incompatibles.** El frontend escribe `discount`; reglas admiten `value`. No hay consumo atómico, margen mínimo ni idempotencia.
7. **Alto — referidos legacy.** La Function legacy recompensa al completar una `reservation`, sin comprobar pago, cliente nuevo, límite mensual, vigencia ni clave idempotente.
8. **Alto — wallet legacy.** Las callables usan IDs aleatorios y aceptan una deducción iniciada por cliente; no hay centavos, moneda, expiración ni operación idempotente.
9. **Alto — auditoría aparente.** Helpers cliente intentan escribir `audit-logs`, las reglas lo deniegan y el error se oculta.
10. **Medio — política de cancelación contradictoria.** El sitio declara ventanas diferentes y no existe un modelo de reembolso.
11. **Medio — reportes derivados globalmente.** Finanzas, analítica, IA y LTV reconstruyen importes con precios actuales; los resultados históricos cambian al editar tarifas.
12. **Medio — CSV no contable.** No incluye IDs de pago/movimiento, moneda, snapshots, reversos ni trazabilidad, y necesita neutralización de fórmulas.
13. **Contención confirmada.** PET Ahora conserva un precio hardcodeado en código legacy, pero su feature flag bloquea listeners y escrituras. No debe habilitarse ni alimentar F1.

## 4. Mapa entidad-relación propuesto

```text
serviceOrders (compra/paquete)
  └── 1..N walkSessions (paseo individual canónico)

payments ── 1..N paymentAllocations ──> serviceOrder / walkSession
    │
    └── 1..N financialMovements (append-only)
                     ├── tickets
                     ├── cashClosings (snapshot de movimientos incluidos)
                     └── walkerSettlements (snapshot de sesiones y movimientos)

expenses ──> financialMovements
tickets ──> printJobs
folioCounters ──> folios visibles PET/TKT/CIE/LIQ
financialAuditLogs ──> recibo idempotente y evidencia de cada comando
```

`paymentAllocations` es recomendable desde el inicio si se aceptarán pagos parciales, varios medios de pago, paquetes o un pago aplicado a más de una orden/sesión. Si el propietario confirma que cada pago cubre exactamente una orden, puede posponerse, pero no debe incrustarse una suposición irreversible.

## 5. Contratos de entidades

Todos los documentos financieros incluyen `createdAt`, `createdByUid`, `currency: "MXN"`, versión de esquema y referencias por ID; los timestamps son del servidor. Los campos monetarios terminan en `Cents` y son enteros seguros no negativos salvo movimientos firmados.

### Extensiones de entidades existentes

#### `serviceOrders`

- Conserva su ID interno y relación 1:N con `walkSessions`.
- Campos mínimos actuales que siguen siendo útiles: `customerId`, `dogIds`, `serviceId`, `numberOfSessions`, `addressId` y estado canónico.
- Extensión propuesta: folio `PET-…`, `currency`, `pricingSnapshot` versionado, subtotales/totales `*Cents`, IDs de allocations y resumen financiero **derivado**.
- El snapshot captura servicio, tarifa/version, descuento/cupón aprobado y vigencia; no se recalcula con `admin/prices` al consultar históricos.
- Índices base existentes por customer/status/createdAt pueden ampliarse con folio y estado de pago cuando existan las consultas finales.
- Customer nunca escribe totales, descuentos, margen, folio, pago o asignación. CAJA tampoco edita el documento directamente; el backend aplica comandos.
- Correcciones financieras no reescriben el snapshot confirmado: enlazan ajuste, reverso o versión reemplazante.
- Retención financiera pendiente de contador/abogado; no hard delete.

#### `walkSessions`

- Sigue siendo la única entidad del paseo individual; no crear `Walk`.
- Conserva `orderId`, `customerId`, `dogIds`, `addressId`, `walkerId`, agenda y máquina de estado operativa.
- Extensión propuesta: snapshot mínimo del servicio/paseador, elegibilidad financiera derivada y referencias a allocations/liquidación; no duplicar un saldo mutable.
- Una sesión solo es elegible para recompensa/liquidación cuando esté `completed` y el pago aplicable esté confirmado, según política aprobada.
- Índices actuales por customer/walker/order y fecha son una base; liquidaciones requerirán `walkerId+status+completedAt` y protección contra doble inclusión.
- Customer y walker nunca cambian precio, descuento, pago, comisión ni liquidación. El walker solo mantiene transiciones operativas autorizadas.
- Una corrección financiera no altera horas o reporte histórico del paseo.
- Retención financiera/operativa pendiente de política profesional; no migrar legacy automáticamente.

### `payments` — nueva

- **Finalidad:** evidencia de recepción, rechazo o reembolso de un pago; no sustituye el movimiento contable.
- **Colección superior/ID:** `/payments/{paymentId}`; ID interno aleatorio e inmutable.
- **Relaciones:** customer, serviceOrder; allocations; movimientos; ticket.
- **Mínimos:** `customerId`, `method`, `amountCents`, `currency`, `status`, `receivedAt`, `referenceMasked`, `idempotencyKeyHash`.
- **Snapshot:** pagador presentado, método/terminal/caja, orden y total confirmado; nunca credenciales completas.
- **Estados:** `pending → proof_uploaded → under_review → confirmed`; `under_review → rejected`; `confirmed → refunded` solo cuando el reverso esté confirmado. Pago parcial/reembolso parcial requiere decisión explícita.
- **Índices:** `customerId+createdAt desc`, `serviceOrderId+createdAt desc`, `status+createdAt`, `cashClosingId+receivedAt` si se usa.
- **Reglas/escritor:** cliente lee propios; CAJA/admin con capacidad leen; solo backend crea/confirma/reembolsa.
- **Idempotencia:** clave por intento de cobro; request hash debe coincidir en reintentos.
- **Corrección:** nunca editar importes confirmados; reverso/reembolso enlazado.
- **Retención:** pendiente de contador/abogado; sin TTL ni hard delete.
- **Riesgos:** doble cobro, evidencia falsa, conciliación y datos sensibles.

### `paymentAllocations` — nueva condicional recomendada

- **Finalidad:** distribuir un pago entre órdenes/sesiones sin duplicar el pago.
- **Colección/ID:** superior `/paymentAllocations/{allocationId}` o subcolección de pago; ID determinista `paymentId+targetType+targetId+sequence`.
- **Relaciones:** payment, serviceOrder y opcional walkSession.
- **Mínimos:** `paymentId`, `targetType`, `targetId`, `amountCents`, `currency`.
- **Snapshot:** folio y total del objetivo al asignar.
- **Estados:** append-only; reverso por allocation compensatoria.
- **Índices:** `paymentId`, `targetType+targetId+createdAt`.
- **Reglas/escritor:** lectura por participantes autorizados; solo backend.
- **Idempotencia/corrección:** ID determinista y allocation negativa/reversa vinculada.
- **Retención:** igual al pago.
- **Riesgos:** sobreasignación; la transacción debe comprobar que suma de allocations no exceda pago/objetivo.

### `financialMovements` — nueva obligatoria

- **Finalidad:** libro mayor operativo inmutable de entradas, salidas, reversos y ajustes; Créditos PET no se mezclan como efectivo.
- **Colección/ID:** `/financialMovements/{movementId}`; ID determinista derivado de operación y secuencia.
- **Relaciones:** payment, allocation, expense, refund, closing, settlement, order/session.
- **Mínimos:** `type`, `direction`, `amountCents`, `currency`, `effectiveAt`, `operationId`, `sourceType`, `sourceId`.
- **Snapshot:** concepto, caja, método, contraparte identificada por UID y clasificación aprobada.
- **Estados:** el movimiento contabilizado no cambia; `reversalOfMovementId` y `adjustmentReasonCode` crean nuevos movimientos.
- **Índices:** `effectiveAt`, `type+effectiveAt`, `cashClosingId+effectiveAt`, `walkerId+effectiveAt`, `sourceType+sourceId`.
- **Reglas/escritor:** ninguna escritura desde navegador; lecturas financieras por capacidades y vistas acotadas.
- **Idempotencia:** `operationId+sequence` único.
- **Corrección:** solo compensación; sin hard delete.
- **Retención:** pendiente fiscal/legal; retención indefinida hasta política aprobada.
- **Riesgos:** clasificación incorrecta, doble movimiento y pérdida de trazabilidad.

### `tickets` — nueva

- **Finalidad:** comprobante interno histórico; no CFDI.
- **Colección/ID:** `/tickets/{ticketId}`; ID interno separado de `TKT-…`.
- **Relaciones:** payment, allocations, order, sesiones, customer, walker, report.
- **Mínimos:** `folio`, `issuedAt`, `paymentId`, `totalsSnapshot`, `currency`, `verificationCode`, `originalTicketId`, `printCount`.
- **Snapshot:** marca PET Ap; perro, servicio, paseador; conceptos, descuentos, créditos promocionales separados, total, método y estados autorizados.
- **Estados:** `issued`, `voided`, `replaced`; reimpresión no cambia estado financiero.
- **Índices:** `folio` único por ID determinista auxiliar, `customerId+issuedAt`, `paymentId`.
- **Reglas/escritor:** backend emite/anula; propietario lee sus tickets; CAJA/admin por capacidad.
- **Idempotencia:** una emisión por `paymentId+ticketVersion`; mismo comando devuelve mismo ticket.
- **Corrección:** anular y emitir reemplazo enlazado; nunca reescribir snapshot.
- **Retención:** pendiente fiscal/legal; sin hard delete.
- **Riesgos:** que se confunda con factura, fuga de datos, folio duplicado o snapshot mutable.

### `cashClosings` — nueva

- **Finalidad:** corte de caja operativo por caja, operador y ventana.
- **Colección/ID:** `/cashClosings/{closingId}`; ID interno separado de `CIE-…`.
- **Relaciones:** movimientos, pagos, caja y operador.
- **Mínimos:** ventana, `cashierUid`, `registerId`, `movementIds` o criterio congelado, totales por método en centavos, conteos, `status`, folio.
- **Snapshot:** saldo esperado, conteo declarado, diferencia y motivo; definiciones sujetas al propietario/contador.
- **Estados:** `draft → closing → closed`; fallo vuelve a `draft` con intento auditado; corrección mediante cierre de ajuste/reverso, no edición.
- **Índices:** `registerId+openedAt`, `cashierUid+closedAt`, `status+openedAt`.
- **Reglas/escritor:** CAJA crea/solicita; backend cierra; admin revisa; supervisor solo si tiene capacidad explícita.
- **Idempotencia:** `registerId+windowStart+windowEnd+attemptKey` y lock transaccional.
- **Retención:** pendiente fiscal/legal.
- **Riesgos:** incluir movimientos dos veces, cierres superpuestos, múltiples cajas y diferencias no justificadas.

### `walkerSettlements` — nueva

- **Finalidad:** liquidación operativa de sesiones elegibles para un paseador.
- **Colección/ID:** `/walkerSettlements/{settlementId}`; ID interno separado de `LIQ-…`.
- **Relaciones:** walker UID, sesiones, movimientos y pagos de salida.
- **Mínimos:** periodo, `walkerId`, sesiones snapshot, cálculo aprobado en centavos, ajustes, total, estado, folio.
- **Snapshot:** reglas/versiones aplicadas, sesiones pagadas/completadas, cancelaciones y autorizador.
- **Estados:** `draft → reviewed → approved → paid`; `rejected/cancelled` antes de pago; después de pago solo reverso/ajuste.
- **Índices:** `walkerId+periodEnd desc`, `status+periodEnd`, `folio`.
- **Reglas/escritor:** walker solo lee propia; admin/capacidad financiera solicita; backend aprueba/paga.
- **Idempotencia:** `walkerId+period+calculationVersion`; sesiones no pueden pertenecer a dos liquidaciones activas.
- **Retención:** pendiente fiscal/laboral/legal.
- **Riesgos:** clasificación laboral, fórmula no aprobada, doble liquidación y propinas/comisiones.

### `expenses` — nueva

- **Finalidad:** registrar gastos operativos autorizados, no deducibilidad fiscal.
- **Colección/ID:** `/expenses/{expenseId}`.
- **Relaciones:** movimiento, proveedor/categoría, cierre opcional.
- **Mínimos:** categoría aprobada, concepto limitado, `amountCents`, moneda, fecha, evidencia referenciada, estado.
- **Snapshot:** proveedor presentado y aprobaciones; no guardar credenciales ni datos excesivos.
- **Estados:** `draft → submitted → approved → posted`; rechazo antes de contabilizar; después, reverso.
- **Índices:** `status+expenseDate`, `category+expenseDate`, `cashClosingId`.
- **Reglas/escritor:** CAJA puede capturar borrador si se aprueba; backend contabiliza; admin aprueba; supervisor no por defecto.
- **Idempotencia:** clave de captura más hash de evidencia/metadatos.
- **Corrección:** reverso/ajuste, sin hard delete una vez posted.
- **Retención:** pendiente fiscal/legal.
- **Riesgos:** duplicados, evidencia sensible, afirmar deducibilidad o impuestos sin dictamen.

### `printJobs` — nueva, no financiera

- **Finalidad:** cola de intención y resultado incierto de impresión; nunca confirma pago.
- **Colección/ID:** preferible local en dispositivo para MVP; si se sincroniza, `/printJobs/{jobId}` sin bytes sensibles.
- **Relaciones:** ticket y dispositivo lógico.
- **Mínimos:** `ticketId`, `ticketSnapshotHash`, `transport`, `status`, intentos, timestamps, error seguro.
- **Snapshot:** perfil de papel/encoder; no duplicar el ticket completo si no es necesario.
- **Estados:** `queued → connecting → writing → awaiting_confirmation|printed|uncertain|failed|cancelled`.
- **Índices:** `deviceId+status+createdAt`; `ticketId+createdAt` si se sincroniza.
- **Reglas/escritor:** estado local del dispositivo; servidor solo registra evidencia si se justifica.
- **Idempotencia:** reimpresión crea job nuevo, pero no ticket/pago/movimiento nuevo.
- **Corrección:** `uncertain` requiere confirmación humana; nunca reintento automático.
- **Retención:** corta y operativa, pendiente de política; ticket conserva el contador de impresiones confirmado.
- **Riesgos:** BLE sin acuse, duplicación física, PII en spool y falsa confirmación.

### `folioCounters` — nueva infraestructura

- **Finalidad:** reservar secuencias visibles sin contar documentos.
- **Colección/ID:** `/folioCounters/{prefix-period}`; un contador por prefijo y periodo aprobado.
- **Relaciones:** entidad emitida y recibo idempotente.
- **Mínimos:** prefijo, periodo, siguiente secuencia, versión y actualización backend.
- **Snapshot:** ninguno financiero.
- **Estados:** no aplica; incremento transaccional.
- **Índices:** ninguno adicional por acceso directo.
- **Reglas/escritor:** lectura/escritura solo backend.
- **Idempotencia:** reservar folio y crear entidad/recibo en la misma transacción; reintento devuelve la misma reserva.
- **Corrección:** los huecos se conservan y auditan; nunca reutilizar folios.
- **Retención:** permanente mientras existan entidades relacionadas.
- **Riesgos:** punto caliente, cambio de periodo, carreras y secuencia asignada sin entidad.

### `financialAuditLogs` — nueva obligatoria

- **Finalidad:** auditoría privilegiada y recibo de idempotencia de cada comando financiero.
- **Colección/ID:** `/financialAuditLogs/{operationId}`; `operationId` determinista a partir de scope, actor e idempotency key, sin guardar la clave cruda.
- **Relaciones:** todos los documentos creados, reversados o rechazados.
- **Mínimos:** actor/claims relevantes, capability, command, request hash, result, referencias, timestamps y reason code.
- **Snapshot:** before/after minimizados; sin secretos ni datos de tarjeta.
- **Estados:** `processing`, `succeeded`, `rejected`, `failed_safe`; recuperación de `processing` requiere protocolo explícito.
- **Índices:** `actorUid+createdAt`, `command+createdAt`, `result+createdAt`, `entityType+entityId`.
- **Reglas/escritor:** solo backend escribe; auditor autorizado lee; no update/delete salvo transición controlada de recibo.
- **Idempotencia:** mismo request hash retorna resultado previo; hash distinto con misma clave produce conflicto.
- **Corrección:** nuevo evento enlazado; no borrar.
- **Retención:** pendiente legal/contable.
- **Riesgos:** registrar PII/secretos, quedar `processing`, auditoría incompleta fuera de transacción.

## 6. Máquinas de estado y garantías

### Orden y paseo existentes

- `serviceOrder`: `draft → pending_confirmation → confirmed → partially_completed → completed`; cancelación solo mediante política autorizada.
- `walkSession`: `requested → pending_assignment → assigned → confirmed → on_the_way → arrived → in_progress → completed`; `cancelled/no_show` según rol y política.
- Pago confirmado y paseo completado son condiciones separadas. Completar el paseo no confirma el pago y confirmar el pago no completa el paseo.

### Pago, ticket, cierre y liquidación

```text
payment: pending -> proof_uploaded -> under_review -> confirmed -> refunded
                               \-> rejected

ticket: issued -> voided -> replaced (nuevo ticket enlazado)

cashClosing: draft -> closing -> closed
                    \-> draft (fallo auditado antes de cerrar)

walkerSettlement: draft -> reviewed -> approved -> paid
                         \-> rejected/cancelled (solo antes de paid)

printJob: queued -> connecting -> writing -> awaiting_confirmation -> printed
                                     \-> uncertain | failed | cancelled
```

No se reintenta automáticamente `uncertain`. Los estados terminales financieros se corrigen con nuevas operaciones compensatorias.

## 7. Matriz de permisos propuesta

| Capacidad | ADMIN | SUPERVISOR | CAJA | PASEADOR | CLIENTE |
|---|---:|---:|---:|---:|---:|
| Ver orden/sesión operativa | Sí | Sí | Solo necesaria para cobro | Solo asignadas | Solo propias |
| Ver importes confirmados | Sí | No por defecto | Sí, alcance de caja | Solo liquidación propia aprobada | Solo propios |
| Registrar intento/evidencia de pago | Con capacidad | No | Sí | No | Solo enviar evidencia, sin importe autoritativo |
| Confirmar/rechazar pago | Con capacidad | No | Solicita; backend decide según capacidad | No | No |
| Reembolso/reverso | Capacidad separada y doble control recomendado | No | No por defecto | No | Solicita, no ejecuta |
| Emitir/reimprimir ticket | Sí | No por defecto | Sí | No | Ver/descargar propio |
| Abrir/cerrar caja | Sí | No | Propia; cierre por backend | No | No |
| Crear/aprobar gasto | Aprobar | No por defecto | Capturar borrador si se autoriza | No | No |
| Crear/aprobar liquidación | Sí, capacidades separadas | Solo revisión operativa si se decide | No | Solo lectura propia | No |
| Cambiar precios/cupones | Capacidad específica; nunca cliente directo a Firestore | No | No | No | No |
| Escribir movimientos/auditoría/folios | Solo backend | Solo backend | Solo backend | Solo backend | Solo backend |

`CAJA` debe existir como claim canónico y además usar capacidades explícitas, por ejemplo `finance.payment.capture`, `finance.payment.confirm`, `finance.ticket.print` y `finance.cash.close`. El nombre concreto del claim se decidirá en F1. `users.role` continuará como mirror visual y nunca autoriza.

## 8. Frontera cliente/backend e idempotencia

### Cliente Firebase

- Lee únicamente órdenes, pagos, tickets, Créditos PET y liquidaciones propias/autorizadas mediante reglas y consultas limitadas.
- Puede subir o referenciar evidencia solo cuando exista un flujo privado aprobado; nunca determina importe, moneda, descuento, margen, folio o estado confirmado.
- Envía un comando HTTPS con Firebase ID token, App Check cuando esté disponible, idempotency key y payload mínimo.

### Backend privilegiado

1. Falla cerrado si falta token, claim/capability, App Check requerido, origen autorizado o rate limit.
2. Valida tipos, enteros, moneda, rango y request hash.
3. Lee orden/sesiones/precio aprobado desde fuentes autoritativas.
4. Abre transacción Firestore.
5. Consulta/crea `financialAuditLogs/{operationId}` como recibo idempotente.
6. Reserva folio si corresponde y crea pago, allocations, movimientos, ticket/cierre/liquidación de forma atómica.
7. Devuelve IDs internos y estado real después del commit.
8. Un reintento idéntico devuelve el resultado previo; misma clave con payload distinto devuelve conflicto.

Cloud Firestore puede reintentar una función transaccional y nunca aplica parcialmente una transacción exitosa; por ello cualquier efecto externo —impresión, WhatsApp o proveedor de pago— debe ocurrir después del commit y tener su propia idempotencia.

## 9. Backend gratuito: evaluación

### Cloudflare Worker Free

**Candidato, no validado.** Puede recibir comandos HTTPS, verificar Firebase ID tokens/custom claims, verificar App Check, aplicar rate limiting y usar secretos cifrados. Un acceso privilegiado a Firestore puede usar una identidad de servicio y la API REST/transacciones, pero debe prototiparse sin reutilizar credenciales comprometidas.

Límites vigentes revisados: 100,000 solicitudes/día, 10 ms de CPU, 128 MB, 50 subrequests externos y 3 MB de Worker en Free. La verificación criptográfica, obtención/caché de OAuth y transacciones deben medirse; si no caben de forma confiable, las mutaciones se clasifican como **pospuestas**. El Worker debe configurarse fail-closed al agotar cuota.

Fuentes oficiales:

- [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Cloudflare Workers secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
- [Cloudflare Rate Limiting API](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
- [Firebase: verificar ID tokens](https://firebase.google.com/docs/auth/admin/verify-id-tokens)
- [Firebase App Check para backend propio](https://firebase.google.com/docs/app-check/custom-resource-backend)
- [Firestore REST API](https://firebase.google.com/docs/firestore/use-rest-api)
- [Firestore transactions](https://firebase.google.com/docs/firestore/manage-data/transactions)

### Proceso administrativo local

Alternativa temporal gratuita para un solo operador: script local revisado, ADC fuera del repositorio, proyecto y alcance explícitos, dry-run, doble confirmación, idempotency key, transacción y recibo de auditoría. No sirve para múltiples cajas concurrentes ni debe convertirse en interfaz pública. Sin ese script probado, pagos, cierres, reembolsos y liquidaciones permanecen **pospuestos**.

### Cuota Firestore Spark

La cuota gratuita oficial incluye 50,000 lecturas, 20,000 escrituras y 20,000 borrados diarios, 1 GiB almacenado y 10 GiB/mes de salida; TTL, PITR, backup/restore y clone no tienen uso gratuito. Cada operación financiera genera varias escrituras e índices, por lo que se necesita presupuesto de operaciones y alertas manuales antes de habilitarla. [Firestore usage and limits](https://firebase.google.com/docs/firestore/quotas).

## 10. Estrategia de folios

- ID interno: aleatorio/inmutable y nunca visible como secuencia de autoridad.
- Folio visible: prefijo aprobado + periodo + secuencia con padding, por ejemplo `PET-…`, `TKT-…`, `CIE-…`, `LIQ-…`; el formato final requiere decisión del propietario.
- No contar documentos ni buscar “último folio”.
- Usar `folioCounters/{prefix-period}` en una transacción junto con la entidad y el recibo idempotente.
- El contador solo avanza; los huecos se conservan y auditan.
- Múltiples cajas comparten el contador transaccional o usan rangos preasignados solo si se diseña reconciliación explícita.
- Doble clic y reintentos recuperan el mismo resultado mediante `operationId`; nunca consumen un segundo folio.
- Si el commit es incierto para el cliente, consultar el recibo antes de reintentar.

## 11. Contrato del ticket interno

`TicketBuilder` recibe exclusivamente un `TicketSnapshot` inmutable:

- marca y razón de comprobante interno;
- `ticketId`, folio visible y fecha de emisión;
- IDs/folios de orden, pago y sesiones sin exponer IDs innecesarios públicamente;
- snapshot de perro, servicio y paseador minimizado;
- conceptos monetarios en centavos, moneda, descuentos y créditos promocionales separados;
- método/referencia enmascarada;
- estado original o reimpresión y contador de impresiones;
- código de verificación firmado por backend;
- URL construida desde `NEXT_PUBLIC_SITE_URL`, sin tokens ni PII;
- reporte vinculado, accesible solo tras autorización;
- leyenda clara: “Comprobante interno PET Ap; no es CFDI ni factura”.

Una verificación pública, si se autoriza, solo revela autenticidad/estado mínimo y nunca dirección, salud, teléfono, notas o información financiera interna.

## 12. Arquitectura ESC/POS y Bluetooth propuesta

```text
TicketSnapshot
  -> TicketBuilder          (líneas y bloques semánticos)
  -> EscPosEncoder          (CP850, QR nativo, logo raster, ancho 384 dots)
  -> PrintQueue             (estados, orden, no auto-retry de uncertain)
  -> PrinterTransport
       ├── MockPrinterTransport       (pruebas deterministas)
       ├── ManualHexTransport         (validación controlada)
       └── IOSCoreBluetoothTransport  (fase nativa futura)
```

Perfil de hardware a validar físicamente, no asumido como garantía: SUZWIP 58 mm, 384 dots, 203 dpi, BLE “BlueTooth Printer”, servicio FF00, característica FF02, Write/Write Without Response, ESC/POS, CP850, QR nativo y logo raster.

`Write Without Response` solo confirma entrega al stack BLE, no impresión física. Sin status/acuse fiable, el resultado es `uncertain`; requiere revisión humana y no se reintenta automáticamente.

## 13. Decisiones pendientes

### Propietario

1. Medios de pago permitidos durante MVP y cuáles participan en caja.
2. Si un pago puede cubrir varias órdenes/sesiones, pagos parciales o medios mixtos.
3. Formato/periodicidad exactos de folios y definición de caja/turno.
4. Capacidades exactas de ADMIN, SUPERVISOR y CAJA; necesidad de doble autorización para reversos.
5. Política comercial de cancelación, no-show, cortesías, descuentos y reembolsos.
6. Fuente y flujo de aprobación de listas de precios; vigencia y versionado.
7. Fórmula contractual de liquidación del paseador, una vez revisada profesionalmente.
8. Qué debe mostrar el ticket y si existirá verificación pública mínima.
9. Si `paymentAllocations` se habilita desde F1 o se pospone con restricción de un pago por orden.
10. Quién opera el proceso local temporal y quién revisa diferencias de caja.

### Contador/abogado en México

- Momento y criterio de reconocimiento de ingreso.
- Tratamiento fiscal, impuestos y redondeos.
- CFDI y relación entre ticket interno y comprobantes fiscales.
- Tratamiento de propinas, comisiones y liquidaciones.
- Reembolsos, contracargos, cortesías y descuentos.
- Conservación de pagos, tickets, cierres, gastos, auditoría y evidencia.
- Clasificación laboral/contractual del paseador y documentación asociada.
- Protección, acceso y transferencia de datos financieros.

## 14. Roadmap F1–F10 y criterios de aceptación

| Fase | Alcance | Criterios de aceptación para cerrar |
|---|---|---|
| F1 | Decisiones y contratos de dominio | Propietario/contador resuelven decisiones; centavos/MXN y schemas versionados; cero UI o writes productivas |
| F2 | Claims CAJA y matriz de capacidades | Tokens verificados; supervisor/admin/caja diferenciados; pruebas permitidas/denegadas; `users.role` no autoriza |
| F3 | Backend privilegiado e idempotencia | Prototipo local Worker o script; fail-closed; ID token/App Check/rate limit; transacciones y reintentos deterministas probados |
| F4 | Pagos, allocations y ledger | Sin flotantes; movimientos append-only; dobles clics/reintentos no duplican; reversos compensatorios; emulador verde |
| F5 | Precios, descuentos, cupones y promociones | Fuente versionada; margen aprobado; créditos separados de efectivo; canjes atómicos e idempotentes |
| F6 | Caja, cierres, gastos y exportación | Cierres no superpuestos; snapshots; diferencias justificadas; CSV seguro/trazable; sin “resultado fiscal” |
| F7 | Liquidaciones de paseadores | Solo sesiones elegibles una vez; snapshot contractual; walker solo lee propia; reversos controlados |
| F8 | Tickets, folios y verificación | Folios concurrentes sin duplicados; ticket snapshot/no CFDI; reimpresión no genera dinero; privacidad comprobada |
| F9 | ESC/POS, cola y transportes | Builder/encoder/transport desacoplados; golden bytes; mock/manual; `uncertain` sin retry automático; prueba física documentada |
| F10 | Piloto y habilitación gradual | Reconciliación, amenazas, carga/cuotas, recuperación parcial, manual operativo y aprobación explícita antes de producción |

Ninguna fase habilita producción automáticamente. Cada fase exige revisión, pruebas locales/emulador y autorización separada.

## 15. Epic futuro — PET Ap Assistant

Estado: **documentado; no iniciado**.

PET Ap Assistant será una interfaz administrativa conversacional privada construida sobre los módulos operativos y financieros canónicos. No será una fuente de verdad ni tendrá acceso arbitrario a Firestore. Su flujo obligatorio será:

```text
Administrador
  -> intención validada
  -> herramienta registrada y permitida
  -> backend autorizado
  -> consulta real
  -> cálculo determinístico
  -> respuesta estructurada
```

No se crearán todavía `/admin/assistant`, colecciones, endpoints, dependencias de IA, integraciones pagadas ni cambios de Firebase, claims, reglas, hosting o producción.

### 15.1 Alcance gratuito inicial y proveedor sustituible

El primer MVP no dependerá de una API de IA pagada. Comenzará con `DeterministicIntentProvider`, un parser local para intenciones y comandos conocidos como resumen diario, ventas, efectivo, cuentas por cobrar, paseos, actividad por paseador, corte de caja, comparación semanal, liquidaciones, impresión y los atajos `/caja`, `/semana`, `/pendientes`, `/paseadores` y `/imprimir`.

La interfaz futura será `AssistantIntentProvider`, con implementaciones sustituibles:

- `DeterministicIntentProvider` para el MVP gratuito;
- `ExternalAIIntentProvider` como integración posterior, opcional y desacoplada.

La operación tradicional de PET Ap debe continuar cuando cualquier proveedor de IA no esté disponible. Los botones y paneles convencionales serán siempre el fallback operativo.

### 15.2 Autorización inicial

Los custom claims continúan como única autoridad:

| Actor | Acceso inicial al Assistant |
|---|---|
| `admin` | Permitido, sujeto además a capabilities por herramienta |
| `supervisor` | Denegado por defecto |
| `walker` | Denegado |
| `customer` | Denegado |
| Usuario sin claim | Denegado |
| Visitante | Denegado |

No se introducirá `OWNER` dentro de este epic. Si posteriormente se necesita, requerirá una migración RBAC independiente, pruebas permitidas/denegadas, script administrativo seguro y renovación comprobada de tokens.

Ocultar el enlace no autoriza. La implementación futura deberá proteger ruta, layout, handlers/API, herramientas, consultas, exportaciones, impresión y acciones financieras.

### 15.3 Dependencias bloqueantes y relación con F2–F10

A1 no puede comenzar hasta que el propietario lo autorice expresamente y estén implementados y probados:

1. Persistencia canónica de pagos y cuentas por cobrar, principalmente F4 y F6.
2. Ledger financiero inmutable e idempotencia financiera, F3–F4.
3. Caja, cierres y gastos, F6.
4. Liquidaciones de paseadores, F7.
5. Fuentes canónicas de `serviceOrders`, `walkSessions`, perros y clientes, sin depender de `reservations` legacy.
6. Backend privilegiado viable dentro del plan gratuito, F3; si no es viable, las operaciones afectadas permanecen pospuestas.
7. Claims/capabilities administrativas definitivas, F2.
8. Reglas e índices probados en emulador para todas las consultas autorizadas.
9. `financialAuditLogs` y auditoría operativa segura.
10. Tickets, folios y verificación desacoplados, F8.
11. Sistema de impresión desacoplado y estados inciertos definidos, F9.
12. Pruebas de piloto, cuotas, recuperación y operación, F10.

Los contratos puros F1 son necesarios, pero no suficientes: no autorizan consultas financieras reales ni operaciones del Assistant.

### 15.4 Arquitectura propuesta

```text
PET Ap Assistant
  -> AssistantIntentProvider
  -> IntentSchema
  -> ToolRegistry
  -> AuthorizationPolicy
  -> Query/Command Handler
  -> Repositories canónicos
  -> Finance Domain
  -> Response Model
  -> UI del Assistant

PrintIntent
  -> PrintTemplate
  -> EscPosBuilder
  -> PrinterTransport
```

El proveedor de intención nunca se conecta directamente con Firestore, Firebase Admin, secretos, tokens, credenciales, `PrinterTransport`, bytes ESC/POS ni mutaciones financieras.

Cada herramienta deberá declarar `name`, `version`, `description`, `inputSchema`, `requiredCapabilities`, `operationType` (`READ` o `WRITE`), `riskLevel`, `confirmationRequired`, `handler`, `timeout`, `outputSchema` y `auditPolicy`. El registro aceptará intenciones enumeradas; no permitirá nombres de colección, filtros o consultas generados libremente.

### 15.5 Política READ/WRITE y contexto

- Una operación `READ` valida claim, capability e input antes de consultar datos actuales. Los resultados financieros se calculan con funciones determinísticas e incluyen `computedAt`, `dateRange` y `sourceCounts` cuando corresponda.
- Una operación `WRITE` primero prepara una propuesta con entidad, importe, estado anterior, estado posterior y consecuencias. Exige confirmación explícita, idempotency key, revalidación de autorización y estado, transacción y auditoría.
- Reembolsos, cierres, liquidaciones, ajustes, cancelaciones con cargo y cambios de precio requieren confirmación reforzada.
- El contexto puede conservar intención, periodo, filtros, entidad seleccionada, tipo de respuesta y referencia al resultado mostrado. Nunca conserva una cifra como fuente financiera definitiva; una continuación vuelve a consultar o calcular sobre la fuente canónica.

### 15.6 Privacidad y seguridad

- Minimizar datos personales y preferir agregados frente a movimientos individuales.
- Tratar notas, reseñas y todo contenido almacenado como datos no confiables; nunca concatenarlos como instrucciones del sistema.
- No guardar razonamiento interno, tokens, secretos ni credenciales.
- Ofrecer “No guardar esta conversación” y definir retención limitada antes de persistir historial.
- El historial conversacional nunca será fuente financiera.
- Las respuestas no podrán inventar importes, usuarios, paseadores, disponibilidad ni métricas.
- Cualquier proveedor externo será opcional, tendrá minimización de datos, evaluación contractual y consentimiento/aviso aplicable antes de habilitarse.

### 15.7 Riesgos principales

1. Respuestas financieras incorrectas por fuentes no canónicas, datos desactualizados o cálculos no determinísticos.
2. Escalamiento de privilegios si la autorización se limita a la UI o al nombre de una herramienta.
3. Prompt injection mediante contenido almacenado o texto libre.
4. Duplicación de operaciones por reintentos, doble confirmación o contexto viejo.
5. Exposición de información personal a proveedores externos, logs o historial.
6. Mutaciones parciales sin transacción, auditoría o reverso compensatorio.
7. Dependencia operativa o económica de un proveedor de IA.
8. Impresión marcada como exitosa sin confirmación física; un estado `uncertain` nunca se reintenta automáticamente.
9. Consultas amplias que excedan cuotas de Firestore Spark o límites de un backend gratuito.
10. Presentar respuestas conversacionales como asesoría fiscal, contable o jurídica definitiva.

### 15.8 Roadmap A1–A12 y criterios de salida

| Fase | Alcance documental futuro | Criterio mínimo para cerrar |
|---|---|---|
| A1 | Auditoría de dependencias y readiness | Todos los bloqueantes se verifican con evidencia; propietario autoriza continuar |
| A2 | Contratos puros de intención, herramientas y respuestas | Schemas versionados, tipos READ/WRITE y errores puros con pruebas |
| A3 | Parser determinístico gratuito | Intenciones enumeradas, ambigüedad fail-closed y fixtures sin datos inventados |
| A4 | Tool registry READ | Allowlist, capabilities, schemas, timeout y auditoría definidos; sin Firestore arbitrario |
| A5 | Consultas reales y agregados financieros | Repositories canónicos, queries limitadas e indicadores reconciliados con fuentes reales |
| A6 | UI administrativa protegida y mobile-first | Solo admin autorizado; estados loading/empty/error; fallback tradicional accesible |
| A7 | Contexto conversacional limitado | Retención y minimización aprobadas; ninguna cifra histórica funciona como autoridad |
| A8 | Operaciones WRITE preparadas y confirmadas | Propuesta, confirmación reforzada, revalidación, idempotencia, transacción y reverso probados |
| A9 | Auditoría y observabilidad | Eventos minimizados, trazabilidad completa y ausencia comprobada de secretos/PII innecesaria |
| A10 | Integración con impresión | Plantilla/encoder/transport separados; `uncertain` exige intervención humana |
| A11 | Proveedor de IA opcional | Interfaz sustituible, evaluación de privacidad/costo y fallback determinístico probado |
| A12 | Seguridad, rendimiento y E2E | Amenazas, capacidades, cuotas, carga, recuperación y pruebas E2E aprobadas antes de habilitar |

Antes de cada fase A*: indicar los archivos que se modificarán, verificar dependencias, ejecutar pruebas focales, typecheck, lint, suite completa y build, y detenerse si aparece información simulada o una fuente no canónica. Ninguna fase se inicia automáticamente ni habilita producción.
