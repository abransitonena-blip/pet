# Auditoría viva — PET Ap

## Actualización 28-ago-2026 — proyección pública G1 en Preview

- Se eliminó la cuenta vacía `pet-ap-gallery-reader`; tenía cero roles de proyecto y cero claves administradas por el usuario.
- El runtime ya no requiere `FIREBASE_SERVICE_ACCOUNT_JSON` para G1: la ruta server-only verifica el ID token contra el proyecto explícito y Firestore sigue siendo accedido por el navegador bajo Rules.
- `gallery-public` contiene únicamente la proyección pública allowlisted. La escritura Admin usa un batch atómico con `gallery-images`; retiro o pérdida de consentimiento/derechos elimina la proyección.
- Candidato local `firestore.rules` SHA-256 `d4ea2e63cb7b1033f919b378f5dc9e35dc901dc8e3865402b4d363b1ed03a95d`; no fue publicado.
- Gates: 426/426 unitarias, G1 emulador 5/5, typecheck/lint PASS, build remoto/prerender 54/54 y Security `140a88e8-6e3b-49d3-a0da-2bdd52cbe311` con 0 hallazgos.
- Preview `dpl_5wSFT34V7p7ojeRaK4ewf1eKAgkC` (`pet-euhz-jnsnj8aen-abraham9.vercel.app`) READY. Rutas públicas 200, Admin 307 a `/equipo`, firma sin token 401, logs sin errores y rutas privadas fuera del service worker.
- Gate pendiente: publicar las reglas exactas de `gallery-public` con autorización independiente. Hasta entonces, el Preview demuestra build y fail-closed; lectura/escritura G1 contra Firestore activo permanece denegada.

## Actualización 24-ago-2026 — visibilidad operativa publicada

- Preview focal `dpl_BtJ3jkPWcpud5jyqy4poEomwrF9G` y Production derivado `dpl_6b8g76T6mRrfTAVQaTcHoj7RxCLF` quedaron `READY`; `pet-euhz.vercel.app` apunta al Production nuevo y `dpl_Cy9SWvTJhHvJ5amrUytCFTwoJrLP` permanece como rollback manual.
- Manifiesto: seis diferencias runtime y seis hashes verificados; build Vercel completó prerender 51/51. Codex Security `12c84daf-4b4a-4265-8438-f24f69f09381`: 0 hallazgos.
- Rutas públicas `200`; paneles e historiales sin sesión conservan redirects internos `307`; `sw.js` usa `pet-ap-static-v3` y excluye `/admin`, `/familia` y `/walker`.
- QA pública en 390/430/768/1024/1440: sin overflow; controles principales de equipo 44–46 px; Google visible; consola sin errores. La aceptación autenticada del reporte continúa pendiente.
- Ruleset final observado: `b1998c37-9e7f-4cba-8c45-f133cae16b18`, SHA `3c84a994dbbc0e7eb6fd3c977c9577eab765a7377b52cd542e91a75ae03f0792`; índices 12/12 `READY`.

## Actualización 24-ago-2026 — activación runtime de reportes

- Ruleset observado read-only: `d0008740-b8ce-4744-805f-342aa0f6aaa0`, SHA-256 `6f5fa93f55e4d2058b554bf00bea97f9715e1ffdddbdbc9c02bbd711a1eec94c`.
- `firestore.rules` local quedó sincronizado byte a byte con ese ruleset; no hubo nueva publicación de reglas.
- `WALK_REPORTS_ENABLED=true`; la seguridad continúa en Firestore Rules, no en el flag.
- Familia realiza un `get` por `walkSessionId`; Admin realiza una consulta puntual `orderBy(updatedAt desc), limit(50)`; solo el editor Walker mantiene listener mientras la ruta está abierta.
- El editor bloquea reentradas con una referencia sincrónica, conserva el documento determinista y diferencia sesión incompleta, reporte enviado, sesión ausente, permiso y red.
- El contrato v1 no se amplió: fotos y campos financieros permanecen ausentes; horarios se leen de la sesión, no se duplican en el reporte.
- Preview aislado `dpl_BWim6wNoxtsTUq25KJcsY2Rrz1dd` y Production `dpl_Cy9SWvTJhHvJ5amrUytCFTwoJrLP` quedaron `READY`; `pet-euhz.vercel.app` apunta al nuevo Production y `dpl_Ro1wMoPe4AN8AN3f3sCuUpHRbcug` permanece como rollback manual.
- Gates: typecheck y lint PASS; suite 389/389; emulador focal 10/10; build/prerender 51/51; scan `e3d3eeed-2d48-4042-a13e-3fb3f1d41dba` con 0 hallazgos.
- Verificación pública: rutas y bundles `200`, paneles `private, no-store`, `sw.js` en `pet-ap-static-v3`, build y runtime sin errores. La prueba autenticada draft→submit→lectura sigue pendiente.

