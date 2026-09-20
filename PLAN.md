# Plan de rediseño de PET Ap

Estado al 2026-09-19 (cuarta vuelta: del rediseño a lo que la app puede hacer). Cada fase se cierra por completo antes de abrir la
siguiente, y cada una deja su prueba: si no hay prueba, la fase no está cerrada.

Las reglas que rigen todo esto viven en [AGENTS.md](AGENTS.md); lo que puede
romper la operación, en [CRITICO.md](CRITICO.md).

---

## Cerradas

| # | Fase | Qué cambió | Su prueba |
|---|---|---|---|
| 0 | Reglas de trabajo | AGENTS.md pasó de diario a reglas | `accesibilidad-base` |
| 1 | Escala tipográfica | 2xs 10→12px, xs 12→13, sm 14→15. Ocho archivos con tamaños crudos. `PageHeader` a `h1` | `accesibilidad-base` |
| 2 | Área táctil | Piso de 44×44 en la hoja base: cubría 177 botones de un tiro | `accesibilidad-base` |
| 3 | Reducir movimiento | `MotionConfig reducedMotion="user"`: framer-motion obedece en 36 archivos | `accesibilidad-base` |
| 4 | Etiquetas | 15 campos sin nombre. Detector con parser, no regex | `campos-etiquetados` |
| 5 | Peso | Firebase Storage fuera (no lo usaba nadie), editores de Configuración diferidos. 340→324 kB | — |
| 6 | Permisos | `dogs`/`addresses` exigen límite; notificaciones sólo marcan leído. Huecos 5→3 | emulador |
| 7 | Inicio de familia | Tarjetas `div onClick` → botones; tarjeta muerta de lealtad fuera | `accesibilidad-base` |
| 8 | Controles activables | Los 25 `onClick` restantes resultaron todos legítimos; la prueba reconoce los tres patrones válidos | `controles-interactivos` |
| 9 | Densidad de los cuatro paneles de operación | `/walker` abre en el paseo que toca; `/familia` en su próximo paseo; Solicitudes en la que urge; Resumen en lo que falta asignar. Lo demás, a un toque. De paso, seis defectos de datos (lista abajo) | `walker-jornada`, `family-home`, `admin-solicitudes`, `admin-resumen`, emulador |
| 10 | Consultas que traían lo más viejo | Cada pantalla pide su rango de fechas (14, 30, 31 o 60 días; los historiales, un mes a la vez). Los ganchos aceptan `since`/`until` y avisan con `capped` | `ventanas-recientes` |
| 12 | Las tres decisiones de arquitectura | PET Ahora ya despachaba desde `dispatchServer.ts` server-side (transacciones, sin duplicar oferta); faltaba cerrar la regla de `petAhoraOffers`/`petAhoraLeases`, ahora `if false`. Bitácora administrativa: `/api/admin/audit-log` nuevo, verifica admin por token y escribe con el T3 privilegiado -- el actor ya no lo declara el navegador; los tres call sites (`resenas`, `EditReservationModal`, `LegacyReservationsView`) migrados, `lib/audit.ts` duplicado eliminado, regla de `audit-logs` cerrada. Historial legacy: `reservations` ahora sólo lee, cerrado `create/update/delete` en la regla (todo el código ya estaba detrás de `LEGACY_RESERVATION_WRITES_ENABLED`, permanentemente apagada) | emulador |
| 13 | Las 11 pruebas de reglas desactualizadas | La mayoría eran la prueba, no la regla: faltaba el claim de `email` en el helper de autenticación, o `serverTimestamp()` donde la regla exige `request.time` en `createdAt`/`updatedAt`. Dos sí eran huecos reales: `serviceOrders` no reconocía el campo legacy `clientId` en lectura (mismo patrón que `isReservationClient()`), y no tenía ninguna vía para que Admin corrigiera una orden atascada (ahora sólo `status: 'confirmed'` + `paymentStatus: 'under_review'`, nada más). Y una sorpresa: `privacyRequests` no tenía ningún bloque de reglas -- las solicitudes ARCO desde Familia PET se habían estado rechazando en silencio; ahora tiene su regla, calcada del payload real que ya escribe la página | emulador |
| 11 | Peso de la primera carga | `db` salió de `@/firebase/config`: el SDK de Firestore ya no viaja con las pantallas que sólo necesitan sesión. Portada 297→190 kB, acceso de familia 279→171, acceso del equipo 284→177. Los paneles no bajan: ahí se usa | `peso-primera-carga` |
| 14 | Densidad del resto de los paneles | Mis perros 789→206 líneas, Mis direcciones 613→184, Zonas 584→217: el formulario se carga al abrirlo, no al entrar. Familias, Perros de admin y Rutas se revisaron y ya abrían bien | `densidad-paneles` |
| 16 | Peso de los paneles | Cada panel y cada armazón se piden con `dynamic`: el SDK de Firestore deja de bloquear la primera pintura. Los cuatro paneles diarios pasaron de ~323 kB a 91 kB de primera carga, y ninguna ruta pasa de 250 | `next build` |
| 15 | Animaciones | Tres gestos en CSS -- algo llegó, algo cambió, algo está pasando -- bajo el bloque de reducir movimiento que ya existía. Sin JavaScript nuevo: la lista de perros dejó de traer un componente animado por tarjeta | `animaciones` |
| 17 | Que el paseo se explique solo | La familia cancela desde la app y ve el recorrido mientras ocurre; el chat suena de los dos lados; los avisos al teléfono vuelven a ser posibles y hay dónde comprobarlos | `familia-cancela`, `paseo-en-vivo`, `avisos-al-telefono`, emulador |
| 18 | Reagendar sin cancelar | La familia mueve su paseo a otro día; mover suelta al paseador y el paseo vuelve a la cola, y eso se dice antes de confirmar | `familia-cancela`, emulador |
| 19 | El recordatorio de la tarde anterior | Tarea programada a las 19:00: aviso a cada familia con paseo mañana y a cada paseador con paseos asignados, sin repetir | `recordatorios` |
| 20 | Asignar con la sugerencia puesta | La cola ordena a los paseadores por zona, continuidad con el perro y carga de ese día, con el motivo en palabras; quien llegó a su tope va al final | `sugerencia-asignacion` |
| 21 | Que un paseo no se caiga en silencio | Guardia de la mañana: un solo aviso a quien opera con los paseos de hoy sin paseador y los de días pasados sin cerrar | `guardia` |
| 22 | El paseador ve a dónde llegar | La ficha del paseo trae la dirección de recogida (calle, colonia, referencias, cómo entrar) y la abre en Google Maps. Sólo mientras el paseo sigue en pie: al completarse ya no viaja, y nunca viajan teléfono, nombre ni correo de la familia | `walker-walk-sheet` |
| 23 | Estrellas al terminar el paseo | Como al bajar de un viaje: el inicio de la familia pregunta "¿Cómo estuvo el paseo de {perro} con {paseador}?" durante 3 días, sólo si hubo paseador y se puede decir "ahora no". Una calificación enviada esconde la tarjeta | `family-home` |
| 24 | El chat es sólo con el paseador, y con horario | La familia ya no escribe a administración. El chat de un paseo se abre 2 horas antes y cierra 3 después; lo aplican las reglas de Firestore, no sólo la pantalla, y la pantalla dice por qué está cerrado | `chat-ventana`, emulador |
| 25 | Los avisos explican su fallo y se ofrecen donde la gente está | La prueba de avisos ya no dice "0 enviados": distingue "no hay teléfonos registrados" de "FCM rechazó el envío" y dice el motivo. Y los tres inicios ofrecen activarlos una vez, porque el control vivía en pantallas a las que nadie entra | `avisos-al-telefono` |
| 26 | Los paneles muestran lo que ya sabían | La familia ve la cara de su perro y el refuerzo que anotó y nunca volvía a ver; el Resumen dice quién está en la calle; el paseador ve su calificación donde trabaja. La espera lleva huellas y ningún hueco vacío queda sin ícono | `cuidados-perro`, `admin-resumen`, `walker-reviews`, `perritos-en-la-marca` |

