#!/usr/bin/env node
/**
 * Tras `expo export --platform web`: copia el icono de app y enriquece dist/index.html
 * (favicon / apple-touch / theme-color / manifest) sin forzar PWA instalable:
 * manifest con display "browser" = sigue siendo web en pestaña, con buen icono en marcadores.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
const indexPath = path.join(dist, 'index.html');
const iconSrc = path.join(root, 'assets', 'icon.png');
const webIconName = 'web-app-icon.png';
const manifestName = 'site.webmanifest';

const THEME_COLOR = '#021b23';
const BG_COLOR = '#021b23';

function fail(msg) {
  console.error(`[web-branding] ${msg}`);
  process.exit(1);
}

if (!fs.existsSync(dist)) fail('No existe dist/. Ejecutá antes: npx expo export --platform web');
if (!fs.existsSync(indexPath)) fail('No existe dist/index.html');
if (!fs.existsSync(iconSrc)) fail(`No existe ${path.relative(root, iconSrc)}`);

fs.copyFileSync(iconSrc, path.join(dist, webIconName));

const manifest = {
  name: 'FitEngine',
  short_name: 'FitEngine',
  description: 'FitEngine — operación gimnasio',
  start_url: '/',
  display: 'browser',
  background_color: BG_COLOR,
  theme_color: THEME_COLOR,
  icons: [
    {
      src: `/${webIconName}`,
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any',
    },
  ],
};

fs.writeFileSync(path.join(dist, manifestName), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

const injectBlock = `
    <!-- FitEngine web branding (scripts/inject-web-branding.cjs) -->
    <meta name="theme-color" content="${THEME_COLOR}" media="(prefers-color-scheme: dark)" />
    <meta name="theme-color" content="#0b3d4a" media="(prefers-color-scheme: light)" />
    <link rel="manifest" href="/${manifestName}" />
    <link rel="apple-touch-icon" href="/${webIconName}" />
    <link rel="icon" type="image/png" sizes="512x512" href="/${webIconName}" />
`;

let html = fs.readFileSync(indexPath, 'utf8');
if (html.includes('web-branding')) {
  console.log('[web-branding] Ya inyectado, omitiendo.');
  process.exit(0);
}

if (html.includes('</head>')) {
  html = html.replace('</head>', `${injectBlock}  </head>`);
} else {
  fail('dist/index.html sin </head>');
}

fs.writeFileSync(indexPath, html, 'utf8');
console.log(`[web-branding] OK: ${webIconName}, ${manifestName}, meta en index.html`);
