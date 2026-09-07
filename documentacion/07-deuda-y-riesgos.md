# Deuda y riesgos — PET Ap

## Cambios locales del 22-ago-2026 pendientes de Preview

- El bloque local del 24-ago-2026 endurece la transición Walker contra estados obsoletos y presenta una línea de progreso sin ETA inventada. Requiere Preview aislado y aceptación autenticada antes de considerarse publicado.
- Preview técnico READY: `dpl_FehBwmE5Z5MSdV4uTDGjUALSrMco`. Vercel SSO bloquea la QA pública automatizada del DOM; no se modificó OAuth para sortearlo y Production permanece intacto.

- El onboarding Familia ya distingue perfil incompleto y exige una dirección con zona activa y un perro; la QA pública no presenta overflow en 390/768/1024/1440, pero falta QA autenticada del asistente en Safari/Android antes de Production.
- El Preview aislado `dpl_3JNwSg2QR1khBRtFL9dvZ5RVjbRH` está protegido por Vercel SSO: HTTP autenticado, build y rutas están verificados; la revisión visual privada debe realizarse manualmente sin añadir el dominio temporal a OAuth.
- La Quebrada se selecciona únicamente si existe como documento activo; el texto escrito nunca crea ni asigna una zona.
- `admin/paseadores` conserva un puente read-only por email para vincular entradas `config.walkers` sin UID con `walkerProfiles`. Debe retirarse cuando la configuración legacy tenga UID o deje de ser consumida.
- Las direcciones existentes sin zona quedan bloqueadas para reservar hasta que el propietario seleccione cobertura; no hay migración automática.
- Una sesión histórica que guardó el rango completo en `scheduledStart` no se corrige automáticamente. Las nuevas solicitudes guardan inicio y fin por separado.
- El ruleset `981bae3b-850b-4e38-8cdc-0c1fb91d09ad` (SHA-256 `b6df2281d39034b10e4736edecca75ff09973fc2502cd7174e24c139f2b1c61e`) está activo y valida precio/versionado, zona activa y referencias canónicas.

## Registro priorizado

