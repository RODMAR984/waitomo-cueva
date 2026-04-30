# FitEngine — IA para administración del gym

Documento vivo: prioridades, fases y riesgos. **App móvil y web** comparten la misma lógica (Supabase Edge + pantallas staff); solo cambia el layout (rail web vs. flujo móvil).

**Catálogo de ideas / ejemplos** (brainstorm, checklist con Claude, etc.): [`ADMIN_AI_IDEAS_CATALOGO.md`](./ADMIN_AI_IDEAS_CATALOGO.md).

## Principios

1. **Revisión humana** antes de enviar mensajes masivos o publicar datos sensibles.
2. **Datos reales** solo vía backend con **RLS** y `organization_id`; no SQL libre generado por el modelo en la primera iteración.
3. **Cuota y costos** ya existentes (`check_ai_quota`, `ai_generation_logs`, función `generate-routine`).

## Estado actual (código)

- **Bloques / rutina** (`AdminScreen`): borrador de rutina, reescritura de bloque, mensaje corto, formato RM — `utils/aiAssistant.js` → Edge `generate-routine`.
- **Fase 2a**: **Resumen IA** en ficha miembro — `OrgMemberDetailScreen` + `draftMemberSummaryWithAi` (modo `message` con hechos armados en cliente: perfil, `class_bookings`, `user_abonos` por org). Copiar al portapapeles para WhatsApp.

## Fases propuestas

### Fase 1 — Redacción asistida (alto impacto, bajo riesgo)

| Entrega | Descripción | Pantalla / notas |
|--------|-------------|------------------|
| 1a | ~~Novedades: borrador IA~~ descartado | — |
| 1b | Plantillas: “recordatorio de pago”, “cambio de horario”, win-back (misma API, prompts vía `extra_notes` o modo dedicado) | **Hecho en chat staff**: chips de plantilla + sugerencia IA contextual. |
| 1c | Chat staff–cliente: sugerencia de respuesta (copiar/pegar) | **Hecho** en `ChatScreen` / admin |

### Fase 2 — Contexto por miembro

| Entrega | Descripción | Datos |
|--------|-------------|--------|
| 2a | **Resumen IA** en ficha miembro (hecho) | `OrgMemberDetailScreen`; datos vía Supabase (RLS staff) + IA modo `message` |
| 2b | Copiar resumen (p. ej. WhatsApp) | Botón en `OrgMemberDetailScreen` |

### Fase 3 — Asistente “con datos” (intents seguros)

| Entrega | Descripción |
|--------|-------------|
| 3a | Intents fijos: “altas este mes”, “abonos por vencer”, “ocupación por franja” → **consultas SQL/RPC preaprobadas** por org | **Iniciado**: bloque “Asistente con datos” en `AdminResumenScreen` (altas mes, vencimientos 7d, ocupación por franja del día). |
| 3b | UI: pestaña o drawer “Asistente” + historial corto | **Iniciado**: historial corto en `AdminResumen` (plantillas copiadas, WhatsApp web, corrida de alertas IA). |

### Fase 4 — Proactividad

| Entrega | Descripción |
|--------|-------------|
| 4a | Jobs nocturnos: anomalías, sugerencias de promo para horarios vacíos | **Iniciado**: `admin-ai-insights` (caída de asistencia, baja ocupación, vencimientos, proyección + riesgo operativo). Falta activar cron nocturno en cada ambiente. |
| 4b | Cards en **Resumen** admin (“La IA detectó…”) | **Iniciado**: sección “Alertas IA” en `AdminResumenScreen` + ejecutar análisis manual (✨). |

### Fase 5 — Onboarding gyms / predicción ingresos / refinamiento

**Iniciado**:
- Onboarding básico descartado y reemplazado por **Asistente de Branding IA** en `GymConfig`.
- Predicción en `admin-ai-insights` refinada con señal operativa (no-show/cancelaciones 30d + caída de asistencia) además de tasa histórica de cobro.

### Lectura rápida de prioridades (simple)

- **Ya listo para usar hoy:** resumen de cliente en ficha (punto 3) + copiar.
- **Lo próximo con más impacto operativo:** asistente de respuestas en chat (punto 8) y luego anomalías/proactividad (puntos 4–5).
- **Más estratégico / fase posterior:** onboarding guiado de gyms y predicción de ingresos (puntos 6–7).

## Texto de introducción para el admin (UI / tooltips)

> El asistente usa los datos de **tu** gimnasio cuando aplica; no inventa hechos fuera de lo que cargás. **Revisá siempre** borradores y mensajes antes de publicar o enviar. Las acciones que mueven dinero o contratos las confirmás vos.

## Riesgos explícitos

- **NL → SQL libre**: no en v1; solo RPC parametrizadas.
- **Privacidad**: no enviar a modelos externos datos que no deban salir del contrato con el proveedor de IA.
- **Alucinaciones**: mitigar con prompts acotados y “solo usar texto provisto”.

## Referencias en repo

- `utils/aiAssistant.js` — cliente hacia Edge (`draftMemberSummaryWithAi` → modo `message`).
- `screens/OrgMemberDetailScreen.js` — ficha + resumen + copiar.
- `supabase/functions/admin-ai-insights/index.ts` — análisis de anomalías/proactividad por sede y upsert en `admin_ai_alerts`.
- `supabase/migrations/20260428103000_admin_ai_alerts.sql` — tabla + RLS de alertas IA.
- `supabase/functions/generate-routine/index.ts` — modos `routine` | `rewrite` | `message` | `rm_format`.
- `docs/BRAND_AND_LOGO_SPEC.md` — marca (no IA).

### Operación mínima (nuevo bloque 4/5)

1. Aplicar migración de DB (`admin_ai_alerts`).
2. Deploy de función:
   - `npx supabase functions deploy admin-ai-insights`
3. Uso:
   - Botón **sparkles** en `AdminResumen` para correr análisis manual.
   - Opcional cron nocturno con service role para ejecución automática.
