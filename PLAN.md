# Plan de rediseño de PET Ap

Estado al 2026-09-17. Cada fase se cierra por completo antes de abrir la
siguiente, y cada una deja su prueba: si no hay prueba, la fase no está cerrada.

Las reglas que rigen todo esto viven en [AGENTS.md](AGENTS.md).

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
| 12 | Las tres decisiones de arquitectura | PET Ahora ya despachaba desde `dispatchServer.ts` server-side (transacciones, sin duplicar oferta); faltaba cerrar la regla de `petAhoraOffers`/`petAhoraLeases`, ahora `if false`. Bitácora administrativa: `/api/admin/audit-log` nuevo, verifica admin por token y escribe con el T3 privilegiado -- el actor ya no lo declara el navegador; los tres call sites (`resenas`, `EditReservationModal`, `LegacyReservationsView`) migrados, `lib/audit.ts` duplicado eliminado, regla de `audit-logs` cerrada. Historial legacy: `reservations` ahora sólo lee, cerrado `create/update/delete` en la regla (todo el código ya estaba detrás de `LEGACY_RESERVATION_WRITES_ENABLED`, permanentemente apagada) | emulador (11 fallas quedan, todas de la fase 13) |

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

### 11. Peso de verdad: bajar de 250 kB
Lo que queda pesado es el SDK de Firestore, que los paneles sí usan para escuchar
cambios en vivo. Pide separarlo por ruta y cargar las pantallas que no escuchan
nada sin él.

Cierra cuando: ninguna ruta pase de 250 kB de primera carga.

### 13. Las 11 pruebas de reglas desactualizadas
Once casos de `p04-firestore-rules` esperan permisos que las reglas ya no dan.
Cada uno hay que entenderlo antes de tocarlo: puede ser prueba vieja o regla
demasiado apretada.

Cierra cuando: la suite del emulador pase entera.

### 14. Densidad del resto de los paneles
La fase 9 cubrió los cuatro con los que se opera a diario. Quedan los demás, en
este orden por tamaño y uso: Mis perros (789 líneas), Mis direcciones (613),
Zonas (584), Familias (496), Perros de admin (409), Rutas (384), perfil del
paseador (362). Mismo criterio y mismo método: primero lo que se necesita para
actuar, y cada panel con su prueba.

### 15. Animaciones
Desbloqueada por la fase 3: ahora se puede animar sin dañar a quien pidió no
recibir movimiento. Va al final a propósito -- animar una interfaz que todavía se
está reordenando es trabajo que se tira.

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
