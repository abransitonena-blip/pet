# Matriz de flujos — PET Ap

## Delta verificado 24-ago-2026

| Flujo | Fuente | Control local nuevo | Estado |
|---|---|---|---|
| Dirección → zona → reserva | `addresses.zoneId` + `zones/{zoneId}.active` | La dirección solo es seleccionable cuando el ID exacto aparece en la consulta limitada de zonas activas; una referencia legacy muestra corrección explícita. | Implementado local; pendiente Preview |

## Flujos de identidad

```text
Google Familia → Firebase Auth → claim ausente/customer
→ ensure customerProfiles/{uid}
→ comprobar contacto + address.zoneId + dog
→ /familia/configuracion-inicial o /familia
```

| Etapa | Implementación | Autoridad/resultado | Fallos controlados |
|---|---|---|---|
| Popup/GIS | `src/app/login/page.tsx`, `src/lib/googleAuth.ts` | Firebase Auth | popup bloqueado/cancelado, red, dominio |
| Claim | `roles.ts`, `auth.ts` | Ausente solo significa customer; interno se conserva | claim desconocido no eleva privilegios |
| Perfil/onboarding | `customerProfile.ts`, `familyOnboarding.ts`, `/familia/configuracion-inicial` | Perfil UID; dirección/perro deterministas al crear; zona por ID activo; no consulta `clients` | permiso, red, parcial, reintento idempotente, zona sin cobertura |
| Destino | `resolveDestination` | `/familia` o destino interno seguro | redirect externo rechazado |

```text
Google Equipo → Firebase Auth → custom claim explícito
→ walkerProfiles (walker) → /admin o /walker
```

| Rol | Claim requerido | Perfil adicional | Destino |
|---|---|---|---|
| walker | `walker` | `walkerProfiles/{uid}.status == active` | `/walker` |
| supervisor | `supervisor` | estado operativo si existe | `/admin` |
| admin | `admin` | no requiere walkerProfile | `/admin` |
| customer/sin claim | no autorizado en equipo | — | mensaje y enlace `/login` |

## Flujo canónico de servicio

```text
Familia → perro → dirección → fecha/hora → servicio/precio
→ validación → serviceOrder → walkSession(requested)
```

| Paso | Entrada | Salida | Fuente/autoridad | Estado |
|---|---|---|---|---|
| Perro | `dogs` propios, máximo 10 | `dogIds` | ownerId + reglas | IMPLEMENTADO |
| Dirección | `addresses` propias zonificadas, máximo 10 | `addressId`; `zoneId` se valida sin copiarlo a documentos no permitidos | ownerId + reglas | IMPLEMENTADO local; alta ficticia retirada |
| Cuándo | fecha, ventana | scheduledDate/start/end | validación local + reglas | IMPLEMENTADO; ASAP apagado |
| Servicio | catálogo estable + proyección pública | `serviceId`, `serviceVersion` | `appSettings/servicePrices` | IMPLEMENTADO; tarifa real pendiente |
| Confirmación | formulario completo | errores por paso | `reservationValidation.ts` | IMPLEMENTADO |
| Escritura | datos validados | 1 order + N sessions | batch, IDs previos solo tras validar | IMPLEMENTADO |

```text
Perfil Familia → dirección propia → zoneId estable → zones/{zoneId}
→ walkSession.addressId → Admin resuelve zona → asignación Walker por UID
```

La dirección completa no se copia al paseo ni se expone al Walker antes de una asignación autorizada. La cola Admin agrupa lecturas por ID y usa límites; nunca descarga todas las direcciones.

Controles: una tarifa ausente es `null` y deshabilita la opción; cero solo es cortesía explícita. El navegador no escribe importes confirmados, descuento, margen, `walkerId` ni pago distinto de `pending`.

El ruleset activo `981bae3b…09ad` valida antes de crear: zona existente y activa; dirección y único perro propios; y coincidencia exacta entre order/session para `customerId`, `dogIds`, `addressId`, `serviceId`, fecha y ventana horaria. Las referencias ajenas o incoherentes fallan cerradas.

```text
Admin → solicitud requested → Walker activo por UID
→ transacción de asignación → sesión assigned
```

| Actor | Lectura | Escritura | Restricción |
|---|---|---|---|
| customer | órdenes/sesiones propias | solicitud propia | no asigna ni escribe finanzas |
| supervisor | cola operativa | asigna/reprograma allowlist | claim explícito, no mirror |
| admin | cola operativa | asigna/reprograma allowlist | walkerProfile debe estar activo |
| usuario común | ninguna cola global | ninguna asignación | denegado |

