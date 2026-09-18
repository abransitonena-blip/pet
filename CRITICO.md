# Lo crítico de PET Ap

Lo que puede romper la operación o hacerle perder dinero al negocio, y lo que
nadie más que el dueño puede destrabar. El plan completo de mejoras vive en
[PLAN.md](PLAN.md); las reglas de trabajo, en [AGENTS.md](AGENTS.md).

Estado al 2026-09-18.

---

## 1. Por comprobar en producción

### 1.1 Los tres paneles que no cargaban — corregido, falta verlo con tu sesión
**Síntoma:** Perros, Familias e Insights mostraban *"Tu sesión no tiene permiso
para consultar estas solicitudes"* y cero resultados.

**Causa:** el directorio pedía 600 perros de un tiro y las reglas topan las
listas de `dogs` en 100 desde la fase 6. Firestore no recorta la lista: rechaza
la consulta entera.

**Corregido en** `src/lib/useCanonicalDirectory.ts`: se leen de cien en cien.
Probado contra las reglas reales en el emulador
(`__tests__/directorio-admin-rules.emulator.test.ts`).

**Falta:** abrir los tres paneles con una sesión de admin de verdad y confirmar
que ya listan. No lo puedo hacer yo: piden iniciar sesión.

### 1.2 Los avisos al teléfono — corregido, falta que llegue uno de verdad
**Por qué no llegaba ninguno:** la llave del navegador está guardada en Vercel
como `NEXT_PUBLIC_FIREBASE_VAPID` y el código pedía
`NEXT_PUBLIC_FIREBASE_VAPID_KEY`. Con ese nombre de más, la app se comportaba
como si no hubiera llave: sin error y sin la tarjeta para activarlos, así que
nadie registró su teléfono y no había a quién enviarle nada.

**Corregido:** el código acepta los dos nombres.

**Falta, y sólo lo puedes hacer tú:** entrar a Configuración → El sistema →
Avisos al teléfono, activar los avisos en tu teléfono y darle a "Enviarme un
aviso de prueba". Esa tarjeta dice cuál de las tres piezas falta, si falta
alguna. Si el aviso no llega ahí, el problema está en el permiso
`roles/firebasecloudmessaging.admin` de la identidad privilegiada, que se revisa
en la consola de Google Cloud.

### 1.3 El 401 de `/api/media/private/walker-photo`
**Síntoma:** en la consola del navegador aparece
`Failed to load resource: the server responded with a status of 401` para esa
ruta.

**Lo que sé:** la ruta la llaman tres pantallas — el reporte de un paseo en
Familia PET, la tarjeta del paseador en el inicio de familia, y el perfil del
paseador para su propia foto. Un 401 significa que el servidor rechazó el token,
no que falte permiso sobre el paseo (eso daría 403).

**Lo que falta:** saber desde qué pantalla salió. Dos sospechas, en orden:
1. La verificación de token ahora exige que el paseador tenga perfil `active`
   (`src/lib/serverAuth.ts`). Un paseador con perfil inactivo o suspendido
   recibiría 401 al pedir su propia foto.
2. Un token de una sesión vieja, de antes de que se asignaran los claims.

**Cómo confirmarlo:** abrir la pantalla del reporte de un paseo como familia, y
el perfil como paseador, con la consola abierta; o mirar los registros de la
función en Vercel filtrando por `walker-photo`.

---

## 2. Sólo lo puede hacer el dueño

| Qué | Por qué importa | Sin eso |
|---|---|---|
| Cuenta de Apple Developer + Services ID y llave | Apple quedó fuera del acceso el 18 de septiembre de 2026, a petición del dueño: `APPLE_AUTH_PAUSED` en `src/lib/appleAuth.ts` lo apaga por encima de la variable de Vercel, que sigue encendida | Nadie entra con Apple. Para volver a ofrecerlo: terminar el trámite y poner ese candado en `false` |
| Precio de Paseo + Adiestramiento | El servicio está ofrecido y sin tarifa | Una familia puede pedirlo y el paseo no tiene precio verificable: no entra en Finanzas |
| Confirmar que aparece la tarjeta de notificaciones push | Las notificaciones al teléfono dependen de la llave VAPID | Las familias no reciben avisos de su paseo |

---

## 3. Reglas de operación que hay que respetar

### 3.1 El orden al publicar
Primero el código, y sólo cuando esté vivo, las reglas:

```bash
git push origin HEAD:main
npx vercel ls            # el despliegue nuevo queda "Staged"
npx vercel promote <url-del-despliegue> --yes
# esperar a que /api/version responda el commit nuevo
firebase deploy --only firestore:rules --project pet-1cb0b
```

**Un empujón a `main` ya no basta.** El proyecto quedó con despliegues de
producción "en escalera": Vercel construye, pero la versión no sale hasta
promoverla. Si `/api/version` sigue respondiendo el commit viejo diez minutos
después, es esto.

Al revés, las reglas nuevas rompen la versión que está corriendo. Ejemplo real:
la fase 12 cerró las escrituras del navegador a la bitácora administrativa; si
esas reglas salen antes que el código que usa la ruta de servidor, cada cambio
del panel deja de registrarse.

### 3.2 Los topes de las reglas mandan sobre las consultas
Las reglas exigen `limit` en las listas grandes: `dogs`, `addresses`,
`walkSessions`, `walkReports`, `serviceOrders`, `walkerReviews`,
`coverageRequests` (100), `tickets` y `printEvents` (50). Pedir más **no**
devuelve una lista corta: Firestore rechaza la consulta entera y la pantalla se
queda vacía con un mensaje de permisos.

Lo vigila `__tests__/topes-de-lista.test.ts`, que compara cada consulta del
cliente con el tope de su regla.

### 3.3 Nada de RFC ni facturación
Sigue en pie: no se integra ningún servicio que pida RFC, y las funciones que
cobran se mantienen apagadas. Los tickets internos no son CFDI.

---

## 4. Límites conocidos, que no son errores

- **Un mes con más de 100 paseos no cabe entero** en el historial de una familia
  o de un paseador. La pantalla lo dice en lugar de callarlo. Si el negocio
  crece hasta ahí, hay que paginar dentro del mes.
- **La tarjeta "Mi trabajo" del paseador** cuenta 31 días. Si en ese mes hizo
  más de cien paseos, no da números en vez de dar unos equivocados.
- **El código de un panel llega después de la primera pintura.** Se ve un
  esqueleto un instante y luego entra el panel. El total descargado es casi el
  mismo que antes; lo que cambió es que ya no bloquea la pantalla.
- **Apple sign-in, PET Ahora y las notificaciones** están tras banderas; lo que
  está apagado no se ofrece en pantalla. Apple, además, está apagado desde el
  código mientras no exista la cuenta de desarrollador.

---

## 5. Lo que ninguna prueba cubre todavía

- **Los paneles con sesión real.** Las pruebas miran el código y las reglas; el
  fallo del directorio vivió meses porque ninguna listaba como admin contra las
  reglas de verdad. Ya hay una prueba de emulador para ese caso; faltan las de
  los demás paneles.
- **El recorrido completo de una familia**: registrarse, dar de alta un perro,
  pedir un paseo y verlo asignado. Hoy se prueba por partes.
- **Las rutas de servidor con identidad privilegiada** sólo corren en
  Producción; en vista previa y en local fallan por diseño.
