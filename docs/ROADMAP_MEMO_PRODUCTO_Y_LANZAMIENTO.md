# Memo — Ruta producto, piloto y lanzamiento (Waitomo / FitEngine)

**Propósito:** una sola hoja de ruta que encaja la charla por **fases** (producto → operación → calidad → opcionales → web → **lanzamiento al final**) con el trabajo técnico ya hecho en el repo y con **`docs/REVISION_FLUJOS_Y_PUBLICACION.md`** (flujos + checklist tiendas §2–§3).

**Regla de oro:** cerrar producto, operación y calidad **antes** del lanzamiento público en tiendas. La **semana con 1–2 clientes piloto** es **antes** del lanzamiento masivo: basta build instalable (TestFlight / internal testing / APK de confianza) + backend real + soporte; **no** exige Play/App Store públicos.

---

## A) Dónde encaja lo ya avanzado en el repo (rama técnica “cliente”)

Esto **no** reemplaza las fases de abajo; es trabajo que ya quedó implementado y debe **QA + migraciones en Supabase** según `REVISION_FLUJOS_Y_PUBLICACION.md` §0:

- Trial clase gratis (día/hora, RPC, cancelación, no-show, entitlement rutinas).
- Chat / novedades (app + RLS, trial por plan en canales).
- Caché bloques cliente si el servidor devuelve vacío.

**Seguimiento:** checklist manual y pendientes operativos → ver `REVISION_FLUJOS_Y_PUBLICACION.md` §0.3–0.4.

---

## B) Ruta por fases (la de la charla) — orden de ejecución

### Fase 1 — Producto “cerrado” (sin tiendas)

| # | Tema | Qué implica | Estado repo (orientativo) |
|---|------|-------------|---------------------------|
| 1 | Privacidad / términos | Enlaces legales coherentes (web + app). | Pantallas `PrivacyScreen` / `TermsScreen` registradas en `App.js`; URLs base en `app.json` → `expo.extra` (`fitenginePrivacyUrl`, `fitengineTermsUrl`, etc.). **Revisar** que las URLs finales apunten a páginas reales y completar `fitengineSupportEmail` si aplica. |
| 2 | Acerca de + versión | Marca FitEngine/Waitomo + versión (`expo.version` / `app.json`). | `AboutFitEngineScreen` + rutas en `App.js`. **Revisar** copy y que la versión mostrada sea la deseada. |
| 3 | Onboarding | Solo si confunde; tooltips o saltar. | **Pendiente criterio producto** (no bloquea piloto si el flujo actual alcanza). |

### Fase 2 — Operación

| # | Tema | Qué implica | Estado |
|---|------|-------------|--------|
| 4 | Contacto / soporte | `mailto:` o enlace desde Config. | `app.json` tiene `fitengineSupportEmail` vacío → **completar** y enganchar en Config si falta UI. |
| 5 | Alta de gims | Checklist interno / documentación. | **Mayormente no-código**; puede vivir en otro doc o Notion. |

### Fase 3 — Calidad y estabilidad

| # | Tema | Qué implica | Estado |
|---|------|-------------|--------|
| 6 | Lista de humo | 10–15 flujos fijos pre-release. | **Definir lista** (puede copiarse/ ampliarse desde §0.4 + §2 del otro doc). |
| 7 | Otro dispositivo / red | Prueba manual. | **Pendiente ejecución** cuando haya build. |

### Fase 4 — Observabilidad (opcional)

| # | Tema | Qué implica | Estado |
|---|------|-------------|--------|
| 8 | Errores remotos | Sentry o similar. | **No implementado** (cuenta + SDK). |
| 9 | Métricas | Ligero al inicio. | **No implementado**. |

### Fase 5 — Web app (`app.fitengine.app`)

| # | Tema | Qué implica | Estado |
|---|------|-------------|--------|
| 10 | Proyecto aparte | Alcance Expo web / Next. | **Fuera de este repo** hasta definir alcance; `app.json` ya referencia URL como orientación. |

### Fase 6 — Lanzamiento (siempre al final, como pediste)

| # | Tema | Qué implica | Detalle |
|---|------|-------------|---------|
| 11 | Google Play + App Store | Fichas, builds producción, revisión Apple. | Ver **`REVISION_FLUJOS_Y_PUBLICACION.md` §2 y §3**. |
| 12 | Apple Developer + Team ID + AASA | Cuenta pagada, asociaciones, `apple-app-site-association`. | Encaja aquí; carpetas `deploy/` en repo como apoyo. |

---

## C) Semana piloto (1–2 clientes) — cuándo es

**No** va después del lanzamiento en tiendas ni después de “toda la lista larga”.

**Cuándo:** en cuanto se cumpla el **mínimo**:

1. La app hace lo acordado para ese piloto (flujos que van a usar).
2. Instalación en sus teléfonos: **TestFlight** (iOS) y/o **Internal testing / APK** (Android), o build de desarrollo si son de confianza.
3. **Supabase** (u backend) en el proyecto **real** que usarán.
4. Canal de **soporte** acordado (WhatsApp, mail, etc.) esa semana.

**Entonces** se puede fijar fecha en el calendario (“semana piloto”); puede ser **antes** de Fase 6 completa.

---

## D) Cómo seguimos en la práctica (para el agente / el equipo)

1. **Seguir numerando por fases** (B): priorizar Fase 1 pendientes de verificación (URLs reales, soporte, copy) → Fase 2 → Fase 3.
2. **En paralelo** cerrar QA del bloque técnico (memo **A** + `REVISION…` §0).
3. **Cuando el mínimo (C) esté listo** → calendarizar piloto sin esperar Fase 6.
4. **Fase 6** solo cuando checklist **`REVISION…` §2** esté razonablemente verde.

**Siguiente paso sugerido:** Fase 1 — revisar/enlazar URLs legales finales + `fitengineSupportEmail` + entrada visible en Config (si falta). Luego Fase 2 punto 4.

---

*Última actualización del memo: alineado con el estado del repo y la charla por fases + lanzamiento al final.*
