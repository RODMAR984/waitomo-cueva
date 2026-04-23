const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function read(filePath) {
  return fs.readFileSync(path.join(root, filePath), 'utf8');
}

function assertIncludes(source, token, message) {
  if (!source.includes(token)) {
    throw new Error(message);
  }
}

function run() {
  const app = read('App.js');
  const login = read('screens/LoginScreen.js');
  const welcomeRouting = read('hooks/useWelcomeRouting.js');
  const guard = read('utils/authRoutingGuard.js');

  assertIncludes(app, '/* Entrada pública */', 'Falta grupo de rutas públicas en App.js');
  assertIncludes(app, '/* Cliente */', 'Falta grupo de rutas de cliente en App.js');
  assertIncludes(app, '/* Admin */', 'Falta grupo de rutas de admin en App.js');
  assertIncludes(app, '<Stack.Group>', 'App.js no está modularizado con Stack.Group');

  assertIncludes(guard, 'export function resolveStaffDestination', 'Falta resolveStaffDestination');
  assertIncludes(guard, 'export function resolvePostAuthDestination', 'Falta resolvePostAuthDestination');

  assertIncludes(
    login,
    "from '../utils/authRoutingGuard'",
    'LoginScreen no usa guard centralizado'
  );
  assertIncludes(
    welcomeRouting,
    "from '../utils/authRoutingGuard'",
    'useWelcomeRouting no usa guard centralizado'
  );

  // Rutas críticas que no pueden desaparecer.
  const criticalRoutes = [
    'WelcomeGlobal',
    'Login',
    'ClientTabs',
    'PlanSelector',
    'AdminLite',
    'Admin',
    'ConfiguraTuEspacio',
    'RegistroInicial',
  ];
  for (const route of criticalRoutes) {
    assertIncludes(app, `name="${route}"`, `Ruta crítica faltante: ${route}`);
  }

  console.log('smoke:routing OK');
}

try {
  run();
} catch (error) {
  console.error('smoke:routing FAIL');
  console.error(error.message || error);
  process.exit(1);
}
