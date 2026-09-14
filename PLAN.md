# Plan de rediseño de PET Ap

Estado al 2026-09-14. Cada fase se cierra por completo antes de abrir la
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

---

## Abiertas, en orden

### 9. Densidad panel por panel
Con la letra más grande ya no cabe lo mismo. Panel por panel: decidir qué es lo
importante y esconder el resto detrás de un toque, como ya se hizo en el perfil
del perro y en Configuración.

Orden por uso: `/walker` (se usa en la calle, en un teléfono) → `/familia` →
`/admin/reservas` (662 líneas, el más denso) → el resto.

Cierra cuando: cada panel abre mostrando lo que se necesita para actuar, y lo
demás está a un toque.

### 10. Peso de verdad: bajar de 200 kB
Lo que queda pesado es el SDK de Firestore, que los paneles sí usan para escuchar
cambios en vivo. Pide separarlo por ruta y cargar las pantallas que no escuchan
nada sin él.

Cierra cuando: ninguna ruta pase de 250 kB de primera carga.

### 11. Las tres decisiones de arquitectura
No son descuidos; son decisiones del dueño, y cada una es trabajo real:
- **PET Ahora** se despacha desde el navegador → mover a ruta de servidor.
- **Bitácora administrativa** se escribe desde el navegador → un registro que un
  admin puede fabricar desde su consola vale poco.
- **Historial legacy** acepta escrituras en las reglas, aunque el código las tenga
  apagadas con bandera → cerrar la regla también.

Cierra cuando: la suite del emulador no reporte ningún permiso concedido de más.

### 12. Las 11 pruebas de reglas desactualizadas
Once casos de `p04-firestore-rules` esperan permisos que las reglas ya no dan.
Cada uno hay que entenderlo antes de tocarlo: puede ser prueba vieja o regla
demasiado apretada.

Cierra cuando: la suite del emulador pase entera.

### 13. Animaciones
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
- **Un clasificador incompleto acusa a código sano.** Los "25 controles
  pendientes" de la fase 8 eran cero: el detector sólo excusaba `role="button"`,
  y no reconocía los fondos de modal, los paneles que frenan la propagación ni
  los `role="radio"`. Es el mismo error que la ventana de 700 caracteres del
  historial legacy -- medir con un criterio más angosto que la realidad.