**Los seis defectos que encontró la fase 9**, todos con prueba:
1. La jornada del paseador pedía sus 100 paseos más antiguos: con más de cien, dejaba de ver los de hoy.
2. "Reportes pendientes de cierre" listaba completados aunque su reporte ya se hubiera enviado.
3. "Solicitudes actuales" de la familia mostraba los cinco paseos más antiguos de la cuenta.
4. Pendientes del Resumen: sólo contaba solicitudes con fecha hasta hoy; las de mañana en adelante no aparecían.
5. "Hoy" del Resumen se calculaba en UTC: en México, pasadas las 18:00, ya era mañana.
6. La tarjeta de trabajo del paseador decía "tus 100 paseos más recientes"; eran los más antiguos.

Y dos de peso: el layout de admin escuchaba `reservations` en cada panel, y el
Resumen leía 100 perfiles de familia para un conteo que no mostraba.

---

## Abiertas, en orden

El rediseño (fases 0-16) está cerrado. Lo que sigue ya no es cómo se ve la app,
sino qué puede hacer. El criterio para elegir: **cuánto trabajo manual le quita
al negocio, o cuánta preocupación le quita a una familia.**

Ninguna. Lo que quedó pendiente no es código: está en
[CRITICO.md](CRITICO.md) -- comprobar en producción lo que ya se corrigió, y las
tres cosas que sólo el dueño puede destrabar (la cuenta de Apple, el precio del
plan de adiestramiento y `CRON_SECRET` en Vercel).

Lo siguiente que merezca una fase saldrá de ahí: de lo que falle en la calle,
no de una lista escrita de antemano.

---

## Lo que aprendimos, y conviene recordar

