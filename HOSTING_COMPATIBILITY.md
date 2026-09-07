# Compatibilidad de hosting — evaluación previa P0.7

Estado: documento de preparación. No se creó proyecto, no se instaló adaptador y no se desplegó.

Fuentes oficiales consultadas el 8 de agosto de 2026:

- [Vercel Hobby](https://vercel.com/docs/plans/hobby) y [Fair Use](https://vercel.com/docs/limits/fair-use-guidelines).
- [Cloudflare Workers: límites](https://developers.cloudflare.com/workers/platform/limits/), [Static Assets](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/) y [Next.js/OpenNext](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/).
- [Next.js: static export](https://nextjs.org/docs/app/guides/static-exports) y [opciones de despliegue](https://nextjs.org/docs/app/getting-started/deploying).

Los límites y términos pueden cambiar; deben verificarse otra vez antes de decidir o desplegar.

## Inventario técnico

| Componente | Clasificación | Vercel actual | Workers + OpenNext | Export estático |
|---|---|---|---|---|
| Páginas públicas y metadata | Estáticas | Compatible | Compatible | Compatible |
| Paneles cliente + Firebase | Shell estático con datos cliente | Compatible | Compatible en principio | Compatible sin gate de middleware |
| Middleware de navegación | Dinámico | Compatible | Cloudflare documenta soporte; requiere prueba del adaptador | No compatible |
| `/api/version` | Route Handler dinámico, sin datos personales | Function Node | Requiere prueba en Worker | No compatible |
| `/api/presence-offline` | Route Handler Node, token y Firebase Admin | Function Node | Riesgo: `firebase-admin`, Node compatibility, tamaño y CPU; prueba obligatoria | No compatible |
| Firebase cliente | Variables públicas de build | Compatible | Compatible en principio | Compatible |
| Firebase Admin | Secreto solo servidor | Compatible si está configurado | Requiere secrets/bindings y prueba de runtime | No compatible |
| `next/image` | Optimización dinámica | Integrada | Cloudflare indica soporte mediante Cloudflare Images; no se presupone incluido gratis | Requiere loader o `unoptimized` |
| Service worker | Asset estático | Compatible | Compatible | Compatible |
| Cabeceras y redirects de Next | Configuración de plataforma/runtime | Compatible | Deben verificarse con OpenNext | No soportados por `output: export`; trasladar al host |
| Fuentes `next/font/google` | Descarga en build, self-host en runtime | Compatible con red en build | Compatible si el build tiene red | Compatible si se generan en build |

## Comparación de alternativas

### Vercel actual

Hobby es gratuito pero su documentación limita el plan a proyectos personales y no comerciales. Por ello no es base aceptable para el lanzamiento comercial de PET Ap. Mantenerlo solo puede ser temporal mientras el proyecto no tenga uso comercial y se confirma el plan aplicable.

### Cloudflare Workers + Static Assets + OpenNext

Cloudflare documenta App Router, Route Handlers, SSR, SSG y middleware como compatibles mediante OpenNext, pero esa afirmación general no prueba este repositorio. En Workers Free, la documentación consultada indica 100,000 solicitudes de Worker por día, 10 ms de CPU por solicitud HTTP, 128 MB de memoria, bundle comprimido de 3 MB, 20,000 assets por versión y 25 MiB por asset. Los assets estáticos se sirven sin cargo por solicitud; SSR y Route Handlers consumen cuota de Worker.

Bloqueadores que deben medirse localmente antes de considerar viable Free:

- tamaño del bundle OpenNext frente a 3 MB comprimidos;
- CPU de SSR y `/api/presence-offline` frente a 10 ms;
- compatibilidad real de `firebase-admin` con `nodejs_compat`;
- comportamiento de middleware, cabeceras, redirects, Auth popup y `next/image`;
- disponibilidad y condiciones de la optimización de imágenes elegida;
- forma segura de inyectar secretos sin incorporarlos al bundle cliente.

### Export estático

No es viable sin cambios arquitectónicos: Next.js no admite middleware, headers, redirects ni optimización de imágenes predeterminada en `output: export`, y los dos Route Handlers dinámicos requieren runtime. Sería necesario retirar el gate de middleware, mover `/api/presence-offline` a un backend gratuito probado, reemplazar `/api/version`, configurar headers/redirects en el host y usar imágenes sin optimización dinámica o con loader compatible.

## Variables y secretos

Variables `NEXT_PUBLIC_*` se incorporan al bundle y solo deben contener configuración pública de Firebase, Google Client ID, GA ID opcional y URL pública canónica. Firebase Admin y cualquier secreto permanecen exclusivamente en runtime servidor. `NEXT_PUBLIC_SITE_URL` debe fijarse al dominio canónico de producción; previews no deben convertirse en canonical.

## Siguiente evaluación autorizable

1. Crear una rama o copia aislada.
2. Instalar OpenNext/Wrangler solo con autorización explícita.
3. Ejecutar build y preview locales, nunca deploy.
4. Medir bundle, CPU aproximada y rutas dinámicas.
5. Probar Auth popup/GIS, middleware, APIs, imágenes, headers, SW y caché.
6. Confirmar límites y términos oficiales nuevamente.
7. Solo después decidir hosting; no asumir que Workers Free soporta toda la aplicación.
