# Maestro — pruebas móviles (FitEngine / Expo)

Este proyecto usa [Maestro](https://maestro.mobile.dev/) para E2E en **Android** o **iOS** contra el binario instalado en emulador o dispositivo.

## 1. Instalar el CLI Maestro

Seguí la guía oficial: [Installing Maestro](https://maestro.mobile.dev/getting-started/installing-maestro).

- **macOS / Linux:** por ejemplo `curl -Ls "https://get.maestro.mobile.dev" | bash`
- **Windows:** usá las instrucciones del sitio (PATH debe incluir el ejecutable `maestro`).

Comprobación:

```bash
maestro --version
```

## 2. App en el dispositivo

Maestro **no** ejecuta `npx expo start`, **no** abre Expo Go escaneando el QR y **no** “engancha” el localhost del PC por vos. Hace `launchApp` del paquete nativo:

- **Android:** `com.waitomofitengine.cueva` (`app.json` → `android.package`)
- **iOS:** `com.waitomofitengine.cueva` (`bundleIdentifier`)

### Qué suele salir mal

| Síntoma | Causa típica |
|--------|----------------|
| Solo `npx expo start` + QR en **Expo Go** | Expo Go es otra app (`host.exp.exponent`). Maestro busca **FitEngine** instalada con el id de arriba. |
| Dev client instalado pero pantalla **“Conectar a Metro” / scan / localhost** | El teléfono no alcanza el bundler (otra WiFi, firewall, USB sin túnel). Maestro no reemplaza esa conexión. |
| Maestro falla en `welcome-global-content` | La app no llegó al welcome (splash colgado, crash, o no es el binario correcto). Revisá capturas en `~/.maestro/tests/...`. |
| Build release: `mergeReleaseResources` / AAPT **file failed to compile** en un `.png` | Muchas veces es un **JPEG** guardado con extensión `.png`. AAPT espera PNG válido; renombrá a `.jpg` y actualizá el `require`. |

### Opción A — Build **release** en Android (recomendada para Maestro, sin Metro en el celular)

Así el JS va empaquetado en el APK; no hace falta dejar `expo start` corriendo para que abra la app.

1. Teléfono con **depuración USB** (o emulador).
2. En la raíz del repo:

```bash
npx expo run:android --variant release
```

3. Abrí manualmente **FitEngine** una vez y comprobá que ves el welcome (no la pantalla de conectar a Metro).
4. `npm run test:mobile:client` (u otro script) **desde el PC** con el dispositivo conectado.

*(Si `--variant release` no está disponible en tu versión de Expo CLI, usá un APK preview de EAS u otra variante release documentada en tu entorno.)*

### Opción B — **Development build** (`expo-dev-client`) con Metro

Este repo usa el plugin `expo-dev-client`: el binario debug suele necesitar **Metro** en la red local.

1. Terminal 1: `npx expo start` (dejalo abierto).
2. Terminal 2: `npx expo run:android` (instala y abre la dev build; debe cargar el bundle y mostrar el welcome).
3. Misma WiFi PC–teléfono (o `adb reverse tcp:8081 tcp:8081` en Android por USB).
4. Recién ahí `npm run test:mobile:…`. Si `launchApp` con `clearState` te devuelve a “Conectar a Metro”, preferí la **opción A** para los tests.

### iOS

`npx expo run:ios` (o build de TestFlight / EAS) con el mismo bundle id; mismas ideas: Maestro no sustituye Metro en dev.

## 3. Variables de entorno (credenciales)

| Variable | Uso |
|----------|-----|
| `MAESTRO_CLIENT_EMAIL` | Cuenta **cliente** (login global desde welcome) |
| `MAESTRO_CLIENT_PASSWORD` | Contraseña cliente |
| `MAESTRO_ORG_ADMIN_EMAIL` | **Admin de org** (owner / admin / coach con panel staff) |
| `MAESTRO_ORG_ADMIN_PASSWORD` | Contraseña de esa cuenta |
| `MAESTRO_ADMIN_EMAIL` | Cuenta **superadmin** o platform admin (mismo login global) |
| `MAESTRO_ADMIN_PASSWORD` | Contraseña de esa cuenta |

**Dónde ponerlas (recomendado en este repo):** en la raíz del proyecto, archivo **`Maestro/.env.local`** (no se sube a git). Podés partir de **`Maestro/.env.example`**: copialo, renombrá a `.env.local` y completá los valores. Los scripts `npm run test:mobile*` usan `scripts/maestro-run.cjs`, que carga esas variables antes de llamar a `maestro test`.

**Prioridad:** variables que ya existan en el terminal / sistema **pisan** el archivo; así podés sobreescribir sin editar el archivo.

**Maestro Studio (escritorio):** los flows usan `${MAESTRO_CLIENT_EMAIL}` etc. El Studio **no** reemplaza esas variables por una “libreta de contraseñas” integrada: Maestro las toma del **entorno del proceso** que ejecuta el test. Opciones prácticas: (1) definir las variables en Windows antes de abrir Studio, (2) ejecutar los tests desde la terminal del repo con `Maestro/.env.local` vía `npm run test:mobile:…`, o (3) en CLI: `maestro test Maestro/flows/run-client.yaml -e MAESTRO_CLIENT_EMAIL=… -e MAESTRO_CLIENT_PASSWORD=…`.

Sin credenciales, los flows que hacen login fallarán de forma esperada.

**Cliente — «Trabajo hoy»:** el paso `client-trabajo-hoy-smoke` espera llegar a `screen-trabajo-dia` (pantalla de entreno o pantalla de bloqueo con el mismo contenedor). Si la cuenta **no tiene plan** o **no tiene permiso de entreno**, `goTrabajoHoy` puede mostrar solo un `Alert` y el test **no** verá `screen-trabajo-dia`: usá un `MAESTRO_CLIENT_*` con plan/abono alineado a tu seed.

**Org admin — tiles extra:** el smoke solo usa **resumen**, **bloques** y **perfil** (siempre visibles). Para Maestro manual sobre **miembros / novedades / planes** usá un usuario **owner o no-lite** (`staff-hub-tile-mem`, etc.); esos tiles no existen en el grid del coach «lite».

## 4. Comandos npm

| Script | Qué ejecuta |
|--------|-------------|
| `npm run test:mobile` | **Smart suite:** mira `Maestro/.env.local` (y el shell) y ejecuta **solo** los segmentos para los que exista **email y password** del par correspondiente. Si tenés las **tres** parejas completas, corre un solo `maestro test` con `suite-all.yaml` (igual que antes). Si solo una o dos, corre Maestro por segmento y **no falla** por credenciales faltantes. |
| `npm run test:mobile:full` | Fuerza `Maestro/flows/suite-all.yaml` en un solo proceso (útil en CI). Requiere que los tres logins tengan variables definidas; si falta alguna, el flow fallará al expandir `${MAESTRO_*}` vacío. |
| `npm run test:mobile:client` | Solo cliente: welcome → login → home → … |
| `npm run test:mobile:org-admin` | Solo admin de org: … |
| `npm run test:mobile:admin` | Solo plataforma: … |

`npm run test:mobile` llama internamente a `node scripts/maestro-run.cjs --smart-suite`. El resto de scripts usan `maestro-run.cjs` con la ruta al YAML del rol.

**No guardamos contraseñas en el repo:** las tenés que poner vos en `Maestro/.env.local` o en variables de entorno; el asistente no puede inventarlas ni leer tu `.env.local` ignorado por git.

### Ejemplos (PowerShell en Windows)

```powershell
cd c:\Users\marla\waitomo-cueva
$env:MAESTRO_CLIENT_EMAIL = "cliente@ejemplo.com"
$env:MAESTRO_CLIENT_PASSWORD = "tu-password"
npm run test:mobile:client
```

```powershell
$env:MAESTRO_ORG_ADMIN_EMAIL = "owner@ejemplo.com"
$env:MAESTRO_ORG_ADMIN_PASSWORD = "tu-password"
npm run test:mobile:org-admin
```

```powershell
$env:MAESTRO_ADMIN_EMAIL = "admin@ejemplo.com"
$env:MAESTRO_ADMIN_PASSWORD = "tu-password"
npm run test:mobile:admin
```

**Suite con lo que tengas:** alcanza con completar en `Maestro/.env.local` solo los pares que uses; `npm run test:mobile` omitirá el resto y listará en consola qué segmentos se saltaron.

```powershell
# Ejemplo: solo cliente en .env.local → test:mobile ejecuta únicamente el segmento cliente.
npm run test:mobile
```

Si querés forzar el YAML completo (tres segmentos encadenados en un solo Maestro):

```powershell
npm run test:mobile:full
```

### Ejemplo (bash)

```bash
export MAESTRO_CLIENT_EMAIL=cliente@ejemplo.com
export MAESTRO_CLIENT_PASSWORD=secreto
maestro test Maestro/flows/run-client.yaml
```

Maestro toma los parámetros `-e CLAVE=valor` como alternativa a variables de entorno del shell; los YAML usan `${MAESTRO_CLIENT_EMAIL}` etc.

## 5. Estructura de flows

- `Maestro/flows/suite-all.yaml` — orquestador: tres `runFlow` a `segments/*.yaml` con `stopApp` entre medias (un solo `maestro test` cuando corrés `test:mobile:full` o smart con las tres credenciales).
- `Maestro/flows/segments/suite-segment-*.yaml` — trozos reutilizables (cliente / org admin / plataforma) usados por el smart suite y por `suite-all`.
- `Maestro/flows/run-client.yaml` / `run-org-admin.yaml` / `run-admin.yaml` — entradas por rol (un rol por comando).
- `Maestro/flows/steps/*.yaml` — pasos reutilizables: `wait-welcome`, logins, `client-home-tabs-and-back`, `client-trabajo-hoy-smoke`, `org-admin-engine-room-smoke`, `superadmin-open-diagnostics`, `superadmin-hub-extended`, etc.

Los `testID` en la app (`welcome-cta-login-client`, `client-home-root`, `client-home-cta-trabajo-hoy`, `screen-trabajo-dia`, `trabajo-nav-back`, `admin-dashboard-root`, `staff-hub-tile-*`, `screen-admin-resumen`, `admin-resumen-nav-back`, `superadmin-hub-root`, `superadmin-hub-tile-*`, `admin-observability-root`, `admin-observability-nav-back`, `screen-superadmin-orgs`, …) están alineados con estos flows.

## 6. iOS vs Android

El mismo `appId` en los YAML suele bastar para ambos en proyectos Expo con bundle/package unificados. Si Maestro pide ajuste en iOS, consultá la documentación de Maestro para `bundleId` en flows separados por plataforma.

### Android: `welcome-global-content` no aparece

En RN Android a veces los `View` intermedios se **colapsan** y el `testID` no llega a la jerarquía de accesibilidad. El welcome global usa `collapsable={false}` en el bloque con `testID="welcome-global-content"`. Si igual falla: revisá capturas en la carpeta de artefactos de Maestro (p. ej. `~/.maestro/tests/<timestamp>/` en macOS/Linux o `.maestro\tests` bajo tu perfil de usuario en Windows); comprobá que el primer arranque pase **Splash** (~1,6 s) y llegue a `WelcomeGlobal` con red disponible.