- **Cuando un defecto aparece cientos de veces, casi nunca se arregla cientos de
  veces.** La escala, el piso táctil, el movimiento y los encabezados se
  resolvieron en un archivo cada uno.
- **Medir con grep miente.** Dos veces reporté números inflados (15 pantallas sin
  h1 que eran 3; 91 campos sin etiqueta que eran 15) por contar líneas en vez de
  parsear. Los detectores buenos quedaron como pruebas.
- **La prueba encuentra más que la revisión.** Dos veces destapó defectos que no
  estaba buscando.
- **La ventana era mejor arreglo que el índice.** La fase 10 iba a pedir
  índices descendentes y un despliegue. Acotar el rango de fechas resuelve lo
  mismo sin tocar la infraestructura: si el rango cabe en el tope de 100, el
  orden deja de importar. Y donde no cabe -- un mes con más de cien paseos --,
  la pantalla lo dice (`capped`) en lugar de enseñar números que no cuadran.
- **Lo que sólo se ve al abrir un panel, no se ve.** Insights detectaba desde
  hace tiempo los paseos de hoy sin paseador; nadie se enteraba hasta que la
  familia llamaba. Una señal sin quien la lleve no sirve: ahora la lleva una
  tarea programada.
- **Una variable con otro nombre apaga una función entera sin decir nada.** Los
  avisos al teléfono llevaban semanas muertos porque la llave estaba guardada
  como `NEXT_PUBLIC_FIREBASE_VAPID` y el código pedía `..._VAPID_KEY`. Cuando
  algo depende de una variable de entorno, tiene que haber una pantalla que diga
  si está o no: lo que falla callado no se arregla.
- **Diferir no es adelgazar, y hay que decirlo.** Los paneles bajaron de 323 kB
  a 91 kB de primera carga porque su código llega aparte, no porque pese menos:
  el total descargado es casi el mismo. Lo que cambia es que la pantalla se
  dibuja mientras llega, en vez de después.
- **Un tope en las reglas no recorta: rechaza.** Pedir 600 perros donde la
  regla permite 100 no devuelve cien: deja la pantalla vacía con un mensaje de
  permisos. Perros, Familias e Insights vivieron así desde la fase 6 porque
  ninguna prueba listaba como admin contra las reglas de verdad.
- **Medir con una ventana de caracteres vuelve a mentir.** Buscando consultas
  sin límite, un detector con ventana de 400 caracteres acusó a veinte consultas
  sanas. Con paréntesis balanceados, los infractores eran cero. Es la cuarta vez
  que el mismo tipo de atajo produce un número inventado.
- **Un tope sin orden correcto miente en silencio.** Tres consultas
  ascendentes con `limit(100)` enseñaban lo más viejo como si fuera lo actual,
  y una prueba exigía la frase falsa ("tus 100 paseos más recientes"). No se ve
  con datos de prueba chicos: sólo aparece cuando alguien usa la app en serio.
- **Una cifra que siempre dice "—" no es una cifra.** Ocupaba el mejor lugar del
  Resumen, junto a una lectura de 100 perfiles que nadie mostraba.
- **Un clasificador incompleto acusa a código sano.** Los "25 controles
  pendientes" de la fase 8 eran cero: el detector sólo excusaba `role="button"`,
  y no reconocía los fondos de modal, los paneles que frenan la propagación ni
  los `role="radio"`. Es el mismo error que la ventana de 700 caracteres del
  historial legacy -- medir con un criterio más angosto que la realidad.
- **Un control que nadie encuentra es lo mismo que no tenerlo.** Los avisos
  tenían tarjeta para activarlos en tres pantallas, y a ninguna entra nadie por
  su cuenta: cero teléfonos registrados, cero avisos, y nada fallaba. Antes de
  buscar el error técnico, hay que preguntar si alguien llegó a encender la
  cosa.
- **"0 enviados" tapa dos problemas con arreglos opuestos.** No haber a quién
  avisarle y que el proveedor rechace el envío se veían igual. Un resultado que
  puede significar dos cosas debe decir cuál.
- **Un dato que se captura y no se vuelve a ver está muerto.** La familia
  escribía la fecha del próximo refuerzo de su perro y sólo la leía
  administración. Ahora se le devuelve a quien la escribió.
- **Una fase sin prueba no está cerrada, ni la propia.** La calificación al
  terminar el paseo salió sin una sola prueba de su ventana de tres días; se
  encontró al ir a cerrarla en este documento.
- **Un cambio de otra sesión puede romper mi verificación.** Con dos sesiones en
  el mismo repo, un `tsc` o un `jest` rojos pueden ser ajenos. Se verifica en un
  worktree limpio del commit, no en la carpeta compartida.
- **Una colección sin bloque de reglas no es un descuido menor.** `privacyRequests`
  caía al `catch-all: deny everything else` del final del archivo -- ni un error
  visible, ni un log, sólo un formulario que parecía funcionar y una solicitud
  ARCO que nunca se guardaba. La prueba de la fase 13 la encontró; nadie la
  había reportado como rota.