## Antecedente 24-ago-2026 — reporte canónico local previo a publicación

- Se definió `walkReports/{walkSessionId}` como documento único y determinista ligado a `walkSessions`.
- El candidato local exige Walker activo y asignado; el borrador es editable, el envío requiere sesión `completed` y luego queda inmutable.
- Familia con claim customer explícito lee únicamente su reporte enviado; Admin/Supervisor leen operación; usuario sin claim, Walker ajeno o inactivo fallan cerrados.
- Fotografías privadas continúan bloqueadas: `mediaReferences` debe estar vacío y la UI explica que los uploads no están disponibles.
- En ese punto `WALK_REPORTS_ENABLED=false`; quedó superado por la publicación documentada arriba.
- La revisión de seguridad detectó que un Walker anterior podía editar un draft después de una reasignación. El candidato ahora vuelve a comparar la asignación vigente de `walkSessions` en cada update; regresión negativa incluida.
- Validación local: dominio 4/4; focal UI/flags 24/24; reglas en emulador Java 21 7/7; suite completa 385/385; typecheck PASS; lint PASS; build/prerender 51/51.
- Candidato temporal final SHA-256 `e5babfe55a248b42af7b621cfa7cb447213955a55583c9d5bb82b4a7f7fe6bcb`. Codex Security diff scan final `63111d72-51ec-49c5-9898-426f0702bcb2`: 8/8 archivos runtime, reglas revisadas manualmente/emulador, 0 hallazgos. TAC `not_granted` limita la visualización protegida, no la cobertura local.
- Limitación honesta: Admin muestra como máximo los últimos 50 reportes y todavía no ofrece filtros server-side. No se preparó índice ni se consultó producción.

## Actualización 24-ago-2026 — operación Walker y acceso público

- Causa raíz: la mutación Walker usaba `updateDoc` después de validar únicamente el estado renderizado; dos pestañas podían actuar sobre un estado obsoleto.
- Corrección local: `runTransaction` vuelve a comprobar sesión, `walkerId` y transición antes de escribir solo `status`, timestamp operativo y `updatedAt`.
- La tarjeta muestra timeline canónico, horario/ventana existente y una única acción siguiente. No genera ETA ni GPS.
- Landing y accesos reducen altura/ruido, corrigen clases de CTA y garantizan controles de al menos 44 px.
- Gates locales: typecheck PASS; lint PASS; focal 17/17; suite 379/379; emulador focal 16/16; build/prerender 50/50. La suite histórica de reglas conserva 21 divergencias conocidas (26 PASS/21 FAIL) fuera de este bloque.
- Preview aislado `dpl_FehBwmE5Z5MSdV4uTDGjUALSrMco` (`pet-euhz-8w721e0q3-abraham9.vercel.app`) READY; build remoto 50/50 y 0 errores runtime. El acceso HTTP directo está protegido por Vercel SSO, por lo que la inspección visual del DOM autenticado queda pendiente y no se confunde con un PASS.
- Codex Security diff scan `3239befa-827f-4a9f-a928-e0c95e3ca7c0`: 8/8 superficies revisadas, 0 hallazgos.

## Actualización 24-ago-2026 — dirección legacy y reserva

- QA autenticada reprodujo `permission-denied` al enviar una solicitud; el batch no confirmó éxito.
- El editor publicado no expone zona canónica, mientras el ruleset activo exige una zona existente y activa.
- El candidato local consulta direcciones y zonas activas con límites, marca la disponibilidad por ID exacto y bloquea antes de crear referencias o batches.
- Prueba focalizada: `reservation-flow-p0` 16/16 PASS. Sin despliegue ni escritura de datos.

## Resumen ejecutivo

