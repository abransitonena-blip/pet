# Ubicación durante el paseo: qué se guarda y por cuánto tiempo

REQUIERE VALIDACIÓN DE ABOGADO EN MÉXICO. El plazo de 30 días y el aviso a las
familias son una decisión legal; este documento describe lo que hace el código.

## Qué se guarda

Mientras un paseo está `in_progress`, el teléfono del paseador manda su
ubicación cada ~2 minutos a `/api/tracking/point`. El servidor decide si está
dentro o fuera de la zona (el teléfono no opina) y escribe:

| Dato | Dónde | Quién lo lee |
|---|---|---|
| Punto: lat, lng, precisión, si está fuera, distancia, paseador, hora | `walkTracks/{sessionId}/points/{pointId}` | Admin y supervisor (Rutas) |
| Alerta de salida de zona, con el último punto | `geofenceAlerts/{sessionId}` | Admin y supervisor |

Ningún navegador puede escribir en esas colecciones: solo la ruta del servidor,
con la identidad federada de Vercel. Las reglas permiten leerlas al personal y
marcar una alerta como vista; nada más.

Fuera del paseo no se registra nada.

**Corrección (fase 36):** lo de arriba ya no es exacto. Desde la fase 17 la
familia SÍ ve estos puntos mientras el paseo ocurre -- el mapa en vivo de su
inicio, `WalkRouteMap` --, aunque nunca la marca de "fuera del área" salvo que
administración decida avisarle (fase 35). Y desde la fase 36 puede, además,
compartir ese mismo recorrido por un enlace temporal con alguien sin cuenta
(`walkShareLinks`, apagado por `LOCATION_SHARE_LINKS_ENABLED` -- ver PLAN.md
fase 36): ese enlace tampoco lleva la marca de "fuera del área", ni nombres ni
teléfonos, y caduca o se revoca. Sigue habiendo un lugar donde nada de esto se
ve: fuera del paseo no se registra nada, y el enlace compartido deja de servir
puntos en cuanto caduca o se revoca.

## Cuánto tiempo se conserva

**30 días.** Cada punto y cada alerta se escriben con un campo `expiresAt` que
es su fecha de caducidad (ver `src/lib/trackingRetention.ts`).

El borrado lo hace Firestore con una **política TTL**, no un proceso nuestro.
Hay que encenderla una sola vez por colección:

1. Consola de Firebase → Firestore Database → pestaña **TTL**.
2. Crear política: **grupo de colecciones** `points`, campo `expiresAt`.
3. Crear política: colección `geofenceAlerts`, campo `expiresAt`.

Mientras esas políticas no existan, los documentos **no se borran solos**: el
campo queda escrito y el borrado empieza en cuanto se encienda la política.
Firestore elimina los documentos vencidos dentro de las 24 horas siguientes a
su caducidad, así que el plazo real es "30 días, más el margen de Firestore".

Los datos escritos antes de este cambio no tienen `expiresAt` y la política no
los tocará: si hay que eliminarlos, es una limpieza manual.
