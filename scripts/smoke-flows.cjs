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
  const login = read('screens/LoginScreen.js');
  const client = read('screens/ClientScreen.js');
  const admin = read('screens/AdminScreen.js');
  const staffNav = read('hooks/useStaffAdminNavTiles.js');

  // Rutas críticas de flujo
  ['WelcomeGlobal', 'Login', 'PlanSelector', 'Calendario', 'TrabajoDelDia', 'AdminLite', 'AdminObservability'].forEach(
    (route) => {
      assertIncludes(app, `name="${route}"`, `Falta ruta crítica: ${route}`);
    },
  );

  // Flujo auth
  assertIncludes(login, 'resolvePostAuthDestination', 'Login no usa guard central');
  assertIncludes(login, "trackEvent('auth_login_success'", 'Login no instrumenta auth_login_success');

  // Flujo cliente
  assertIncludes(client, "trackEvent('client_open_calendario'", 'Client no instrumenta apertura de calendario');
  assertIncludes(client, "trackEvent('client_open_trabajo_hoy'", 'Client no instrumenta trabajo del día');

  // Flujo admin
  assertIncludes(
    staffNav,
    "navigation.navigate('AdminObservability')",
    'Nav staff no incluye enlace a observabilidad',
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