```text
Estado general: operativo con transición canónica/legacy todavía visible
P0 abiertos: 0 confirmados; integridad de zona/referencias publicada
P1 abiertos: 7
Flujos funcionales: Auth Familia/Equipo; perfil customer; solicitud canónica; asignación UID; panel Walker; precios versionados
Flujos incompletos: QA autenticada de reportes; historial Familia unificado; notificaciones sin errores silenciosos; privacidad/ARCO operativa manual; tickets
Última validación: typecheck/lint PASS; 392/392 tests; emulador focal 11/11; build/prerender 51/51; seguridad 0 hallazgos (24-ago-2026)
Deployment activo: dpl_6b8g76T6mRrfTAVQaTcHoj7RxCLF detrás de pet-euhz.vercel.app; rollback dpl_Cy9SWvTJhHvJ5amrUytCFTwoJrLP
Ruleset activo: b1998c37-9e7f-4cba-8c45-f133cae16b18; SHA 3c84a994dbbc0e7eb6fd3c977c9577eab765a7377b52cd542e91a75ae03f0792
Índices: 12/12 remotos READY; 15 declarados localmente
Siguiente acción: aceptación autenticada en Safari del reporte con una sesión completada existente
```

## Hallazgos activos

### Cierre G1 — 29-ago-2026

- G1 `PRODUCTION`; R1 permanece `PRODUCTION` sin cambios.
- Ruleset `92037591-177a-4f8f-a1b0-db4add3dcab4`, SHA `d4ea2e63cb7b1033f919b378f5dc9e35dc901dc8e3865402b4d363b1ed03a95d`; 12/12 índices `READY`; facturación `false`.
- Production `dpl_sozWckpcWDftmUEqXpQv8DLB9zhV`; build 54/54, rutas, redirects, firma anónima `401`, consola, logs, SW y responsive PASS.
- No se cargaron imágenes ni se escribieron documentos. Pendiente: prueba Admin manual hasta antes del upload y primera publicación autorizada.

