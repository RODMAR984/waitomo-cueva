const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function read(filePath) {
  return fs.readFileSync(path.join(root, filePath), 'utf8');
}

function assertIncludes(source, token, message) {
  if (!source.includes(token)) throw new Error(message);
}

function run() {
  const app = read('App.js');
  const stack = read('navigation/AppRootStack.js');
  const login = read('screens/auth/LoginScreen.js');
  const client = read('screens/client/ClientScreen.js');
  const admin = read('screens/admin/AdminScreen.js');
  const staffNav = read('hooks/useStaffAdminNavTiles.js');

  assertIncludes(app, 'runAppBootstrapOnce', 'App.js debe llamar bootstrap al inicio');
  assertIncludes(app, 'AppShellContent', 'App.js debe montar shell de navegación');
  assertIncludes(app, '<AuthProvider>', 'App.js debe envolver con AuthProvider');

  // Rutas críticas de flujo
  ['WelcomeGlobal', 'Login', 'PlanSelector', 'Calendario', 'TrabajoDelDia', 'AdminLite', 'AdminObservability'].forEach(
    (route) => {
      assertIncludes(stack, `name="${route}"`, `Falta ruta crítica: ${route}`);
    },
  );

  // Flujo auth
  assertIncludes(login, 'resolvePostAuthDestination', 'Login no usa guard central');
  assertIncludes(login, "trackEvent('auth_login_success'", 'Login no instrumenta auth_login_success');

  const authCtx = read('contexts/AuthContext.js');
  assertIncludes(authCtx, "trackEvent('auth_app_mode_changed'", 'AuthContext no instrumenta cambio de modo app');
  assertIncludes(authCtx, 'organization_id: membershipOrgIdForTrack', 'AuthContext no adjunta organization_id al evento de modo');

  const staffShell = read('navigation/staffScreenShell.js');
  assertIncludes(staffShell, 'StaffWebDesktopShell', 'Staff shell debe usar StaffWebDesktopShell');
  assertIncludes(staffShell, '<Component {...props} />', 'wrapStaffScreen debe renderizar la pantalla staff');
  if (staffShell.includes('StaffAdminNativePlaceholder') || staffShell.includes('staff_web_only_title')) {
    throw new Error('Staff shell no debe bloquear panel staff en nativo (placeholder web-only eliminado)');
  }

  // Flujo cliente
  assertIncludes(client, "trackEvent('client_open_calendario'", 'Client no instrumenta apertura de calendario');
  assertIncludes(client, "trackEvent('client_open_trabajo_hoy'", 'Client no instrumenta trabajo del día');

  // Flujo admin (ruta AdminObservability sigue en AppRootStack; el menú lateral usa tiles actuales)
  assertIncludes(
    staffNav,
    "navigation.navigate('AdminFinanzas'",
    'Nav staff no incluye enlace a finanzas',
  );

  console.log('smoke:flows OK');
}

try {
  run();
} catch (err) {
  console.error('smoke:flows FAIL');
  console.error(err.message || err);
  process.exit(1);
}