La asignación canónica usa `runTransaction` en `useCanonicalWalkSessions.ts:177-228`; el nombre es snapshot de presentación, el UID es identidad.

```text
Walker → sesión walkerId == UID → transiciones secuenciales
→ completed → walkReports/{walkSessionId}
```

| Transición | Timestamp | Permitido |
|---|---|---|
| assigned → confirmed | `confirmedAt` | walker asignado activo |
| confirmed → on_the_way | `onTheWayAt` | idem |
| on_the_way → arrived | `arrivedAt` | idem |
| arrived → in_progress | `startedAt` | idem |
| in_progress → completed | `completedAt` | idem |

Saltos, regresiones, reasignación, customer/order/dogs/dirección y campos financieros permanecen denegados. El reporte canónico local usa ID determinista, borrador privado e inmutabilidad después de enviar; no reutiliza la escritura legacy de `WalkSessionModal`.

```text
walkSession completed
→ walkReport draft (Walker activo asignado)
→ walkReport submitted (inmutable)
→ Familia propia / Admin / Supervisor consultan
→ referencia tipada para ticket futuro
```

| Actor | Lectura | Escritura | Estado local |
|---|---|---|---|
| Walker activo asignado vigente | su reporte | draft y envío; no edita enviado ni tras reasignación | candidato de reglas 7/7 |
| Customer con claim explícito | solo propio y `submitted` | ninguna | candidato de reglas 7/7 |
| Admin/Supervisor | lectura operativa, límite 50 en UI | ninguna en este bloque | implementación local |
| Sin claim / Walker ajeno, anterior o inactivo | ninguna | ninguna | denegado en emulador |

La referencia para tickets (`toReportTicketReference`) solo acepta reportes enviados y no contiene importes, pagos ni movimientos. El flag `WALK_REPORTS_ENABLED=true` está publicado; Firestore Rules siguen siendo la autoridad y el listener existe solo mientras el Walker abre su editor.

## Flujo financiero futuro

```text
walkSession → payment → financialMovement → ticket
→ cashClosing / walkerSettlement
```

| Entidad | Estado | Principio vinculante |
|---|---|---|
| walkSession | IMPLEMENTADO | fuente del servicio individual |
| payment/allocation | PROPUESTO/F1 contrato | centavos, MXN, idempotencia, backend privilegiado |
| financialMovement | PROPUESTO/F1 contrato | inmutable; corrección compensatoria |
| ticket | PROPUESTO/F1 contrato | comprobante interno, snapshot, no CFDI |
| closing/settlement | PROPUESTO/F1 contrato | snapshot, roles separados, sin navegador |
| ESC/POS/transporte | PROPUESTO | builder/encoder/transport/queue separados; no Bluetooth todavía |

## Compatibilidad legacy

| Flujo | Canónico | Legacy activo | Regla de transición |
|---|---|---|---|
| Customer | `customerProfiles` | `clients` fallback lectura | onboarding jamás escribe/consulta legacy |
| Perros | `dogs` | `pets` fallback puntual | no migración oculta |
| Servicio | serviceOrder/walkSession | `reservations` histórico | nuevas solicitudes jamás escriben legacy |
| Admin | cola canónica | pestaña legacy read-only | flags impiden mutaciones legacy |
| Familia historial | canónico parcial | listeners legacy | separar visualmente y después unificar lectura |

## Matriz de botones — onboarding y paneles relacionados

### Reporte canónico

```text
Walker activo asignado → walkReports/{walkSessionId} draft → submit con sesión completed
→ Familia propia get submitted → Admin/Supervisor consulta limitada de solo lectura
```

| Ruta | Acción | Rol | Loading | Success | Error | Prueba | Estado |
|---|---|---|---|---|---|---|---|
| `/walker/reportes/[sessionId]` | Guardar borrador / enviar | Walker activo asignado | bloqueo inmediato y spinner | borrador persistente / enviado inmutable | incompleta, reasignada, permiso o red | `walk-reports-runtime`, emulador focal | PASS automático; QA autenticada pendiente |
| `/familia/reportes/[sessionId]` | Consultar enviado | customer propio | carga puntual | contenido enviado de solo lectura | vacío, permiso o red | emulador focal | PASS automático; QA autenticada pendiente |
| `/admin/reportes` | Consultar últimos 50 | Admin/Supervisor | carga puntual | lista de solo lectura | permiso o red | `walk-reports-runtime`, emulador focal | PASS automático; QA autenticada pendiente |

