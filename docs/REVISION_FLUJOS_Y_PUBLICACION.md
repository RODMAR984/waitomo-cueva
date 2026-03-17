# Revisión de flujos por plan y guía de publicación

## Resumen ejecutivo

- **¿Publicar ya en Apple y Google?** Depende de tu checklist interno. La app puede salir de Expo Go y publicarse cuando: (1) los flujos por plan estén validados, (2) tengas Sign in with Apple (si usas otros logins sociales), (3) tengas cuentas y builds listos (EAS, Apple Developer, Google Play).
- **¿Salir de Expo Go?** Sí, cuando quieras distribuir en tiendas o TestFlight/Internal testing: generás builds nativos (.ipa / .aab) con EAS Build; el código sigue siendo Expo/React Native.
- **Corrección aplicada:** ReservaClaseScreen ahora pasa `horario` (no `hora`) a TrabajoDelDia; TrabajoDelDiaScreen acepta `horario` o `hora` en params para compatibilidad con CalendarioScreen.

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
