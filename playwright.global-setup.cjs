/**
 * Asegura que `dist/` refleje el código actual antes de E2E web.
 * Evita fallos cuando alguien corre `npx playwright test` sin haber hecho `npm run perf:web:export`.
 */
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;

function mtimeMs(filePath) {
  try {
    return fs.statSync(filePath).mtimeMs;
  } catch {
    return 0;
  }
}

module.exports = async function globalSetup() {
  if (process.env.PLAYWRIGHT_SKIP_EXPORT === '1') {
    return;
  }

  const distIndex = path.join(root, 'dist', 'index.html');
  const distM = mtimeMs(distIndex);

  const watchFiles = [
    path.join(root, 'App.js'),
    path.join(root, 'bootstrap', 'runOnce.js'),
    path.join(root, 'navigation', 'AppShellContent.js'),
    path.join(root, 'navigation', 'AppRootStack.js'),
    path.join(root, 'components', 'AuthGate.js'),
    path.join(root, 'components', 'BackNavButton.js'),
    path.join(root, 'screens', 'auth', 'WelcomeGlobalScreen.js'),
    path.join(root, 'contexts', 'LocaleContext.js'),
    path.join(root, 'screens', 'client', 'PublicDirectoryScreen.js'),
    path.join(root, 'screens', 'admin', 'AdminScreen.js'),
    path.join(root, 'package.json'),
  ];
  const maxSrc = Math.max(0, ...watchFiles.map(mtimeMs));

  if (distM >= maxSrc && distM > 0) {
    return;
  }

  // eslint-disable-next-line no-console
  console.log('[playwright globalSetup] dist desactualizado o ausente → npm run perf:web:export');
  execSync('npm run perf:web:export', { stdio: 'inherit', cwd: root });
};