| Ruta | Acción | Rol | Loading | Success | Error | Prueba | Estado |
|---|---|---|---|---|---|---|---|
| `/familia/configuracion-inicial` | Guardar perfil / avanzar | customer | botón bloqueado + spinner | paso siguiente | campo exacto, permiso o red | `family-onboarding`, UI contract | PASS local |
| `/familia/configuracion-inicial` | Volver | customer | deshabilitado durante guardado | conserva estado en memoria y datos ya persistidos | no aplica | `family-onboarding` | PASS local |
| `/familia/configuracion-inicial` | Seleccionar zona | customer | carga inicial explícita | guarda ID estable en dirección | sin cobertura / lista vacía | UI contract + reglas focales | PASS local |
| `/familia/configuracion-inicial` | Guardar dirección | customer | guard anti doble clic | upsert determinista propio | permiso/red | UI contract + emulador | PASS local |
| `/familia/configuracion-inicial` | Registrar perro | customer | guard anti doble clic | upsert determinista propio y salida `/familia` | permiso/red | UI contract + emulador | PASS local |
| `/login` | Continuar con Google | público | bloqueo de doble intento y loading | Auth + claim + perfil canónico | OAuth/Auth/claim/perfil/red diferenciados | auth + UI contract; viewport 390–1440 | PASS local; OAuth real no se prueba en Preview temporal |
| `/familia` | Menú móvil | customer | no aplica | abre destinos autorizados | no aplica | UI contract + teclado nativo de `details/summary` | PASS local |
| `/familia` | Menú móvil / abrir reserva | customer | no aplica | navegación interna | enlace real; sin botón decorativo | UI contract | PASS local |
| `/admin/reservas` | Asignar / reprogramar | admin/supervisor | botón y diálogo bloqueados | mensaje confirmado | conflicto, permiso, red | vertical slice | PASS existente |
| `/walker` | Avanzar estado | walker activo asignado | tarjeta bloqueada | estado persistido | permiso/red explícito | walker panel | PASS existente |
| `/walker` | Ejecutar siguiente transición | walker activo y asignado | bloqueo inmediato y transacción | timeline y estado se actualizan tras persistencia | conflicto concurrente, permiso y red diferenciados | `walker-panel` focal 17/17 | PASS local |
| shells | Cerrar sesión | rol correspondiente | evita repetición donde aplica | Auth y cookie limpiados | destino de acceso | sesión/roles | PASS existente |

## Aceptación integral — estado verificable

| Área | Flujo | Evidencia | Resultado | Riesgo pendiente |
|---|---|---|---|---|
| Reglas | Integridad customer/order/session | Emulador focal: integridad de zona/precios 32/32 PASS; ruleset remoto `981bae3b…09ad` y SHA `b6df2281…c61e` | PASS | 21 divergencias históricas P0.4 permanecen separadas y documentadas |
| Infraestructura | Índices y facturación | Consulta read-only: 12/12 índices READY y billing desactivado | PASS | Ninguno en este alcance |
| Familia | Login, onboarding y persistencia | Runtime publicado en `dpl_A4v…nC6X`; ruta de onboarding existe y redirige al login sin sesión | BLOQUEADO | Requiere takeover en Safari para probar datos propios sin duplicarlos |
| Familia | Perfil existente, perros y direcciones | Safari mostró customer existente, dos perros y una dirección zonificada; no hubo escrituras | PASS | No se verificó onboarding de una cuenta realmente nueva |
| Familia | Historial y solicitud canónica | Inicio separa solicitud canónica; `/familia/historial` se identifica como historial anterior solo lectura | PASS | La sesión histórica observada conserva una ventana horaria inválida preexistente |
| Familia | Servicios, precios y validación final | Entrada de reserva abre paso 1/6 con datos existentes | BLOQUEADO | Falta inspeccionar paso de servicio sin enviar otra solicitud |
| Admin | Claim y navegación autenticada | Safari alcanzó `/admin/reservas`, persistió tras recarga y varias subrutas registraron HTTP 200 sin errores runtime | PASS | La lectura automatizada del DOM de Safari no está habilitada |
| Admin | Datos, acciones y responsive | No se hicieron escrituras; captura automatizada no expone el contenido WebKit | BLOQUEADO | Requiere confirmación visual humana en los cuatro tamaños |
| Walker | Claim, perfil activo e inicio | Safari mostró `/walker`, Abraham 2 y estado vacío real; logs sin errores | PASS | Ninguna sesión asignada disponible para validar una transición sin crear datos |
| Walker | Historial, perfil, persistencia y logout | Rutas `/walker/historial` y `/walker/perfil` respondieron 200 | BLOQUEADO | Cambio de pestaña interrumpió la comprobación de recarga/logout; requiere confirmación manual |
| Funciones seguras | FCM, PET Ahora, mutaciones financieras, uploads privados | Feature flags seguras por defecto | DESACTIVADO DE FORMA SEGURA | No declarar funcional hasta backend privilegiado |

