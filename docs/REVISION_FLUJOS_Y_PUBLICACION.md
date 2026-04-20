# Revisión de flujos por plan y guía de publicación

**Ruta producto / piloto / lanzamiento (memo por fases):** [`ROADMAP_MEMO_PRODUCTO_Y_LANZAMIENTO.md`](./ROADMAP_MEMO_PRODUCTO_Y_LANZAMIENTO.md).

**Checklist operativo (piloto + alta gims + lista de humo):** [`CHECKLIST_PILOTO_OPERACION_Y_HUMO.md`](./CHECKLIST_PILOTO_OPERACION_Y_HUMO.md).

## Resumen ejecutivo

- **¿Publicar ya en Apple y Google?** Depende de tu checklist interno. La app puede salir de Expo Go y publicarse cuando: (1) los flujos por plan estén validados, (2) tengas Sign in with Apple (si usas otros logins sociales), (3) tengas cuentas y builds listos (EAS, Apple Developer, Google Play).
- **¿Salir de Expo Go?** Sí, cuando quieras distribuir en tiendas o TestFlight/Internal testing: generás builds nativos (.ipa / .aab) con EAS Build; el código sigue siendo Expo/React Native.
- **Corrección aplicada:** ReservaClaseScreen ahora pasa `horario` (no `hora`) a TrabajoDelDia; TrabajoDelDiaScreen acepta `horario` o `hora` en params para compatibilidad con CalendarioScreen.

---

## 0. Estado de planes (abr. 2026)

### 0.1 Plan técnico cliente — **implementado en código (no “cerrado” hasta validar)**

En el repo ya está desarrollado (migraciones + pantallas + utilidades):

- **Clase de prueba (trial):** día y horario elegibles; RPC de reserva/reagenda; cancelación con margen de aviso; finalización de sesiones pasadas sin aviso (`completed_no_show`); entitlement de `training_daily_blocks` solo con grant `scheduled` en fecha/slot correctos.
- **Chat y novedades:** gating en app + **RLS** en base (`gym_news`, `chat_channels`, `chat_messages`) con `user_has_org_community_entitlement`.
- **Caché de bloques:** en modo cliente, pull remoto vacío por sede → no conservar bloques viejos de esa org en AsyncStorage.

Migraciones de referencia: `20250410400000_trial_class_grants_status_booking_rpcs.sql`, `20250410410000_community_entitlement_rls.sql`, `20250410420000_community_entitlement_plan_scope.sql`, `20250410421000_trial_class_grants_status_comment.sql` (y las previas de trial / entitlement de rutina).

### 0.2 Hecho en esta iteración (código + SQL + copy)

- **Margen de cancelación:** constante única `FREE_CLASS_CANCEL_NOTICE_HOURS` en `utils/freeClassPolicy.js` (app + textos con `{{hours}}`; el RPC sigue recibiendo horas por parámetro).
- **Textos / política “consumida”:** copy actualizado en `locales/translations.js` (éxito, cancelación, tarde, pie de pantalla de reserva, tarjeta en Home).
- **`completed_attended`:** documentado en SQL (`20250410421000_…`); no otorga acceso retroactivo (solo reporting / futuro staff).
- **Chat por plan:** RLS con `user_has_org_community_entitlement(org, plan_id)` en canales/mensajes; novedades sigue con `plan` NULL (trial cualquier plan en la sede). Lista de canales en app filtrada por plan salvo staff.
- **Reserva + fallo servidor:** si falla el RPC tras intentar reservar, se hace `clearFreeClassGrant()` y mensaje dedicado (`freeclass_book_*`).
- **i18n:** `npm run i18n:check` OK.

### 0.3 Pendientes (lo que sigue a cargo vuestro / QA)

Lista unificada (15 flujos + piloto + alta gym): [`CHECKLIST_PILOTO_OPERACION_Y_HUMO.md`](./CHECKLIST_PILOTO_OPERACION_Y_HUMO.md).

1. **Probar en dispositivo real** (mismo checklist que antes): reservar → cambiar fecha → cancelar **dentro** del margen → cancelar **fuera** del margen (debe bloquear) → pasar el día de la clase (acceso trial cortado / no-show en servidor).
2. **`supabase db push`** (o equivalente) en el proyecto **correcto** para aplicar `20250410420000` y `20250410421000` si aún no están en remoto.
3. **Timezone:** el RPC de cancelación usa `America/Argentina/Buenos_Aires`; si el gym opera en otra zona, conviene parametrizar o documentar.
4. **Smoke staff:** `owner` / `coach` / `cliente` en chat + novedades + listado de canales.
5. **Tiendas:** §2 y §3 (EAS, Apple, Google).

### 0.4 Checklist rápido manual (trial + chat)

