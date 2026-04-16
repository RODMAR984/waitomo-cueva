#!/usr/bin/env node
/**
 * Lista posibles cadenas sin i18n: Alert.alert('...'), placeholder="...", <Text>texto plano.
 * No es perfecto; sirve para barridos manuales. Uso: node scripts/i18n-scan-literals.cjs
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIRS = ['screens', 'components'];

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (name.endsWith('.js')) acc.push(p);
  }
  return acc;
}

const alertRe = /Alert\.alert\s*\(\s*['"]([^'"]+)['"]/g;
const phRe = /placeholder\s*=\s*['"]([^'"]+)['"]/g;

function scanFile(file) {
  const rel = path.relative(ROOT, file);
  const text = fs.readFileSync(file, 'utf8');
  const hits = [];
  let m;
  while ((m = alertRe.exec(text))) {
    if (!m[1].includes('${') && m[1].length > 2) hits.push({ kind: 'Alert', msg: m[1], file: rel });
  }
  while ((m = phRe.exec(text))) {
    if (!m[1].startsWith('#') && m[1].length > 3) hits.push({ kind: 'placeholder', msg: m[1].slice(0, 60), file: rel });
  }
  return hits;
}

function main() {
  const files = DIRS.flatMap((d) => walk(path.join(ROOT, d)));
  const all = [];
  for (const f of files) {
    all.push(...scanFile(f));
  }
  const byFile = {};
  for (const h of all) {
    if (!byFile[h.file]) byFile[h.file] = [];
    byFile[h.file].push(h);
  }
  const sorted = Object.keys(byFile).sort();
  if (sorted.length === 0) {
    console.log('i18n-scan: sin coincidencias (o carpetas vacías).');
    return;
  }
  console.log('i18n-scan: posibles literales (revisar manualmente):\n');
  for (const file of sorted) {
    console.log(file);
    for (const h of byFile[file]) {
      console.log(`  [${h.kind}] ${h.msg}`);
    }
    console.log('');
  }
}

main();
