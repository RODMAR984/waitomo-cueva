#!/usr/bin/env node
/**
 * Comprobaciones rápidas antes de QA / piloto / release.
 * Uso: node scripts/preflight.cjs  →  salida 0 si todo OK.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');

function fail(msg) {
  console.error(`[preflight] ${msg}`);
  process.exit(1);
}

const requiredLegal = [
  'content/legal/privacy.es.js',
  'content/legal/privacy.en.js',
  'content/legal/terms.es.js',
  'content/legal/terms.en.js',
  'content/legal/index.js',
];

for (const rel of requiredLegal) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) fail(`Falta archivo: ${rel}`);
}

const appJsonPath = path.join(root, 'app.json');
if (!fs.existsSync(appJsonPath)) fail('Falta app.json');
let app;
try {
  app = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
} catch (e) {
  fail(`app.json no es JSON válido: ${e.message}`);
}
const ver = app?.expo?.version;
if (!ver || String(ver).trim() === '') fail('app.json → expo.version vacío');
const email = app?.expo?.extra?.fitengineSupportEmail;
if (email == null || String(email).trim() === '') fail('app.json → expo.extra.fitengineSupportEmail vacío');

const i18n = spawnSync(process.execPath, [path.join(root, 'scripts', 'i18n-check.cjs')], {
  cwd: root,
  stdio: 'inherit',
});
if (i18n.status !== 0) fail('i18n:check falló');

console.log(`[preflight] OK — app v${ver}, legal + i18n listos.`);
