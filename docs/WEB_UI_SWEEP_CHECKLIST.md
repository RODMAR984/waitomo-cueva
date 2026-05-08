# Web UI Sweep Checklist (V1)

Checklist operativo para aplicar `docs/WEB_UI_SPEC_V1.md` en lote.

## A. Navegación / Volver

- [x] Sin flecha flotante global en web.
- [x] `BackNavButton` único en pantallas no-staff-desktop.
- [x] Staff desktop: inline back oculto con `useStaffWebHideInlineBack()`.
- [x] Sin estilos mezclados de "Volver" (icon-only, texto suelto, etc.) en mismas familias.

## B. Sidebar / tabs web

- [x] Item activo siempre legible.
- [x] Sin barra turquesa "vacía" en `ClientTabs`.
- [x] Consistencia de ancho, iconos y spacing en rail staff.

## C. Simetría visual

- [x] `maxWidth` uniforme (`1040`) en paneles principales.
- [x] Radius uniforme (`16`) en tarjetas de contenido.
- [x] Bordes y padding uniformes entre cards pares.
- [x] Sin cards "estiradas" horizontalmente fuera de spec.

## D. Pantallas cliente (bloque 1)

- [x] `ClientScreen`
- [x] `ClientTabs`
- [x] `CalendarioScreen`
- [x] `PerfilUsuarioScreen`
- [x] `AbonosPasesScreen`
- [x] `PlanDetailScreen`
- [x] `ReservaScreen`
- [x] `PagoScreen`

## E. Pantallas staff/admin (bloque 2)

- [x] `AdminScreen`
- [x] `AdminResumenScreen`
- [x] `AdminPlanesScreen`
- [x] `AdminAbonosScreen`
- [x] `GymConfigScreen`
- [x] `AdminObservabilityScreen`

## F. Pantallas legales/config (bloque 3)

- [x] `ConfigScreen`
- [x] `SeguridadScreen`
- [x] `PrivacyScreen`
- [x] `TermsScreen`
- [x] `AboutFitEngineScreen`

## G. Verificación final

- [x] `npm run qa:web:release` OK
- [x] `npm run test:e2e:web` OK
- [ ] revisión visual de 3 capturas clave: Abonos, Perfil, Panel
