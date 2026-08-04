# Inventario de datos (DATA_INVENTORY)

Última actualización: 3 de agosto de 2026

Inventario de colecciones Firestore de PET Ap, con tipos de datos personales (PII), reglas de acceso, retención y fuente de verdad. Sirve como referencia para la política de privacidad (`/privacidad`) y para el aviso de retención.

## Colecciones

| Colección | Contenido | PII | Acceso (rules) | Retención | Fuente de verdad |
|-----------|-----------|-----|----------------|-----------|------------------|
| `users/{uid}` | Rol (`admin`/`walker`/`client`) | Correo, nombre | Solo owner | Vida de la cuenta | Auth → rol |
| `clients/{uid}` | Perfil de cliente | Nombre, teléfono, dirección | Owner CRUD | Vida de la cuenta (ARCO/borrado a petición) | Owner |
| `pets/{petId}` | Mascotas | Nombre del perro, edad, peso, raza | Owner + admin | Vida de la cuenta | Owner |
| `addresses/{addressId}` | Direcciones | Domicilio, coordenadas | Owner | Vida de la cuenta | Owner |
| `serviceOrders/{orderId}` + `sessions/{sessionId}` | Órdenes de servicio y sesiones | Datos del cliente, ubicación | Auth + admin | Vida de la cuenta | Sistema |
| `reservations/{resId}` | Reservas de paseos | Nombre, teléfono, dirección, ubicación | Auth creación, owner/admin lectura | 5 años (fiscal/contractual) | Sistema |
| `walkers/{walkerId}` | Paseadores | Nombre, teléfono | Auth lectura, admin escritura | Vida de la relación laboral | Admin |
| `walkerPresence/{walkerId}` | Presencia en línea | Timestamps | Auth | 30 días | Sistema |
| `walkerProfiles/{uid}` | Perfil extendido paseador | Zonas, horarios, capacidad | Walker propio, admin | Vida de la relación | Walker/admin |
| `zones/{zoneId}` | Zonas geográficas | Nombre de zona | **Lectura pública**, admin escritura | Permanente (catálogo) | Admin |
| `walk-logs/{logId}` | Bitácora de paseos | Ubicación GPS, fotos, tiempos | Walker/owner/admin | 12 meses (operativa) + 5 años fiscal | Sistema |
| `reviews/{docId}` | Reseñas públicas | Nombre del dueño | Pública lectura, auth creación | 5 años fiscal | Cliente |
| `gallery-images/{docId}` | Fotos de galería | Imágenes, permiso de publicación | Pública lectura, admin escritura | Hasta revocación del consentimiento | Admin + consentimiento |
| `coupons/{docId}` | Cupones | — | Pública lectura, admin escritura | Vigencia del cupón | Admin |
| `admin/prices` | Precios de servicios | — | Pública lectura, admin escritura | Permanente (catálogo) | Admin |
| `admin/config` | **Config legacy (deprecada)** | — | Pública lectura, admin escritura | **En migración → `appSettings/public`** | ⚠ Legacy |
| `appSettings/public` | **Config de sitio (nueva fuente de verdad)** | — | Pública lectura, admin escritura | Permanente | Admin (schemaVersion 2) |
| `admin/banner` | Banner promocional | — | Pública lectura, admin escritura | Vigencia | Admin |
| `admin/tokens` | Tokens FCM | Token de dispositivo | Admin lectura, auth escritura (propio) | 30 días de inactividad | Sistema |
| `conversations/{convId}` + `messages/{msgId}` | Chat | Mensajes, datos de contacto | Owner + admin | 12 meses | Sistema |
| `referrals/{refId}` | Referidos | Teléfonos, enlaces | Auth CRUD | 5 años fiscal | Sistema |
| `loyalty/{uid}` | Puntos de lealtad | — | Owner lectura, admin escritura | Vida de la cuenta | Sistema |
| `wallets/{uid}` + `transactions/{txId}` | Wallet | — | Owner, admin | 5 años fiscal | Sistema |
| `notifications/{uid}/items` | Notificaciones in-app | — | Owner lectura, admin escritura | 30 días | Sistema |
| `petAhoraRequests`, `petAhoraOffers`, `petAhoraLeases` | Pet Ahora (lease) | Datos de contacto, ubicación | Auth + admin | Vida de la cuenta / 5 años fiscal | Sistema |
| `audit-logs/{docId}` | Auditoría | Acciones de admin, IP | Auth creación, admin lectura | 5 años fiscal | Sistema |

## Resumen de PII por categoría (LFPDPPP)

| Categoría | Dónde vive | Base legal |
|-----------|------------|------------|
| Identificación (nombre, teléfono, correo) | `users`, `clients`, `reservations`, `conversations`, `walkers`, `referrals`, `audit-logs` | Relación contractual / consentimiento |
| Ubicación (dirección, GPS) | `addresses`, `reservations`, `walk-logs`, `petAhoraLeases` | Relación contractual |
| Imágenes (fotos de perros) | `gallery-images`, `walk-logs` | **Consentimiento opt-in previo** |
| Financiera (wallet, pagos) | `wallets` | Relación contractual (retención fiscal 5 años) |
| Datos de salud de mascotas | `pets`, `reservations` | Relación contractual / recomendado no obligatorio |

## Consentimientos

| Tratamiento | Consentimiento | Almacenamiento |
|-------------|----------------|----------------|
| Analítica Google (GA4 `G-HQTMCZX66M`) | Banner "Tu privacidad importa" (Aceptar/Rechazar) | `localStorage petap_consent_v1`; default `denied` |
| Fotos en galería pública | Opt-in previo del propietario | Registro en `gallery-images` (campo de autorización) |
| Push notifications | Autorización del navegador + token FCM | `admin/tokens` |

## Retención (resumen)

| Dato | Período |
|------|---------|
| Reservas, reseñas, wallet, referidos, auditoría | 5 años (fiscal) |
| Mensajes de chat | 12 meses |
| Walk-logs / fotos operativas | 12 meses operativa + 5 años fiscal |
| Tokens FCM, presencia, notificaciones | 30 días |
| Datos de cuenta activa | Vida de la cuenta (borrado a petición ARCO) |
| Config de sitio | Permanente (catálogo público) |

## Fuente de verdad de configuración

- **Nuevo:** `appSettings/public` (schemaVersion 2) — `brandName`, `heroTitle`, `heroSubtitle`, `contactEmail`, `whatsappE164`, `displayPhone`, `businessHours`, `instagramUrl`, `analyticsEnabled`, `features`.
- **Legacy (deprecado):** `admin/config` — se lee solo como fallback durante la migración. Debe vaciarse/eliminarse una vez migrado.
- `src/lib/defaultConfig.ts` es el fallback en código (última red).