| ID | Pri. | Evidencia / causa raíz | Impacto | Corrección y pruebas | Regresión | Estado |
|---|---|---|---|---|---|---|
| AV-01 | P1 | `src/app/familia/page.tsx:51-52` y `familia/historial/page.tsx:31-32` todavía escuchan `reservations`; el flujo nuevo escribe `serviceOrders/walkSessions` (`submitReservation.ts:67-86`). | Una solicitud nueva puede no aparecer en vistas Familia antiguas o presentarse separada. | Usar hook canónico y mostrar legacy en sección read-only explícita. Probar vacío/error/duplicación. | Medio: documentos antiguos con campos heterogéneos. | detectado |
| AV-02 | P1 | `admin/reservas/page.tsx:92-117,155-284` conserva pagos, borrado y autoasignación legacy. El flag impide ejecutar, pero la implementación domina el archivo. | UX confusa y mayor riesgo de reactivación accidental. | Extraer pestaña legacy read-only; eliminar acciones del render cuando flag esté apagado, sin borrar código histórico aún. | Medio. | detectado |
| AV-03 | P1 | `WalkSessionModal.tsx:134` continúa siendo legacy, mientras el flujo nuevo vive en `walkReports/{walkSessionId}` con flag apagado. | El contrato seguro existe localmente, pero ningún usuario debe usarlo hasta publicar reglas y validar claims customer explícitos. | Publicar candidato en release aislado, activar flag en Preview y validar los tres roles; mantener uploads privados apagados. | Alto por privacidad/autorización. | corregido local; publicación bloqueada |
| AV-04 | P1 | `NotificationBell.tsx:58-65`, `familia/notificaciones/page.tsx:66` y `AdminChat.tsx:42,65` silencian errores con `.catch(() => {})`. | `permission-denied` o red parece éxito/ausencia de datos. | Estados explícitos y retry; pruebas de permiso/red. | Bajo. | detectado |
| AV-05 | P1 | `useServiceOrders.ts:71-79` vacía `orders` ante error, aunque conserva `error`. Consumidores deben renderizarlo antes del empty state. | Pantalla puede confundir error con vacío si ignora `error`. | Exigir discriminated state o pruebas de cada consumidor. | Bajo. | detectado |
| AV-06 | P1 | `customerProfile.ts:16-19` mantiene lectura `clients`; documentación antigua recomienda `clients` como canónico. | Riesgo de reintroducir esquema antiguo o perfilar datos parciales. | Mantener fallback fuera de onboarding, marcar origen legacy y auditar consumidores antes de retiro. | Alto sin inventario de datos. | detectado |
| AV-07 | P1 | `firebase.json` aún declara Functions y `functions/index.js` existe, aunque `CLOUD_FUNCTIONS_ENABLED=false`. | Un deploy Firebase indiscriminado podría intentar un target no permitido en Spark. | Documentar y usar siempre targets exactos; candidato futuro para separar config, sin borrar legado. | Medio. | detectado |
| AV-08 | P2 | `AdminChat.tsx:22-35`, `AdminCoupons.tsx:36`, `admin/referidos/page.tsx:36` carecen de `limit`. | Lecturas crecientes y costo/cuota. | Añadir límites/paginación cuando se reactive cada módulo. | Bajo. | detectado |
| AV-09 | P2 | Documentos `DATA_INVENTORY.md`, `AUDITORIA_PET_AP_v5.md` y `TESTING.md` aún describen `clients/pets`, `users.role`, tema oscuro, FCM/Functions y rutas obsoletas. | Próximos agentes pueden tomar decisiones inseguras. | Este mapa prevalece; marcar históricos y actualizar referencias gradualmente. | Bajo. | corregido documentalmente |
| AV-10 | P2 | Comentario de `src/middleware.ts:17-21` dice que Cloud Functions autorizan, contrario al MVP Spark. | Confusión arquitectónica, no fallo runtime. | Cambiar comentario cuando se toque middleware; no altera comportamiento. | Nulo. | detectado |
| AV-11 | P2 | `useEligibility.ts:50` calcula elegibilidad con `reservations` legacy. | Reseñas/lealtad futuras no reconocerán sesiones canónicas. | Migrar cálculo a `walkSessions` + pago confirmado cuando exista backend. Mantener funciones apagadas. | Alto si se activa antes. | detectado |
| AV-12 | P2 | `useWalkerAvailability.ts:25` consulta `walkers`, mientras identidad operativa canónica es `walkerProfiles`. | Disponibilidad futura puede discrepar del onboarding real. | No consumir en asignación canónica; adaptar solo tras definir proyección segura. | Medio. | detectado |
| AV-13 | P1 | La consulta read-only del 22-ago-2026 confirmó que `admin/prices` y `appSettings/servicePrices` no existen. Git conserva listas contradictorias; `67b2312` etiqueta una como “precios finales”, pero no es confirmación comercial vigente. | Ningún servicio puede habilitarse honestamente hasta decisión del propietario. | Confirmar una única tabla; capturar desde Admin y verificar centavos/MXN/versiones/proyección antes de reservar. | Alto si se reutiliza un valor histórico sin aprobación. | requiere validación humana |
| AV-14 | P0 | `StepV2Address.tsx` fabricaba `addr_${Date.now()}` sin documento y `ReservationFlow` esperaba un campo `address` inexistente. | Solicitud con referencia inválida o etiqueta vacía. | Solo direcciones canónicas; formato derivado de campos reales; zona obligatoria; prueba `reservation-flow-p0`. | Bajo. | corregido/validado local |
| AV-15 | P1 | `admin/paseadores` infería “Invitado” desde `config.walkers[].uid`; ignoraba `walkerProfiles/{uid}.status`. | Estado engañoso para un Walker activo y estadísticas por identidad legacy. | Resolver perfil canónico y usar UID; puente por email solo para localizar el UID en registros legacy sin migración. | Medio hasta retirar config legacy. | corregido local |
| AV-16 | P1 | Familia entraba al panel con perfil mínimo, aunque faltaran teléfono, zona/dirección o perro. | Reserva incompleta y errores tardíos. | Guard de completitud y asistente idempotente por UID; zona solo desde `zones` activas; La Quebrada explícita. | Medio; requiere QA autenticada y emulador. | corregido local |
| AV-17 | P0 | La UI limitaba zonas activas, pero las reglas aceptaban `addresses.zoneId` arbitrario y no comprobaban que order/session referenciasen dirección y perro propios ni que coincidieran entre sí. | Un cliente manipulado podía contaminar la cola operativa con referencias cruzadas o una zona falsa. | Helpers `isActiveZone`, `ownsSavedAddress`, `ownsSingleDog`, `validConfiguredService` y `requestedSessionMatchesOrder`; suite focal 12/12; ruleset `981bae3b…09ad`. | Medio: direcciones legacy sin zona activa deberán corregirse antes de usarse; no hay migración automática. | corregido/validado/desplegado |
| AV-18 | P1 | Familia tenía trece enlaces en navegación de escritorio sin una variante móvil compacta; el asistente no permitía volver ni enfocaba el campo exacto faltante. | Navegación amontonada y corrección de formularios poco clara en teléfono. | `AppShell` usa menú desplegable cuando hay más de cuatro destinos; onboarding añade retorno, validación por campo y preferencia por dirección zonificada. | Bajo; `/login` verificado sin overflow a 390/768/1024/1440. El asistente privado requiere QA autenticada manual. | validado local |
| AV-19 | P1 | El botón GIS pedía un ancho fijo de 320 px sin considerar el ancho real de su contenedor. | Podía forzar recorte visual en superficies estrechas o embebidas. | Se mide el contenedor y se limita el botón a `min(320, ancho disponible)`; el contenedor y la página fallan cerrados contra overflow horizontal. | Bajo; no cambia OAuth ni el flujo de autenticación. | validado local |

