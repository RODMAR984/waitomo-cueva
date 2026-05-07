# Checklist — piloto, operación (alta de gims) y humo pre-release

**Orden sugerido para arrancar:** [`PILOTO_EMPEZAR_AQUI.md`](./PILOTO_EMPEZAR_AQUI.md) (preflight → Supabase → EAS → humo en dispositivo).

Documento único para **Fase 2 (operación)**, **Fase 3 (calidad)** y **criterio de semana piloto** del memo [`ROADMAP_MEMO_PRODUCTO_Y_LANZAMIENTO.md`](./ROADMAP_MEMO_PRODUCTO_Y_LANZAMIENTO.md). Detalle técnico de flujos y tiendas: [`REVISION_FLUJOS_Y_PUBLICACION.md`](./REVISION_FLUJOS_Y_PUBLICACION.md).

---

## 1. Mínimo para arrancar semana piloto (1–2 clientes)

Marcá cuando esté listo **antes** de Play/App Store públicos.

| # | Requisito | Notas |
|---|-----------|--------|
| P1 | **Build instalable** en el dispositivo del cliente | TestFlight (iOS), Internal testing o APK (Android), o build de desarrollo si son de confianza. |
| P2 | **Supabase** del proyecto **real** (URL + anon key en la app que van a usar) | No mocks; mismo proyecto donde aplicaste migraciones. |
| P3 | **Migraciones** aplicadas en remoto | Ver §4 abajo; como mínimo las de trial + comunidad citadas en `REVISION…` §0.1. |
| P4 | **Canal de soporte** acordado | WhatsApp, mail `soporte@fitengine.app` u otro; horario de respuesta esperable. |
| P5 | **Acuerdo con el gym** | Qué van a usar (trial, chat, calendario, planes); usuario staff de prueba si hace falta. |
| P6 | **Cuentas de prueba** | Al menos 1 cliente + 1 staff/coach con org y plan coherentes. |

---

## 2. Alta de un gym (checklist interno — operación)

Uso interno del equipo; adaptar nombres a vuestro proceso real (Supabase Dashboard, scripts, etc.).

| Paso | Qué verificar |
|------|----------------|
| O1 | **Organización** creada y vinculada a la app (IDs, branding si aplica). |
| O2 | **Usuarios staff** (owner/admin/coach) con roles correctos y acceso a Admin / AdminLite. |
| O3 | **Planes** y precios / abonos alineados con lo que muestra la app. |
| O4 | **Canales de chat** y **novedades** visibles según reglas de negocio (plan, trial). |
| O5 | **Horarios / calendario** y slots de clase de prueba coherente con `FREE_CLASS_*` / política del gym. |
| O6 | **Invitaciones** (código / link `fitengine.app/join`) probadas una vez antes del piloto. |
| O7 | **Migraciones** del repo aplicadas en el proyecto Supabase que usa ese gym (no mezclar proyectos). |
| O8 | **Zona horaria:** hoy el RPC usa `America/Argentina/Buenos_Aires`; si el gym es otra zona, documentar limitación o tarea futura (`REVISION…` §0.3). |
| O9 | **Contacto legal visible:** privacidad/términos en app; mail operativo acordado. |

---

## 3. Lista de humo (15 flujos) — antes de cada release relevante

Ejecutar en **dispositivo real** (no solo simulador si podés evitarlo). Anotar fallos con pantalla / pasos.

| # | Flujo | Criterio de éxito breve |
|---|--------|-------------------------|
| H1 | **Login / logout** cliente | Sesión estable; vuelve a Welcome o Home según rol. |
| H2 | **Welcome → elegir plan → registro** (un camino completo hasta Home) | Sin pantallas rotas; llega a ClientTabs. |
| H3 | **Trial: reservar** clase gratis | Confirmación; reflejo en Home / estado coherente. |
| H4 | **Trial: reagendar** fecha u hora | Una sola reserva vigente `scheduled` razonable. |
| H5 | **Trial: cancelar dentro del margen** | RPC OK; UI y almacenamiento local coherentes. |
| H6 | **Trial: cancelar fuera del margen** | Debe **bloquearse** con mensaje claro. |
| H7 | **Día después de la clase trial** | Sin acceso a rutina por trial; grant pasado según política (no-show / finalize). |
| H8 | **Chat: canales** | Cliente ve canales de su plan; staff según diseño. |
| H9 | **Novedades** | Lista carga; staff puede publicar si está en alcance del piloto. |
| H10 | **Calendario → Trabajo del día** | Params `fecha` / `horario` correctos. |
| H11 | **Reserva de clase → Trabajo del día** | Misma coherencia de horario. |
| H12 | **Config** | Tema claro/oscuro/auto; idioma ES/EN; notificaciones sin crash. |
| H13 | **Acerca de** | Privacidad y términos abren; `mailto` a soporte si está configurado. |
| H14 | **Staff** | Login coach/admin; al menos ver Admin o AdminLite + chat o novedades sin error crítico. |
| H15 | **Invitación cliente** (si el piloto la usa) | Link o código join lleva al flujo esperado. |

Ampliación puntual según `REVISION…` §0.4 (tabla trial + chat).

---

## 4. Migraciones y backend (recordatorio)

- Aplicar en el proyecto correcto: `supabase db push` o flujo equivalente.
- Referencia de migraciones recientes: ver **`REVISION_FLUJOS_Y_PUBLICACION.md` §0.1** (trial `20250410400000` … `20250410421000`, etc.).
- Tras push: volver a correr **H3–H7** y **H8** como mínimo.

---

## 5. Qué queda fuera de este doc (pero enlazado)

| Tema | Dónde |
|------|--------|
| Publicación en tiendas, EAS, Apple Sign In | `REVISION_FLUJOS_Y_PUBLICACION.md` §2–§3 |
| Textos legales en app | `content/legal/` + pantallas Privacidad/Términos |
| Observabilidad (Sentry, métricas) | Memo fase 4 — no implementado en código aún |

---

## 6. Cierre rápido post–lista de humo

- [ ] Fallos documentados (issue o tabla interna).
- [ ] Decisión: **¿se puede fijar fecha de semana piloto?** (si §1 está en verde).
- [ ] Decisión: **¿siguiente paso es otro piloto o empujar hacia TestFlight/internal track?**

*Última actualización: alineado con memo de roadmap y §0 de revisión de flujos.*
