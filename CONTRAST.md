# Resultados de contraste (WCAG 2.1 AA)

Última actualización: 3 de agosto de 2026

Ratios calculados sobre los tokens de diseño en `src/app/globals.css`. Criterio: texto normal ≥ 4.5:1, texto grande/UI ≥ 3:1.

## Tema claro

| Par | Ratio | AA 4.5 | Verificación |
|-----|-------|--------|--------------|
| `--text-primary` #101828 / `--bg-canvas` #F7F8F4 | 16.64:1 | ✅ | — |
| `--text-primary` #101828 / `--bg-surface` #FFFFFF | 17.75:1 | ✅ | — |
| `--text-muted` #667085 / `--bg-canvas` #F7F8F4 | 4.66:1 | ✅ | — |
| `--text-muted` #667085 / `--bg-surface` #FFFFFF | 4.97:1 | ✅ | — |
| `--text-secondary` 70% / blanco | 6.59:1 | ✅ | — |
| Blanco / `--color-primary` #C45100 (`.btn-primary`) | 4.64:1 | ✅ | — |
| Blanco / `--color-trust` #0F766E | 5.47:1 | ✅ | — |
| Blanco / `--color-success` #15803D | 5.02:1 | ✅ | — |
| Blanco / `--color-error` #B91C1C | 6.47:1 | ✅ | — |
| Blanco / `--color-warning` #B45309 | 5.02:1 | ✅ | — |
| #9F3D00 (primary-hover) / blanco | 6.68:1 | ✅ | — |

## Tema oscuro

| Par | Ratio | AA 4.5 | Nota |
|-----|-------|--------|------|
| `--text-primary` #F1F3F7 / `--color-dark-canvas` #0B1220 | 16.85:1 | ✅ | — |
| `--text-secondary` 70% / #0B1220 | 8.59:1 | ✅ | — |
| `--text-muted` 50% / #0B1220 | 4.91:1 | ✅ | Corregido 0.4→0.5 (antes 3.55:1) |
| `--text-muted` 50% / #141E2F | 4.75:1 | ✅ | Corregido |
| #C45100 (primary) / #0B1220 | 4.03:1 | ✅ (3:1 UI/texto grande) | No usar primary sobre canvas para texto normal |

## Gradientes y estados especiales

| Patrón | Estado |
|--------|--------|
| `.gradient-text` | Fallback sólido `var(--color-primary)` → `@supports` para gradiente → `forced-colors` para alto contraste. Sin gradiente en precios (usados `text-primary`). |
| Precios (`ReservationForm`, `StepConfirm`) | `text-primary` — legibles en ambos temas. |
| Fotos/logo | No aplican (imágenes informativas; se conserva contraste de entorno). |

## Notas

1. **Dark muted corregido:** `rgba(241,243,247,0.4)` (3.55:1, falla AA) → `rgba(241,243,247,0.5)` (4.91:1, pasa AA). Commit `99055d3`.
2. **Primary sobre canvas oscuro (4.03:1):** cumple 3:1 para texto grande e interfaces; si se usa para texto normal en tema oscuro debe combinarse con el color trust/amber más claro. Pendiente de revisión visual con screenshots.
3. Recomendación: regenerar screenshots de ambos temas tras el cambio de `--text-muted` para confirmar la jerarquía visual (pendiente de auditor visual).
