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

Maestro no levanta Metro: necesitás la app **ya instalada** con el mismo id que en `app.json`:

- **Android:** `applicationId` → `com.waitomofitengine.cueva`
- **iOS:** `bundleIdentifier` → `com.waitomofitengine.cueva`

Flujo típico de desarrollo:

1. Emulador Android o simulador iOS encendido (o teléfono por USB con depuración).
2. Desde la raíz del repo: `npx expo run:android` o `npx expo run:ios` (o un build EAS instalado en el dispositivo).

## 3. Variables de entorno (credenciales)

| Variable | Uso |
|----------|-----|
| `MAESTRO_CLIENT_EMAIL` | Cuenta cliente para login |
| `MAESTRO_CLIENT_PASSWORD` | Contraseña cliente |
| `MAESTRO_ADMIN_EMAIL` | Cuenta **superadmin** (login pantalla Admin) |
| `MAESTRO_ADMIN_PASSWORD` | Contraseña superadmin |

Sin credenciales, los flows que hacen login fallarán de forma esperada.

## 4. Comandos npm

| Script | Qué ejecuta |
|--------|-------------|
| `npm run test:mobile` | Suite amplia: smoke login atrás, flujo cliente completo, reinicio de app, smoke admin atrás + login al panel |
| `npm run test:mobile:client` | Solo cliente: welcome → login → home → calendario/directorio/perfil y botones atrás |
| `npm run test:mobile:admin` | Solo superadmin: welcome → deep link `waitomo://admin` → login → panel |

Por debajo se usa `node scripts/maestro-run.cjs <flow.yaml>` para invocar `maestro test` y mostrar un error claro si el CLI no está en PATH.

### Ejemplos (PowerShell en Windows)

```powershell
cd c:\Users\marla\waitomo-cueva
$env:MAESTRO_CLIENT_EMAIL = "cliente@ejemplo.com"
$env:MAESTRO_CLIENT_PASSWORD = "tu-password"
npm run test:mobile:client
```

```powershell
$env:MAESTRO_ADMIN_EMAIL = "admin@ejemplo.com"
$env:MAESTRO_ADMIN_PASSWORD = "tu-password"
npm run test:mobile:admin
```

Suite completa (necesita **ambas** parejas de variables por el reinicio entre cliente y admin):

```powershell
$env:MAESTRO_CLIENT_EMAIL = "..."
$env:MAESTRO_CLIENT_PASSWORD = "..."
$env:MAESTRO_ADMIN_EMAIL = "..."
$env:MAESTRO_ADMIN_PASSWORD = "..."
npm run test:mobile
```

### Ejemplo (bash)

```bash
export MAESTRO_CLIENT_EMAIL=cliente@ejemplo.com
export MAESTRO_CLIENT_PASSWORD=secreto
maestro test maestro/flows/run-client.yaml
```

Maestro toma los parámetros `-e CLAVE=valor` como alternativa a variables de entorno del shell; los YAML usan `${MAESTRO_CLIENT_EMAIL}` etc.

## 5. Estructura de flows

- `maestro/flows/suite-all.yaml` — orquestador principal.
- `maestro/flows/run-client.yaml` / `run-admin.yaml` — entradas por rol.
- `maestro/flows/steps/*.yaml` — pasos reutilizables (`wait-welcome`, login, navegación, atrás).

Los `testID` en la app (`welcome-cta-login-client`, `client-home-root`, `admin-dashboard-root`, …) están alineados con estos flows.

## 6. iOS vs Android

El mismo `appId` en los YAML suele bastar para ambos en proyectos Expo con bundle/package unificados. Si Maestro pide ajuste en iOS, consultá la documentación de Maestro para `bundleId` en flows separados por plataforma.
