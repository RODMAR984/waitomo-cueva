#!/usr/bin/env node
/**
 * Tras `expo export --platform web`: copia el icono de app y enriquece dist/index.html
 * (favicon / apple-touch / theme-color / manifest).
 *
 * - Por defecto: manifest `display: "browser"` (web en pestaña, no “instalar app”).
 * - `ENABLE_PWA=1`: manifest `standalone` + metas Apple + registro de SW (copiado con copy-web-sw).
 * - `ENABLE_WEB_SW=1` sin PWA: solo SW + manifest sigue en `browser`.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
const indexPath = path.join(dist, 'index.html');
const iconCandidates = [
  path.join(root, 'assets', 'app-icon-composite.png'),
  path.join(root, 'assets', 'favicon.png'),
  path.join(root, 'assets', 'icon.png'),
];
const iconSrc = iconCandidates.find((p) => fs.existsSync(p));
const webIconName = 'web-app-icon.png';
const manifestName = 'site.webmanifest';

const isPwa = process.env.ENABLE_PWA === '1';
const wantsServiceWorker = process.env.ENABLE_WEB_SW === '1' || isPwa;

const THEME_COLOR = '#021b23';
const BG_COLOR = '#021b23';

function fail(msg) {
  console.error(`[web-branding] ${msg}`);
  process.exit(1);
}

if (!fs.existsSync(dist)) fail('No existe dist/. Ejecutá antes: npx expo export --platform web');
if (!fs.existsSync(indexPath)) fail('No existe dist/index.html');
if (!iconSrc) fail(`No existe assets/app-icon-composite.png (ej. npm run icons:build) ni favicon/icon`);

fs.copyFileSync(iconSrc, path.join(dist, webIconName));
// Expo export escribe /favicon.ico (plantilla ≈ “cubo”) y el HTML lo enlaza ANTES que nuestros <link> PNG; Chrome usa ese primero.
// Misma imagen que app móvil; muchos navegadores aceptan PNG en esta ruta.
const faviconDest = path.join(dist, 'favicon.ico');
fs.copyFileSync(iconSrc, faviconDest);

const manifest = {
  name: 'FitEngine',
  short_name: 'FitEngine',
  description: 'FitEngine — operación gimnasio',
  start_url: '/',
  display: isPwa ? 'standalone' : 'browser',
  background_color: BG_COLOR,
  theme_color: THEME_COLOR,
  ...(isPwa
    ? {
        scope: '/',
        id: '/',
        orientation: 'portrait',
        categories: ['health', 'fitness', 'lifestyle'],
      }
    : {}),
  icons: [
    {
      src: `/${webIconName}`,
      sizes: '192x192',
      type: 'image/png',
      purpose: 'any',
    },
    {
      src: `/${webIconName}`,
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any',
    },
    ...(isPwa
      ? [
          {
            src: `/${webIconName}`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ]
      : []),
  ],
};

fs.writeFileSync(path.join(dist, manifestName), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

const pwaMeta = isPwa
  ? `
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-title" content="FitEngine" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="mobile-web-app-capable" content="yes" />`
  : '';

const injectBlock = `
    <!-- FitEngine web branding (scripts/inject-web-branding.cjs) -->
    <meta name="theme-color" content="${THEME_COLOR}" media="(prefers-color-scheme: dark)" />
    <meta name="theme-color" content="#0b3d4a" media="(prefers-color-scheme: light)" />
    <link rel="manifest" href="/${manifestName}" />
    <link rel="apple-touch-icon" href="/${webIconName}" />
    <link rel="apple-touch-icon" sizes="180x180" href="/${webIconName}" />
    <link rel="icon" type="image/png" sizes="32x32" href="/${webIconName}" />
    <link rel="icon" type="image/png" sizes="512x512" href="/${webIconName}" />${pwaMeta}
`;

let html = fs.readFileSync(indexPath, 'utf8');
if (html.includes('web-branding')) {
  fs.copyFileSync(iconSrc, faviconDest);
  console.log('[web-branding] Ya inyectado; favicon.ico actualizado.');
  process.exit(0);
}

if (html.includes('</head>')) {
  html = html.replace('</head>', `${injectBlock}  </head>`);
} else {
  fail('dist/index.html sin </head>');
}

if (wantsServiceWorker) {
  const swDist = path.join(dist, 'sw.js');
  if (!fs.existsSync(swDist)) {
    fail(
      'SW requerido pero falta dist/sw.js. Encadená: node scripts/copy-web-sw-optional.cjs antes de inject (ENABLE_WEB_SW o ENABLE_PWA).',
    );
  }
  if (!html.includes('serviceWorker.register')) {
    const swBlock = `    <script>if('serviceWorker'in navigator){navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(function(){})}</script>\n`;
    if (html.includes('</body>')) {
      html = html.replace('</body>', `${swBlock}</body>`);
    } else {
      fail('dist/index.html sin </body> (SW)');
    }
  }
}

fs.writeFileSync(indexPath, html, 'utf8');
const flags = [isPwa && 'PWA', wantsServiceWorker && 'SW'].filter(Boolean).join(', ');
console.log(
  `[web-branding] OK: ${webIconName}, ${manifestName}, meta en index.html${flags ? ` (${flags})` : ''}`,
);