## Historial de validación

| Fecha | Alcance | Resultado |
|---|---|---|
| 2026-08-22 | Reglas activas vs candidato precios | Coincidencia byte a byte salvo una línea final vacía; sin cambio funcional concurrente |
| 2026-08-22 | Mapa vivo + P0 precio/reserva | Typecheck y lint correctos; 344/344; emulador Firestore 43/43; build y prerender 49/49; `git diff --check` focalizado correcto |
| 2026-08-22 | Recuperación read-only de tarifas | Documentos de precio actuales ausentes; historial Git y dos órdenes proyectadas comparados sin datos personales ni escrituras |
| 2026-08-22 | Base visual + onboarding/zona | Typecheck y lint PASS; 16 pruebas focalizadas de onboarding/UI y suite completa 375/375 PASS; build y prerender 50/50 PASS; viewport exacto sin overflow en 390/768/1024/1440. Emulador: 38/59 con las 21 divergencias históricas conocidas, sin ocultarlas ni tocar reglas. Sin acceso a producción. |
| 2026-08-22 | Preview onboarding/visual | `dpl_3JNwSg2QR1khBRtFL9dvZ5RVjbRH` READY. Payload aislado: ocho diferencias runtime, 244 archivos totales y cero archivos prohibidos; build Vercel/prerender 50/50. Rutas públicas 200, privadas 307 al login correcto, `sw.js` 200 y sin errores runtime registrados. Production sin cambios. |
| 2026-08-22 | Integridad zona y solicitud canónica | Baseline remota `4c7a529d…e705`/`458210…773`; candidato final `b6df2281…c61e`; focal emulador 12/12, suite unitaria 361/361, build/prerender 50/50 y roles baseline 3/3. Suite P0.4 completa: 21 divergencias ya presentes en baseline activa, fuera del diff autorizado. Sin publicación ni datos reales. |
| 2026-08-22 | Onboarding y navegación móvil Familia | Typecheck y 33 pruebas focalizadas PASS. Zona persiste por ID en dirección propia; validación señala campo exacto; menú móvil no comprime trece enlaces. Pendiente suite/build/emulador/QA visual. |
| 2026-08-22 | Aceptación previa de tres paneles | Ruleset `981bae3b…09ad`, SHA `b6df2281…c61e`, facturación desactivada e índices 12/12 READY confirmados read-only. Emulador focal de integridad/precios 32/32 PASS; suite P0.4 conserva exactamente 21 divergencias históricas conocidas. La sesión Safari visible estaba en el Preview temporal sin autenticar, por lo que Familia/Admin/Walker autenticados quedan BLOQUEADOS hasta takeover en el dominio estable y, para el runtime nuevo, autorización independiente de promoción. |
| 2026-08-22 | Publicación onboarding/navegación | Preview `dpl_3JNw…jbRH` promovido por Vercel a Production `dpl_A4v…nC6X`, READY; alias estable confirmado. `/`, `/login`, `/equipo` cargan; rutas privadas redirigen correctamente; `/familia/configuracion-inicial` existe y redirige al login sin sesión. Navegador sin overlays, errores de consola ni imágenes rotas; logs de error vacíos; SW `pet-ap-static-v3` excluye rutas privadas. Rollback anterior conservado. |
| 2026-08-24 | Aceptación autenticada Admin | Takeover en Safari alcanzó `/admin/reservas`; la URL permaneció autenticada tras recarga. Logs del mismo recorrido muestran `/admin`, `/admin/reservas`, `/admin/chat`, `/admin/ia` y `/admin/resenas` con HTTP 200 y cero errores de runtime. Safari no permite inspección DOM por automatización sin activar un permiso de desarrollo que no se modificó; contenido, responsive y datos permanecen pendientes de confirmación humana. |
| 2026-08-24 | Aceptación autenticada Walker | Safari expuso el panel `/walker`: perfil Abraham 2, navegación a inicio/historial/perfil, copy de sesiones solo por UID y vacío real de cero paseos. Logs muestran `/walker`, `/walker/historial` y `/walker/perfil` con HTTP 200 y sin errores runtime. La recarga dirigida fue interrumpida al cambiar el usuario de pestaña; persistencia y logout quedan pendientes de una comprobación manual final. |
| 2026-08-24 | Aceptación autenticada Familia | Customer existente entró directamente a `/familia` sin repetir onboarding. Inicio, perros, direcciones, historial anterior, notificaciones y nueva reserva cargaron sin 404; dirección conserva zona y el flujo detecta dos perros existentes sin crear duplicados. El historial legacy está rotulado solo lectura y la solicitud canónica aparece separada en inicio. Se detectó una sesión histórica completada con inicio y fin iguales; no se modificó. Precios/paquete semanal requieren comprobación manual del paso 4 sin enviar otra reserva. |
| 2026-08-24 | P0 ruta de reporte inexistente | Emulador focal 11/11 y Codex Security `286a57df-6fab-4758-92c8-d73179f40087` sin hallazgos. Ruleset `b1998c37…6b18`, SHA `3c84a994…0792`, coincidencia byte a byte; 12/12 índices READY y billing desactivado. La suite histórica conserva exactamente 21 divergencias conocidas (26/47). |
| 2026-08-24 | Visibilidad de reportes e historial canónico | 22/22 focal, 392/392 suite, typecheck/lint PASS y build/prerender 51/51. Walker muestra completados anteriores; Familia prioriza `walkSessions`; Admin filtra/reintenta sin ampliar su lectura de 50. Pendiente payload aislado y QA autenticada. |