| ID | Pri. | Riesgo | Evidencia | Mitigación / aceptación |
|---|---|---|---|---|
| DR-01 | P1 | Historial Familia no refleja de forma única el modelo canónico | `familia/page.tsx:51`, `familia/historial/page.tsx:31` leen `reservations` | Unificar con `useServiceOrders/useCanonicalWalkSessions`, conservar sección legacy read-only; pruebas de no duplicación. |
| DR-02 | P1 | Panel Admin mezcla operación canónica y código legacy mutador | `admin/reservas/page.tsx:92-284`; flag bloquea, pero código permanece | Extraer legacy read-only y ocultar acciones falsas; no borrar hasta revisar consumidores. |
| DR-03 | P1 | Reglas y runtime de reporte publicados; falta QA autenticada | Ruleset `b1998c37…6b18`; Production `dpl_6b8g76…`; historial canónico Familia; editor Walker con anti doble clic | Validar draft→submit→lectura por tres roles con una sesión completada existente, sin crear fixtures de producción. |
| DR-04 | P1 | Errores de notificaciones/chat se silencian | `NotificationBell.tsx:58-65`, `AdminChat.tsx:42,65` | Estados permission/network y retry; nunca presentar éxito falso. |
| DR-05 | P1 | Tarifas comerciales aún no capturadas | El esquema admite `null`; `servicePricing.ts:106-109` muestra “Precio no configurado” | Propietario captura importes reales en Admin; prueba controlada posterior. Nunca sembrar valores. |
| DR-06 | P1 | Config Firebase incluye target Functions en un proyecto Spark | `firebase.json:2-5`; flags desactivan runtime | Usar siempre deploy target exacto; nunca `firebase deploy` general. Separación futura de configuración. |
| DR-07 | P1 | Vercel Hobby no es base comercial confirmada | `HOSTING_COMPATIBILITY.md` | Evaluar Cloudflare/OpenNext gratis con prueba de bundle/CPU antes de migrar. |
| DR-08 | P2 | Queries sin límite en módulos no prioritarios | `AdminChat.tsx:22-35`, `AdminCoupons.tsx:36`, `admin/referidos/page.tsx:36` | Paginación/límites al reactivar; no ampliar reglas. |
| DR-09 | P2 | Elegibilidad todavía depende de `reservations` | `useEligibility.ts:50` | Mantener reviews/lealtad apagadas; migrar cálculo a sesiones pagadas/completadas con backend seguro. |
| DR-10 | P2 | Doble modelo walker | `useWalkerAvailability.ts:25` usa `walkers`; flujo real usa `walkerProfiles` | Declarar `walkerProfiles` canónico; retirar consumidor solo tras pruebas. |
| DR-11 | P2 | Documentación histórica contradice arquitectura vigente | `DATA_INVENTORY.md`, `AUDITORIA_PET_AP_v5.md`, `TESTING.md` | Estos documentos 04–07 son índice vivo autoritativo técnico; marcar históricos en actualización posterior. |
| DR-12 | P2 | Audit logs del navegador no son auditoría privilegiada | `audit.ts:11`, `auditLog.ts:18` crean `audit-logs` | Reglas deben denegar; separar eventos de producto. Backend futuro. |
| DR-13 | P2 | PET Ahora conserva código de escrituras/listeners | `usePetAhoraDispatch.ts:30-173`, `usePetAhoraWalker.ts:21-65` | Flags bloquean entrada; pruebas deben verificar cero listeners/escrituras. No abrir reglas. |
| DR-14 | P2 | Cancelación pública conserva query por teléfono | `cancelar/page.tsx:52-75` | Flag apagado; mantener acceso autenticado Familia/contacto manual. Retirar consumidor tras comprobar enlaces. |
| DR-15 | P2 | Repositorio muy sucio y sin baseline versionada de las fases | `git status --short`: más de 100 archivos modificados/no versionados | Preservar; usar manifiestos focalizados para previews. No reset/restore/checkout. |
| DR-16 | P3 | Tickets e impresión no implementados | `FINANCIAL_ARCHITECTURE_F0.md`, `finance/domain/tickets.ts` | Siguiente fase local: contrato→snapshots→folios→builder→ESC/POS→CP850→QR→queue→transport. |
| DR-17 | P0 cerrado | Reglas de zona/dirección/perro/order/session podían aceptar referencias manipuladas | Ruleset `981bae3b…09ad`, focal 12/12; SHA `b6df2281…c61e` | Cerrado; vigilar direcciones legacy sin zona, sin migrarlas automáticamente. |
| DR-18 | P1 reglas históricas | La suite P0.4 aspiracional tiene 21 diferencias frente al ruleset que ya está activo (galería, PET Ahora, logs, perfiles y otros dominios no incluidos en este cambio) | Comparación real baseline/candidato; no son regresiones introducidas por el diff focal | Tratar en releases independientes basados en baseline activa; no mezclar con zona/precios ni cambiar tests para ocultarlas. |
| DR-19 | P0 de aceptación | El runtime nuevo ya está en Production, pero no existe todavía evidencia autenticada posterior al despliegue para los tres roles | Production `dpl_A4v…nC6X`; rutas públicas y redirects PASS | No declarar PASS de los tres paneles. Solicitar takeover en Safari y no crear una segunda reserva real. |
| DR-20 | P2 observabilidad visual | Safari no expone el contenido WebKit a la captura/árbol accesible y bloquea `do JavaScript` desde Apple Events por configuración segura | URL y logs sí son observables; no se cambió Safari | Separar evidencia automática de ruta/runtime de la confirmación visual humana; no pedir habilitar permisos de desarrollo solo para QA. |
| DR-21 | P1 dato histórico | Una sesión canónica ya completada muestra la misma hora de inicio y fin en Familia | Evidencia visual autenticada del 24-ago-2026; el runtime nuevo valida solicitudes futuras | No corregir ni migrar sin autorización; clasificar y auditar el documento histórico de forma separada. |
| DR-22 | P0 runtime | Production permite avanzar con una dirección cuya zona no puede demostrarse activa y Firestore rechaza el batch | QA autenticada: `permission-denied`; editor publicado sin selector de zona; reglas activas exigen referencia activa | Candidato local bloquea la dirección antes del submit y enlaza su actualización manual; requiere Preview aislado. |
| DR-23 | P1 cerrado en reglas | Compatibilidad customer sin claim necesitaba mínimo privilegio | Ruleset activo permite solo `get` propio `submitted`; claims desconocidos y Walker no heredan customer; `users.role` no participa | Mantener pruebas de regresión y no ampliar a list/create/update. |
| DR-24 | P2 operación | La vista Admin de reportes carga solo los últimos 50 y no tiene filtros server-side | `src/app/admin/reportes/page.tsx` usa `orderBy(updatedAt desc), limit(50)` | Definir filtros necesarios e índices candidatos antes de ampliar; no descargar toda la colección ni filtrar globalmente en cliente. |
| DR-25 | P1 QA | El P0 de ruta inexistente y la visibilidad runtime están desplegados, pero no se ha creado/enviado un reporte real | Ruleset `b1998c37…6b18`; Production `dpl_6b8g76…`; suite focal y seguridad PASS | Probar una sola sesión completada existente en Safari; no crear fixtures ni avanzar sesiones. |

