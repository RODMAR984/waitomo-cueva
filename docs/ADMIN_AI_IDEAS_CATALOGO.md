# Catálogo de ideas — IA para staff del gym

Documento para **alinear expectativas** con brainstorms (p. ej. charlas con Claude u otros): qué suele pedirse, qué ya hace el código y qué queda en cola. Si tenés **otra lista** (copiado de un chat), pegala al final en una sección “Pegado externo” o sumá filas a la tabla.

**Relacionado:** priorización por fases → [`ADMIN_AI_ROADMAP.md`](./ADMIN_AI_ROADMAP.md).

---

## Ideas típicas y estado en el repo

| Idea (ejemplos de producto) | Qué aporta al staff | Estado |
|----------------------------|---------------------|--------|
| **Última vez que vino / hace cuánto** | Contexto rápido de asistencia | **Hecho** en ficha miembro: bloque “Resumen de asistencia” usa `completed_attended` + días desde última clase. |
| **Cuántas veces vino en el último mes** | Ritmo real | **Hecho**: contador 30 días en la misma ficha. |
| **Ausencias (no-show) y cancelaciones** | Riesgo de abandono o fricción | **Hecho**: contadores últimos 30 días + totales en la ventana de reservas listadas. |
| **Abono por vencer** | Cobro / renovación | **Hecho**: líneas automáticas si `end_date` cae en ~21 días (sobre filas de abono de la sede). |
| **Próxima clase agendada** | Coordinación | **Hecho** (si hay `scheduled` a futuro en la lista). |
| **Resumen en un párrafo + copiar a WhatsApp** | Comunicación con el socio | **Hecho**: `OrgMemberDetailScreen` + `draftMemberSummaryWithAi`. |
| **Plantillas de mensaje** (pago pendiente, cambio de horario, win-back) | Menos tiempo redactando | **Pendiente** (Fase 1b en roadmap). |
| **Sugerir respuesta en chat staff–cliente** | Menos fricción en soporte | **Pendiente** (Fase 1c). |
| **Preguntas con datos** (“altas este mes”, “cupos por franja”) | Operación sin Excel | **Pendiente** (Fase 3: intents + RPC). |
| **Alertas proactivas** (“hace X días que no viene fulano”) | Retención | Parcialmente cubierto en el **párrafo** si los hechos lo muestran; **pendiente** cards en Resumen / jobs (Fase 4). |
| **Detección de anomalías nocturna** (“30% menos asistencias”) | Ver problemas que no se ven a simple vista | **Pendiente** (Fase 4a + cards 4b). |
| **Sugerencias proactivas accionables** (promos por baja ocupación, aniversarios, ajuste de horarios) | Acciones concretas para crecer/retener | **Pendiente** (Fase 4a / Fase 3a según tipo de dato). |
| **Onboarding guiado de gym nuevo** (preguntas y setup automático) | Bajar tiempo de alta operativa | **Pendiente** (Fase 5). |
| **Predicción de ingresos** (escenarios por renovaciones/vencimientos) | Planificación financiera | **Parcial**: alerta con escenarios **pesimista/probable/optimista** en `admin-ai-insights` (MTD + pendiente + tasa histórica 60d). Modelo completo sigue **pendiente** (Fase 5). |

---

## Limitaciones honestas (para no frustrar al staff)

1. **Asistencia** depende de que las reservas pasen a estado **`completed_attended`** cuando la persona realmente vino. Si eso no se marca en operación, el resumen va a subestimar asistencia.
2. Los números salen de **ventanas acotadas** (cantidad máxima de reservas y de abonos que cargamos en la ficha), no de toda la historia infinita del socio.
3. La IA **no** ejecuta cobros ni mensajes sola: solo **texto** para revisar y copiar.

---

## Mejoras ya aplicadas “encima” del brainstorm mínimo

- Cálculo explícito de **última asistencia**, **días desde entonces**, **asistencias 30d**, **no-shows**, **cancelaciones**, **vencimiento de abono** en el bloque de hechos que ve el modelo (además de la lista cruda).

---

## Mapeo rápido de tus puntos 3–8

- **3. Resumen automático de cliente**: ya encendido en `OrgMemberDetailScreen` (hecho), con cálculo explícito previo a la IA.
- **4. Detección de anomalías**: pendiente; requiere job nocturno + baseline por sede + umbrales + alerta en admin.
- **5. Sugerencias proactivas**: pendiente; puede apoyarse en las mismas métricas de anomalías y ocupación.
- **6. Onboarding de gyms nuevos**: pendiente; conviene hacerlo como wizard guiado con confirmaciones, no 100% automático al inicio.
- **7. Predicción de ingresos**: pendiente; primero conviene estabilizar calidad de datos de altas/bajas/vencimientos.
- **8. Asistente de respuestas a clientes**: pendiente; ya encaja directo con la Fase 1c del roadmap.

---

## Pegado externo (opcional)

_Pegá acá bullets o tabla de otra fuente (Claude, Notion, etc.) para no perderlas; el equipo las puede convertir en filas de la tabla de arriba._

```
3. Resumen automático de cliente
En el perfil de cada cliente, un recuadro generado por IA: "Lucas viene desde marzo 2025, asiste 3-4 veces por semana, prefiere clases de las 18hs, completó 47 entrenamientos, su última lesión fue de rodilla en agosto. Este mes asistió 80% menos de lo habitual — posible riesgo de baja."
Esto le ahorra al coach/admin leer todo el historial. Un párrafo de contexto antes de hablar con el cliente.
4. Detección de anomalías
La IA corre análisis cada noche y al admin le aparece una alerta tipo: "Detecté que esta semana hubo 30% menos asistencias que el promedio. Posibles causas: feriado del martes, una clase nueva sin promoción. ¿Querés ver detalle?"
Detecta cosas que un humano no mira si no las busca.
5. Sugerencias proactivas
La IA mira los datos y sugiere acciones concretas:

"Tenés 3 horarios con menos del 30% de ocupación: jueves 10hs, sábado 8hs y domingo 18hs. ¿Querés que te ayude a redactar una promo para llenarlos?"
"Hay 8 clientes que cumplen un año este mes. Buen momento para un mensaje de felicitación con un 10% off de renovación."
"Tu plan 'CrossFit avanzado' creció 40% en altas vs el trimestre pasado, mientras 'Funcional principiante' bajó 20%. Capaz convenga ajustar horarios."

6. Onboarding de gyms nuevos
Cuando un gym nuevo se suma a FitEngine, la IA lo guía:

"Hola, soy el asistente de FitEngine. Para configurar tu gym necesito saber: ¿cuántos planes ofrecés? ¿qué horarios tenés? ¿usás Mercado Pago?"
A partir de las respuestas, va creando configuraciones, planes, horarios, todo automatizado
Reduce el setup de 3 horas a 20 minutos

7. Predicción de ingresos
La IA mira histórico de altas, bajas y vencimientos para proyectar: "Si la tendencia sigue, tu facturación de mayo va a ser entre $X y $Y. Tenés 12 abonos venciendo la primera semana — si renuevan 8 (tu promedio), el escenario realista es Z."
Útil para el admin que necesita planificar gastos.
8. Asistente de respuestas a clientes
En el chat con clientes, cuando el admin/coach va a responder, la IA sugiere una respuesta basada en el contexto del cliente y conversaciones previas. El admin acepta, edita, o ignora. No reemplaza al humano, lo asiste.
```

