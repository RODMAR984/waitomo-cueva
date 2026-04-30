/**
 * Expo CLI: peticiones sin ?platform= ni header expo-platform.
 * Chrome/Edge en Windows no matchea resolvePlatformFromUserAgentHeader (solo Android/iOS)
 * y assertMissingRuntimePlatform tira CommandError.
 * Default "web" para esas páginas HTML (solo ayuda a exploradores / herramientas; Expo Go sigue mandando platform).
 */
const fs = require('fs');
const path = require('path');

const MARKER = '/*patched-expo-interstitial-default-web*/';
const REDIRECT_MARKER = '/*patched-expo-runtime-redirect-fallback*/';

const needle =
  '        const platform = (0, _resolvePlatform.parsePlatformHeader)(req) ?? (0, _resolvePlatform.resolvePlatformFromUserAgentHeader)(req);\n        (0, _resolvePlatform.assertMissingRuntimePlatform)(platform);';
const replacement = `        ${MARKER}
        let platform = (0, _resolvePlatform.parsePlatformHeader)(req) ?? (0, _resolvePlatform.resolvePlatformFromUserAgentHeader)(req);
        if (!platform) {
            platform = 'web';
        }`;

const redirectNeedle =
  `        const redirect = this.options.getLocation({\n            runtime\n        });\n        if (!redirect) {`;
const redirectReplacement =
  `        let redirect = this.options.getLocation({\n            runtime\n        });\n        ${REDIRECT_MARKER}\n        if (!redirect && runtime === 'custom' && platform === 'web') {\n            redirect = this.options.getLocation({ runtime: 'expo' });\n        }\n        if (!redirect) {`;

const files = [
  'node_modules/expo/node_modules/@expo/cli/build/src/start/server/middleware/InterstitialPageMiddleware.js',
  'node_modules/@expo/cli/build/src/start/server/middleware/InterstitialPageMiddleware.js',
  'node_modules/expo/node_modules/@expo/cli/build/src/start/server/middleware/RuntimeRedirectMiddleware.js',
  'node_modules/@expo/cli/build/src/start/server/middleware/RuntimeRedirectMiddleware.js',
];

const root = path.join(__dirname, '..');
let patched = 0;

for (const rel of files) {
  const target = path.join(root, rel);
  if (!fs.existsSync(target)) continue;
  let s = fs.readFileSync(target, 'utf8');
  let touched = false;
  if (!s.includes(MARKER)) {
    if (s.includes(needle)) {
      s = s.replace(needle, replacement);
      touched = true;
    } else {
      console.warn('[patch-expo-interstitial] Patrón platform no encontrado; omito.', rel);
    }
  }
  if (rel.includes('RuntimeRedirectMiddleware') && !s.includes(REDIRECT_MARKER)) {
    if (s.includes(redirectNeedle)) {
      s = s.replace(redirectNeedle, redirectReplacement);
      touched = true;
    } else {
      console.warn('[patch-expo-interstitial] Patrón redirect no encontrado; omito.', rel);
    }
  }
  if (touched) {
    fs.writeFileSync(target, s, 'utf8');
    console.log('[patch-expo-interstitial] OK:', rel);
    patched++;
  }
}

if (patched === 0) {
  console.log('[patch-expo-interstitial] Nada que parchear (ya aplicado o @expo/cli no presente).');
}
