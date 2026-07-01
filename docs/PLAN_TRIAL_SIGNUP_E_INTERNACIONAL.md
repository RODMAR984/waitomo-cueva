# Plan FitEngine — Prueba gratis 14 días + internacional (fase 1)

**Estado:** en implementación  
**Última actualización:** 2026-06-05  
**Dueño producto:** Rodrigo  

## Objetivo

1. Que el CTA de la landing (`app.fitengine.app/signup?trial=14d`) lleve a un **alta real** con trial de 14 días, auditable y sin romper invitaciones ni clientes.
2. Empezar el **camino internacional** (país → moneda/zona horaria) en el mismo flujo, paso a paso.

## Nombres (evitar confusiones)

| Antes (idea / docs viejos) | Ahora en código |
|----------------------------|-----------------|
| `WelcomeGymScreen` (signup landing) | **`OwnerTrialSignupScreen`** — ruta `TrialSignup` |
| `WelcomeGymScreen` (deep link gym existente) | Sigue siendo concepto futuro; **no** es esta pantalla |

## Flujo producto (trial)

```
Landing "Probar gratis"
  → /signup?trial=14d
  → OwnerTrialSignupScreen (4 pasos)
  → Supabase Auth signUp (paso 1)
  → RPC signup_owner_with_trial (paso 4)
  → Panel admin (trial activo)
  → Día 15+: subscription_status = expired, banner rojo, sin crear planes/bloques/cobros
```

**Sin `?trial=14d`:** redirige al welcome habitual (`WelcomeGlobal`).

## Checklist implementación

### Fase A — Base de datos (bloqueante)

- [x] Migración `20260610170000_owner_trial_signup.sql` (antes `20260605120000_*`, colisión de timestamp)
- [x] Aplicar en Supabase — `20260610170000_owner_trial_signup.sql` (renombrada; push OK)
- [x] Columnas: `trial_expires_at`, `subscription_status`, `country`, `city`, `activity_type`, `business_model`, `size_range`
- [x] RPC `signup_owner_with_trial` (SECURITY DEFINER, audit log)
- [x] Vista `platform_orgs_overview` con campos trial

### Fase B — App (alta trial)

- [x] `OwnerTrialSignupScreen` — 4 pasos, ES/EN/PT
- [x] Ruta web `/signup` + query `trial=14d`
- [x] `RegistroOwner` y CTA welcome → `TrialSignup`
- [x] Servicio `services/signup/ownerTrialSignup.js`
- [x] Defaults país → `billing_currency` + `timezone` (`utils/orgLocaleDefaults.js`)

### Fase C — Trial vencido

- [x] `hooks/useTrialStatus.js`
- [x] `components/TrialPlatformBanner.js`
- [x] Bloqueo escritura en menú admin + publicar bloques
- [ ] QA: día 14 activo, día 15 banner + botones deshabilitados

### Fase D — Superadmin / email

- [x] Listado orgs muestra estado trial y vencimiento
- [x] Evento `org_created_with_trial` en `platform_audit_log`
- [ ] Template email bienvenida en dashboard Supabase Auth (manual)
- [ ] Resend custom (fase 2)

### Fase E — Internacional (continuación)

- [x] País en signup + defaults moneda/TZ
- [ ] `formatMoney(org)` centralizado en pantallas de precio
- [ ] RPCs SQL: dejar de hardcodear `America/Argentina/Buenos_Aires`
- [ ] Portugués completo o ocultar selector hasta estar listo
- [ ] Stripe checkout con `billing_currency` de la org

## QA antes de merge / lanzamiento landing

- [ ] Migración aplicada sin error
- [ ] Signup completo → org + membership owner + trial 14 días
- [ ] `platform_audit_log` con `org_created_with_trial`
- [ ] Email confirmación Supabase llega
- [ ] Login post-signup → admin con tema FitEngine
- [ ] `/signup?trial=14d` sin login previo
- [ ] `/signup` sin trial → welcome
- [ ] Invitación con código sigue funcionando
- [ ] Trial vencido: banner + no crear plan/bloque/cobro; datos intactos
- [ ] ES / EN / PT en pantalla de alta

## Lo que NO hace esta fase

- Cobro automático post-trial
- Plan free tras vencimiento
- Email "quedan 3 días"
- Pricing tiers / compare
- GDPR tooling (export/borrado masivo)

## Commits sugeridos (uno por bloque)

1. `feat(db): trial SaaS signup_owner_with_trial y columnas organizations`
2. `feat(onboarding): OwnerTrialSignupScreen y ruta /signup`
3. `feat(admin): guard trial vencido y visibilidad superadmin`
