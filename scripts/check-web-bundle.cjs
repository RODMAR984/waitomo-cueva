#!/usr/bin/env node
'use strict';

/**
 * Verifica tamaño del bundle principal web exportado por Expo.
 *
 * Uso:
 *   node scripts/check-web-bundle.cjs
 *
 * Variables opcionales:
 *   WEB_BUNDLE_WARN_MB=3.4
 *   WEB_BUNDLE_FAIL_MB=5.0
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const webJsDir = path.join(root, 'dist', '_expo', 'static', 'js', 'web');

const warnMb = Number(process.env.WEB_BUNDLE_WARN_MB || 3.4);
const failMb = Number(process.env.WEB_BUNDLE_FAIL_MB || 5.0);

function fail(msg) {
  console.error(`[bundle-check] ${msg}`);
  process.exit(1);
}

if (!fs.existsSync(webJsDir)) {
  fail('No existe dist/_expo/static/js/web. Ejecutá antes: npm run perf:web:export');
}

const files = fs
  .readdirSync(webJsDir)
  .filter((name) => /^index-.*\.js$/.test(name))
  .map((name) => path.join(webJsDir, name));

if (!files.length) fail('No se encontró bundle index-*.js en dist/_expo/static/js/web.');

const target = files
  .map((fullPath) => ({ fullPath, stat: fs.statSync(fullPath) }))
  .sort((a, b) => b.stat.size - a.stat.size)[0];

const bytes = target.stat.size;
const mb = bytes / (1024 * 1024);
const rel = path.relative(root, target.fullPath).replace(/\\/g, '/');

console.log(`[bundle-check] Bundle principal: ${rel}`);
console.log(`[bundle-check] Tamaño: ${mb.toFixed(2)} MB (${bytes} bytes)`);
console.log(`[bundle-check] Presupuesto: warn=${warnMb.toFixed(2)} MB, fail=${failMb.toFixed(2)} MB`);

if (mb >= failMb) {
  fail(`Excede presupuesto FAIL (${mb.toFixed(2)} MB >= ${failMb.toFixed(2)} MB).`);
}

if (mb >= warnMb) {
  console.warn(
    `[bundle-check] WARN: bundle alto (${mb.toFixed(2)} MB >= ${warnMb.toFixed(2)} MB), evaluar optimizaciones.`,
  );
} else {
  console.log('[bundle-check] OK: dentro del presupuesto.');
}