## Regla de mantenimiento

Cada corrección debe actualizar: hallazgo, estado, prueba, flujo afectado y fuente de verdad. No cerrar un hallazgo solo porque compile.

## Cierre G1-Legacy — 31-ago-2026

- **Causa raíz:** acceso directo a `record.format.toUpperCase()` sobre un documento legacy sin `format` provocaba el error fatal de `/admin/galeria`.
- **Corrección:** parser con allowlist y tipos, presentación read-only del contrato legacy observado y error aislado por documento inválido. Los handlers aceptan exclusivamente `CompatibleGalleryRecord`.
- **Evidencia:** focales 8/8, suite 430/430, typecheck/lint PASS, build 54/54 y Security `f4aef74b-582a-43f0-bf80-f5dcc13bef8e` sin hallazgos.
- **Publicación:** Preview `dpl_CnSHPZuma1UdcdcWGGu9dSmFM3ow` → Production `dpl_3UKuaScTnkEhVy3c2Mc8MwZC75W7`; rollback `dpl_sozWckpcWDftmUEqXpQv8DLB9zhV`.
- **Datos:** cero uploads, cero escrituras, cero migraciones; el registro legacy real permanece intacto.

## Cierre O1 — 1-sep-2026

- **Causa raíz:** el matching anterior consideraba la raíz Admin activa en todas sus subrutas y la navegación larga carecía de grupos, cierre explícito accesible y aplicación consistente de 44 px/foco.
- **Corrección:** helper de rutas único, grupos Admin, `Link` interno, drawer móvil con Escape, movimiento reducido, foco visible y objetivos táctiles de 44 px.
- **Evidencia:** 11/11 focales, 434/434 suite, typecheck/lint PASS, build/prerender 54/54, QA 390/430/768/1024/1440 sin overflow ni controles Header menores de 44 px. Security `cb61738a-138b-468b-829e-be2ae3456d01`: 7/7, cero hallazgos.
- **Publicación:** Preview `dpl_6PXCey3Swi3vULMFLT4cC18uw2gB` → Production `dpl_Gzys5ZJwnN9Rta2dTZgktvCX11L1`; alias estable confirmado; rollback `dpl_3UKuaScTnkEhVy3c2Mc8MwZC75W7`.
- **Firebase/datos:** ruleset `92037591-177a-4f8f-a1b0-db4add3dcab4` SHA `d4ea2e63…a95d`, índices 12/12 READY y facturación desactivada; cero escrituras y cero cambios de permisos.
- **Deuda no atribuible:** la suite histórica amplia reprodujo 18 divergencias; onboarding/tickets focales pasan y O1 no contiene reglas.
