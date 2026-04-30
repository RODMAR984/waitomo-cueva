# FitEngine — Plan de salida a mercado (Go-To-Market)

Estado: listo para ejecución comercial  
Dueño: producto/comercial FitEngine  
Fecha: 2026-04-29

---

## 1) Objetivo de este documento

Definir un plan simple para salir al mercado con foco en ventas reales, evitando sobreconstruir features antes de validar demanda.

Principio rector:

> Lo que no impacta ventas/retención en los próximos 60-90 días, se posterga.

---

## 2) Qué vendemos hoy (oferta actual)

FitEngine se vende como plataforma unificada para:

- gym físico con clases presenciales (cupo real, reservas, waitlist),
- coach online (seguimiento, historial, comunicación),
- operación admin (cobros, alertas, plantillas, IA asistiva).

Mensaje comercial corto:

> "La operación diaria del gym y el coach en una sola app, sin pagar por módulos que no usás."

---

## 3) Alcance v1 comercial (lo que sí sale ya)

### Producto listo para vender

- multi-tenant con aislamiento por RLS,
- reservas con cupo + waitlist,
- pagos operativos (caja + MP ya integrado),
- branding por organización,
- IA asistiva en admin (resumen, alertas, plantillas),
- chat y novedades por organización,
- i18n ES/EN y base preparada para PT.

### Segmento inicial

- LATAM (primero AR, luego MX/CL/CO/PE),
- gyms y boxes pequeños/medianos (1 a 4 sedes),
- dueños que hoy trabajan con WhatsApp + planilla + herramientas sueltas.

### Resultado esperado de v1 (primeros 90 días)

- 10-20 cuentas pagas activas,
- churn inicial controlado (objetivo: <10% mensual en cohorte temprana),
- validación de pricing y onboarding.

---

## 4) Plan de salida (90 días)

### Etapa A — Preparación comercial (semana 1-2)

- cerrar landing comercial clara (problema, demo, pricing, CTA),
- armar demo guiada de 15 minutos,
- definir plan de onboarding estándar (día 0, día 7, día 30),
- habilitar soporte de activación (WhatsApp + email),
- definir contrato simple + T&C para B2B.

### Etapa B — Piloto pago (semana 3-6)

- migrar pilotos actuales a plan pago con descuento de early adopters,
- medir métricas base: activación, uso semanal, cobro, retención,
- entrevistas semanales con dueños para objeciones de venta y uso.

### Etapa C — Escala controlada (semana 7-12)

- campañas outbound/inbound de bajo costo (referidos + demos),
- estandarizar onboarding para 3 perfiles: box, gym tradicional, coach,
- publicar casos de uso y resultados concretos (ahorro de tiempo, recuperación de clientes, cobros).

---

## 5) Requisitos mínimos para vender internacional

Orden recomendado (sin abrir frentes innecesarios):

1. Stripe Capa 1 (cliente paga al gym)  
2. Multi-moneda por organización  
3. Multi-zona horaria por organización  
4. Portugués (PT-BR)  

Nota:

- francés/italiano/catalán quedan fuera de esta etapa.

---

## 6) Qué queda explícitamente para “cuando haya demanda real”

Estas iniciativas NO entran en el alcance inmediato. Se habilitan solo si hay señal comercial clara (ventas perdidas por falta de feature, churn atribuible o pedido repetido de cuentas objetivo).

### Backlog condicionado por demanda

- Stripe Connect (marketplace/KYC avanzado),
- automatización nativa completa de WhatsApp Business,
- SMS automation global,
- API pública + app oficial en Zapier,
- cumplimiento GDPR técnico extendido (export/delete full automation),
- idiomas adicionales (FR/IT/CAT),
- marketplace de descubrimiento,
- integraciones de nicho no críticas.

### Regla de activación de demanda (gate)

Solo se prioriza si se cumple al menos 1:

- 3+ oportunidades de venta perdidas por la misma razón en 30 días,
- 2+ clientes pagos con riesgo real de baja por esa falta,
- impacto esperado >15% en conversión o >10% en retención del segmento objetivo.

---

## 7) Pricing y empaquetado (propuesta inicial)

### Paquete Base

- operación diaria completa + reservas + branding + IA asistiva base.

### Add-ons (cuando aplique)

- comunicaciones avanzadas (email/WhatsApp/SMS masivo),
- reportes premium,
- comisiones por coach,
- features enterprise.

Objetivo:

- mantener entrada simple (menos fricción de compra),
- cobrar extra por funcionalidades de alto costo operativo.

---

## 8) Métricas de éxito (tablero de dirección)

### Comercial

- demos por semana,
- tasa demo -> alta,
- tasa alta -> pago,
- CAC estimado.

### Producto

- activación (acciones clave en primeros 7 días),
- WAU por sede,
- uso de reservas/cobros/plantillas.

### Negocio

- MRR neto,
- churn logo y churn ingresos,
- NPS/cualitativo de dueños.

---

## 9) Riesgos y mitigación

- Riesgo: dispersión de roadmap  
  Mitigación: respetar gates de demanda.

- Riesgo: fricción en onboarding  
  Mitigación: playbook único + checklist por tipo de gym.

- Riesgo: sobredependencia de features “nice to have”  
  Mitigación: priorizar cobro, retención y operación diaria.

---

## 10) Decisiones de alcance (resumen ejecutivo)

- Sí ahora: vender con stack actual + mejoras bloqueantes de internacional (Stripe/multi-moneda/timezone/PT).
- No ahora: ampliar idiomas europeos, marketplace, y ecosistema de integraciones avanzadas.
- Todo lo adicional se activa bajo demanda real y con evidencia.

