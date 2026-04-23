#!/usr/bin/env node
'use strict';

/**
 * Si ENABLE_WEB_SW=1 o ENABLE_PWA=1: copia assets/web-sw.js → dist/sw.js (post export).
 * PWA instalable en Chrome/Android suele requerir un service worker registrado.
 */
const fs = require('fs');
const path = require('path');

if (process.env.ENABLE_WEB_SW !== '1' && process.env.ENABLE_PWA !== '1') {
  console.log('[web-sw] Omitido (ni ENABLE_WEB_SW ni ENABLE_PWA).');
  process.exit(0);
}

const root = path.join(__dirname, '..');
const src = path.join(root, 'assets', 'web-sw.js');
const dist = path.join(root, 'dist', 'sw.js');

if (!fs.existsSync(src)) {
  console.error('[web-sw] Falta assets/web-sw.js');
  process.exit(1);
}
if (!fs.existsSync(path.join(root, 'dist'))) {
  console.error('[web-sw] Falta dist/. Ejecutá expo export antes.');
  process.exit(1);
}

fs.copyFileSync(src, dist);
console.log('[web-sw] OK: dist/sw.js');
