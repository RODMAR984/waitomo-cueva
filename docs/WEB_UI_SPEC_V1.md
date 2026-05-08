# Web UI Spec V1 (Cerrada)

Objetivo: eliminar variaciones de estilo en web (botones volver, cajas, anchos, navegación) sin tocar lógica funcional.

## 1) Layout base (desktop web)

- Breakpoint web desktop: `>= 1100px`.
- Rail lateral:
  - ancho fijo: `232px`.
  - padding interno: `16px top`, `8px horizontal`, `12px bottom`.
- Columna principal:
  - ancho máximo de contenido: `1040px`.
  - padding lateral: `24px`.
  - gap vertical entre bloques: `16px`.
- Panel principal estándar:
  - `borderRadius: 16`
  - `borderWidth: 1` (`t.overlayBorder`)
  - `backgroundColor: t.boxBg`
  - `padding: 20` (desktop) / `16` (tablet)

## 2) Navegación (regla única)

- NO usar flecha flotante global.
- En desktop web staff (`useStaffWebHideInlineBack()`):
  - ocultar botones inline de "Volver" dentro de pantallas staff.
  - usar rail + historial del navegador.
- En el resto de pantallas:
  - usar `BackNavButton` como único patrón de volver.
  - estilo único:
    - alto mínimo `44`
    - `borderRadius: 12`
    - `borderWidth: 1`
    - texto `fontSize: 14`, `fontWeight: 700`

## 3) Sistema de cajas (simetría)

- Tarjetas de una misma pantalla deben compartir:
  - mismo radius (16),
  - mismo borde (1),
  - mismo padding interno.
- Evitar "tarjetas ultrawide":
  - cualquier card de datos debe respetar `maxWidth: 1040`.
- Evitar overlays ambiguos:
  - no usar barras turquesa sin label/ícono.
  - estados activos deben contrastar (texto visible siempre).

## 4) Sidebar / tabs web (cliente y staff)

- Item activo:
  - fondo activo: `hexToRgba(t.brand, 0.14)`
  - texto activo: `t.text` (NO `t.brand` sobre fondo turquesa).
- Item inactivo:
  - fondo transparente.
  - texto `t.text`, ícono `t.subText`.
- Nunca dejar item activo "vacío" visualmente.

## 5) Tipografía y espaciado operativo

- Título de pantalla: `28/800` (desktop), `24/800` (tablet).
- Subtítulo: `14/500` con `t.subText`.
- Texto cuerpo: `14/400`.
- Labels de formulario: `12/700`.
- Distancias:
  - campo a campo: `10`
  - bloque a bloque: `16`
  - sección a sección: `24`

## 6) Pantallas objetivo del barrido V1

- Cliente: `ClientScreen`, `ClientTabs`, `CalendarioScreen`, `PerfilUsuarioScreen`, `AbonosPasesScreen`, `PlanDetailScreen`, `ReservaScreen`, `PagoScreen`.
- Staff/admin web: `AdminScreen`, `AdminResumenScreen`, `AdminPlanesScreen`, `AdminAbonosScreen`, `GymConfigScreen`, `AdminObservabilityScreen`.
- Legales/config donde hoy aparece `BackNavButton`: `ConfigScreen`, `SeguridadScreen`, `PrivacyScreen`, `TermsScreen`, `AboutFitEngineScreen`.

## 7) Criterio de aceptación (finito)

1. Sin flecha flotante global.
2. Un solo patrón de "Volver" (según regla de desktop staff).
3. Sidebar sin estados activos ambiguos.
4. Todas las pantallas objetivo con el mismo sistema de cajas/radius/padding.
5. `npm run qa:web:release` + `npm run test:e2e:web` sin romper flujos.