## Matriz funcional focal — reportes e historial

| Ruta | Control | Rol | Loading | Éxito | Error | Prueba | Estado |
|---|---|---|---|---|---|---|---|
| `/walker` | Reporte de completado anterior | Walker activo asignado | sesión cargada por listener único | abre `/walker/reportes/{sessionId}` | permiso/red explícitos en editor | `walker-panel`, emulador focal | PASS automático y publicado; QA autenticada pendiente |
| `/walker/historial` | Hoy/Próximos/Completados | Walker | carga del listener bounded | filtro local accesible | estado vacío por filtro | `walker-panel` | PASS local |
| `/familia/historial` | Ver reporte | Customer propietario | carga canónica separada | abre solo sesión completada propia | permiso/red y vacío diferenciados | `walk-reports-runtime`, reglas focales | PASS automático y publicado; QA autenticada pendiente |
| `/admin/reportes` | Filtrar/Reintentar | Admin/Supervisor | `loading` | últimos 50 filtrados localmente | permiso/red + reintento | `walk-reports-runtime` | PASS automático y publicado; QA autenticada pendiente |
| `/admin/paseadores` | Crear cuenta automática | Admin | no aplica | oculto con Functions apagadas | alta manual segura documentada | `walk-reports-runtime` | DESACTIVADO DE FORMA SEGURA |

## Matriz focal G1 — Production 29-ago-2026

| Ruta/control | Rol | Operación | Evidencia | Estado |
|---|---|---|---|---|
| `/` → Galería | Público | `get` limitado de `gallery-public` | Estado vacío honesto; consola limpia; reglas niegan metadata privada | PASS |
| `/api/admin/gallery/signature` sin token | Anónimo | Solicitar firma | HTTP `401` | PASS |
| `/admin/galeria` sin sesión | Anónimo | Abrir gestor | `307` a `/equipo` | PASS |
| Publicar/retirar | Admin | Batch privado + proyección mínima | Emulador focal 5/5; sin ejecución real durante deploy | PASS automático / manual pendiente |

## Matriz focal G1 legacy — 31-ago-2026

| Ruta | Control/estado | Acción | Rol | Escritura | Evidencia | Estado |
|---|---|---|---|---|---|---|
| `/admin/galeria` | Registro G1 compatible | Editar/publicar/retirar con handlers existentes | Admin | Solo tras acción explícita | parser + suite 430/430 | PASS |
| `/admin/galeria` | Registro anterior | Mostrar “pendiente de migración” con texto seguro | Admin/Supervisor | Ninguna; sin controles mutables | fixture `createdAt,dog,title,url` | PASS |
| `/admin/galeria` | Registro inválido | Error local sin cerrar la página | Admin/Supervisor | Ninguna | prueba de formato nulo/URL inválida | PASS |
| `/admin/galeria` | Carga firmada | Sin cambio funcional | Admin | No ejercida en este cierre | build 54/54; endpoint anónimo 401 | PASS |

## Matriz focal O1 — 1-sep-2026

| Ruta/control | Rol | Acción | Loading/éxito/error | Prueba | Estado |
|---|---|---|---|---|---|
| `/admin/*` navegación agrupada | Admin | `Link` a 21 destinos existentes; una sola ruta activa | Navegación client-side; el layout/auth existente resuelve permiso o redirección | `o1-navigation-shell` + rutas Preview/Production | PASS |
| `/admin/*` menú móvil | Admin | Abrir/cerrar, Escape y selección de destino | Cierre inmediato; foco visible; sin acción silenciosa | `o1-navigation-shell`, QA cinco tamaños | PASS |
| `/admin/*` cerrar sesión | Admin | Callback de logout existente | Objetivo 44 px; error sigue en el consumidor de sesión sin ampliación O1 | `o1-navigation-shell` | PASS |
| `/familia/*`, `/walker/*` navegación | Customer/Walker | Seleccionar destino del panel por coincidencia de segmento | Un solo activo; rutas privadas conservan redirección `307` sin sesión | `o1-navigation-shell`, HTTP Production | PASS |
| `/familia/perros` volver | Customer | Volver a `/familia` | 44 px, nombre accesible y foco visible | `o1-navigation-shell` | PASS |
| `/` Header | Público | Navegar, login y menú móvil | 44 px, Escape, foco y movimiento reducido | QA Preview/Production, consola limpia | PASS |
