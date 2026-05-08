# Web UI Sweep Checklist (V1)

Checklist operativo para aplicar `docs/WEB_UI_SPEC_V1.md` en lote.

## A. Navegación / Volver

- [ ] Sin flecha flotante global en web.
- [ ] `BackNavButton` único en pantallas no-staff-desktop.
- [ ] Staff desktop: inline back oculto con `useStaffWebHideInlineBack()`.
- [ ] Sin estilos mezclados de "Volver" (icon-only, texto suelto, etc.) en mismas familias.

## B. Sidebar / tabs web

- [ ] Item activo siempre legible.
- [ ] Sin barra turquesa "vacía" en `ClientTabs`.
- [ ] Consistencia de ancho, iconos y spacing en rail staff.

## C. Simetría visual

- [ ] `maxWidth` uniforme (`1040`) en paneles principales.
- [ ] Radius uniforme (`16`) en tarjetas de contenido.
- [ ] Bordes y padding uniformes entre cards pares.
- [ ] Sin cards "estiradas" horizontalmente fuera de spec.

## D. Pantallas cliente (bloque 1)

- [ ] `ClientScreen`
- [ ] `ClientTabs`
- [ ] `CalendarioScreen`
- [ ] `PerfilUsuarioScreen`
- [ ] `AbonosPasesScreen`
- [ ] `PlanDetailScreen`
- [ ] `ReservaScreen`
- [ ] `PagoScreen`

## E. Pantallas staff/admin (bloque 2)

- [ ] `AdminScreen`
- [ ] `AdminResumenScreen`
- [ ] `AdminPlanesScreen`
- [ ] `AdminAbonosScreen`
- [ ] `GymConfigScreen`
- [ ] `AdminObservabilityScreen`

## F. Pantallas legales/config (bloque 3)

- [ ] `ConfigScreen`
- [ ] `SeguridadScreen`
- [ ] `PrivacyScreen`
- [ ] `TermsScreen`
- [ ] `AboutFitEngineScreen`

## G. Verificación final

- [ ] `npm run qa:web:release` OK
- [ ] `npm run test:e2e:web` OK
- [ ] revisión visual de 3 capturas clave: Abonos, Perfil, Panel