## Riesgos que requieren decisión o autorización

1. **Tarifas reales:** solo el propietario puede capturarlas; el sistema debe permanecer no solicitables mientras sean `null`.
2. **Datos legacy:** cualquier clasificación, migración o archivado exige lectura controlada y autorización independiente.
3. **Publicación:** reglas, índices, Vercel Production y alias requieren preflight y autorización explícita.
4. **Privacidad/legal/fiscal:** los documentos son borradores operativos; requieren revisión profesional en México.
5. **Backend financiero:** ninguna mutación debe salir del dominio puro F1 hasta contar con backend privilegiado gratuito, idempotente y probado.

## Criterio de cierre de P0/P1 actual

- Tarifas reales capturadas sin `$0` implícito.
- Familia selecciona un servicio activo, conserva selección y crea solo order/session.
- Admin ve la solicitud y asigna por UID con transacción.
- Walker ve solo la sesión propia y puede transicionar secuencialmente.
- Errores de permiso/red no se presentan como vacío o éxito.
- Emulador, suite completa, build/prerender y revisión responsive pasan.
- Una prueba real controlada usa datos proporcionados por el propietario y no toca legacy.

## Riesgo residual G1 — 29-ago-2026

- G1 quedó publicado con reglas y runtime coherentes; no hay P0/P1 nuevo en rutas públicas, consola, logs o responsive.
- La primera carga/publicación real continúa pendiente y debe usar una imagen con consentimiento y derechos confirmados; no se probará con datos ficticios.
- La retirada oculta la proyección pública, pero no afirma borrar el asset remoto de Cloudinary. La eliminación física sigue fuera de alcance.
- Las credenciales Cloudinary son server-only salvo el nombre público del cloud; no deben copiarse a bundles, documentos ni logs.

## Riesgo retirado G1-Legacy — 31-ago-2026

- Retirado el P0 de disponibilidad causado por asumir `gallery-images.format` como `string`.
- Los documentos anteriores quedan deliberadamente fuera del contrato G1 mutable y de `gallery-public`; no se infieren consentimiento, derechos, formato ni procedencia.
- Riesgo residual controlado: la migración/eliminación del documento legacy requiere una fase y autorización separadas. La observación visual autenticada final permanece read-only.

## Riesgos O1/T3 — 1-sep-2026

- **Retirado O1:** raíz Admin doblemente activa, drawer sin cierre explícito/Escape y controles compartidos menores de 44 px en el Header y regreso de Perros.
- **Residual UI:** páginas secundarias aún contienen estilos y tarjetas legacy; migrarlas por consumidor, no con reescritura global. O1 no declara terminado el rediseño completo.
- **Deuda de reglas preexistente:** la ejecución actual de la suite histórica amplia conserva 18 divergencias; no son regresión O1. Registrar por dominio antes de tocar reglas.
- **Bloqueador T3:** cualquier endpoint que escriba pagos/ledger requiere identidad server-only con mínimo privilegio, decisión IAM/credencial del propietario, idempotencia persistente y auditoría. Hasta resolverlo, el backend debe fallar cerrado y ninguna UI puede aparentar procesar dinero.
- **Rollback O1:** `dpl_3UKuaScTnkEhVy3c2Mc8MwZC75W7`; no ejecutar automáticamente.
