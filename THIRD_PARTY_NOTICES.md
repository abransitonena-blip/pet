# Avisos de terceros (THIRD_PARTY_NOTICES)

Última actualización: 30 de julio de 2026

PET Ap (pet-reservations) usa el siguiente software y servicios de terceros. Los avisos de licencia de las dependencias directas se reproducen a continuación de forma resumida; el texto completo de cada licencia está disponible en el repositorio de cada proyecto.

## Dependencias npm directas

| Paquete | Versión | Licencia | Propósito | Aviso |
|---------|---------|----------|-----------|-------|
| `next` | ^14.2.0 | MIT | Framework | Copyright (c) 2024 Vercel, Inc. Licencia MIT incluida en `node_modules/next/LICENSE` |
| `react` / `react-dom` | ^18.3.0 | MIT | UI | Copyright (c) Meta Platforms, Inc. MIT |
| `firebase` | ^10.12.0 | Apache-2.0 | Backend (Auth, Firestore, Messaging) | Copyright (c) Google LLC / The Firebase Authors. Apache-2.0 |
| `lucide-react` | ^1.28.0 | ISC | Íconos (única librería permitida y usada) | Copyright (c) Lucide Contributors. ISC — uso libre con atribución de autor |
| `framer-motion` | ^11.1.0 | MIT | Animaciones | Copyright (c) Framer. MIT |

Licencia ISC (lucide-react) — texto resumido:

> Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies. THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES.

## Servicios en la nube

| Servicio | Proveedor | Datos procesados | Uso declarado en `/privacidad` |
|----------|-----------|------------------|--------------------------------|
| Firebase Authentication | Google | Correo, nombre, foto de perfil | Sí |
| Firestore | Google | Reservas, config, galería | Sí |
| Firebase Cloud Messaging | Google | Push notifications | Sí |
| Google Analytics 4 (`G-HQTMCZX66M`) | Google | Analytics; **solo tras consentimiento** | Sí (gated por consentimiento) |
| Vercel | Vercel Inc. | Hosting, edge functions | Sí |
| Cloudinary | Cloudinary Ltd. | Almacenamiento de imágenes de galería | Sí |
| WhatsApp / Meta | Meta Platforms | Chat de contacto | Sí |

## Fuentes

| Fuente | Licencia | Uso |
|--------|----------|-----|
| Inter | SIL OFL 1.1 | Tipografía UI (Google Fonts) |
| JetBrains Mono | SIL OFL 1.1 | Código / datos técnicos (Google Fonts) |

OFL permite uso libre, comercial y sin restricciones de atribución adicionales a las del propio texto de licencia.

## Aviso de imagen corporativa

Los logos e íconos propietarios de PET Ap (ver `ASSET_LICENSES.md` y `public/assets-manifest.json`) son propiedad de PET Ap y no están cubiertos por ninguna de las licencias anteriores.