| Paso | Qué mirar |
| --- | --- |
| Reserva | Confirmación en servidor + tarjeta en Home con fecha/hora correctas |
| Cambiar | Reagenda y queda una sola fila `scheduled` vigente |
| Cancelar a tiempo | RPC ok, tarjeta desaparece, AsyncStorage limpio |
| Cancelar tarde | Alerta “ya no se puede”; fila sigue hasta el cierre diario |
| Día siguiente | Sin acceso a rutina por trial; grant pasado a `completed_no_show` al correr finalize |
| Chat | Solo canales del plan del trial (cliente); staff ve todos |

### 0.5 Publicación en tiendas — recordatorio

Roadmap detallado en **§2 Checklist antes de publicar** y **§3 Siguientes pasos sugeridos**. Próximo paso típico: checklist en build real (TestFlight / internal track) y primer **EAS Build** de prueba.

---

## 1. Flujos por plan (resumen)

### 1.1 Entrada desde Welcome

- **Welcome** → (elegir plan) → **PlanSelector** → **PlanDetail** (por plan).
- Desde PlanDetail, según plan:
  - **Evolución** → RegistroEvolucion → CreateAccount / RegistroInicial → Pago → RegistroCompleto → ClientTabs.
  - **Free class** → FreeClassRequest → CreateAccount / RegistroInicial → (sin pago) → RegistroCompleto → ClientTabs.
  - **Abonos / Pases** → AbonosPases → CreateAccount / RegistroInicial → Pago → RegistroCompleto → ClientTabs.

### 1.2 Cliente logueado (ClientTabs)

- **ClientScreen (Home):** panel con plan, novedades, acceso a Trabajo del día y Calendario.
- **Calendario:** día + horario → navega a **TrabajoDelDia** con `fecha`, `hora`, `plan` (TrabajoDelDiaScreen acepta `hora` como `horario`).
- **Trabajo del día:** desde Home o Calendario; params: `plan`, `planKey`, `planValue`, `fecha`, `horario` (o `hora`).
- **ReservaClaseScreen:** selección de hora → **TrabajoDelDiaScreen** con `plan`, `fecha`, `horario`.
- **Perfil** → Config (tema, notificaciones).
- **Novedades** → lista; **ChatCanales** → **Chat** (por canal/plan-día-horario).

### 1.3 Staff / Admin

- **Login** (o CreaCuentaStaff) → si es admin → **Admin** (stack completo); si es coach → **AdminLite**.
- **Admin:** Mi perfil (Perfil → Config), Finanzas, Novedades, AdminNovedades, bloques, mensajes, etc. Selector de fecha con calendario + flechas.
- Resets: logout o cambio de rol llevan a Welcome/ClientTabs/Admin según corresponda.

### 1.4 Rutas que deben recibir bien el plan

- **TrabajoDelDiaScreen:** `plan` / `planKey` / `planValue` desde ClientScreen o desde Calendario/ReservaClase; `fecha`; `horario` o `hora`.
- **Chat/ChatCanales:** canal por plan (y opcional día/horario).
- **RegistroEvolucion, FreeClassRequest, AbonosPases, Pago, RegistroCompleto:** cada uno con su flujo según plan; al terminar → ClientTabs.

---

## 2. Checklist antes de publicar

- [ ] Probar en dispositivo real (no solo Expo Go): flujo completo de registro por cada plan (Evolución, Free class, Abonos/Pases).
- [ ] Probar Calendario → TrabajoDelDia y ReservaClase → TrabajoDelDia con distintos planes y horarios.
- [ ] Probar tema claro/oscuro/auto y Config (notificaciones).
- [ ] Si tenés login con Google/otro social: implementar **Sign in with Apple** (requisito de Apple).
- [ ] EAS Build: `eas build --platform all` (o por plataforma), con credenciales de Apple y Google configuradas.
- [ ] Apple: App Store Connect, política de privacidad, capturas, descripción; TestFlight para pruebas.
- [ ] Google: Play Console, política de privacidad, contenido, Internal/Closed testing.
- [ ] Revisar permisos (notificaciones, etc.) y que estén declarados en app.json/app.config.*.

---

## 3. Siguientes pasos sugeridos

1. **Pulir:** Revisar a mano cada pantalla por plan (Evolución, Free class, Abonos, Admin, Coach) y anotar cualquier detalle de copy o UX.
2. **Apple Sign In:** Añadir botón y flujo con `expo-apple-authentication` + Supabase Auth antes de subir a Apple si usas otros logins sociales.
3. **Builds:** Configurar EAS y generar un build de desarrollo primero; luego producción para Apple y Google cuando el checklist esté listo.

Si querés, en el próximo paso podemos repasar pantalla por pantalla (por plan) o preparar la configuración de EAS y Sign in with Apple.
