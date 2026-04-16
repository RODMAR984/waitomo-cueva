#!/usr/bin/env node
/**
 * Comprueba que `locales/translations.js` tenga las mismas claves en `es` y `en`.
 * Uso: node scripts/i18n-check.cjs
 * Salida: 0 si OK, 1 si faltan claves o hay error de parseo.
 *
 * Añadí en package.json: "i18n:check": "node scripts/i18n-check.cjs"
 */
'use strict';

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'locales', 'translations.js');

function extractInnerBracketContent(src, label) {
  const idx = src.indexOf(label);
  if (idx === -1) throw new Error(`No se encontró la etiqueta: ${label}`);
  const open = src.indexOf('{', idx);
  if (open === -1) throw new Error(`No hay { tras ${label}`);
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    const c = src[i];
    if (c === '{') depth += 1;
    else if (c === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(open + 1, i);
    }
  }
  throw new Error('Llaves desbalanceadas en translations.js');
}

function extractKeysFromBlock(block) {
  const keys = new Set();
  const lines = block.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('//')) continue;
    const m = line.match(/^\s{4}([a-zA-Z0-9_]+)\s*:/);
    if (m) keys.add(m[1]);
  }
  return keys;
}

function main() {
  let text;
  try {
    text = fs.readFileSync(FILE, 'utf8');
  } catch (e) {
    console.error('i18n-check: no se pudo leer', FILE, e.message);
    process.exit(1);
  }

  let esInner;
  let enInner;
  try {
    esInner = extractInnerBracketContent(text, '  es: {');
    enInner = extractInnerBracketContent(text, '  en: {');
  } catch (e) {
    console.error('i18n-check:', e.message);
    process.exit(1);
  }

  const esKeys = extractKeysFromBlock(esInner);
  const enKeys = extractKeysFromBlock(enInner);

  const missingInEn = [...esKeys].filter((k) => !enKeys.has(k)).sort();
  const missingInEs = [...enKeys].filter((k) => !esKeys.has(k)).sort();

  if (missingInEn.length || missingInEs.length) {
    console.error('i18n-check: claves desalineadas entre es y en.\n');
    if (missingInEn.length) {
      console.error('  Faltan en inglés (en):');
      missingInEn.forEach((k) => console.error(`    - ${k}`));
    }
    if (missingInEs.length) {
      console.error('  Faltan en español (es):');
      missingInEs.forEach((k) => console.error(`    - ${k}`));
    }
    console.error(`\n  Total es: ${esKeys.size}, en: ${enKeys.size}`);
    process.exit(1);
  }

  console.log(`i18n-check: OK (${esKeys.size} claves en es y en).`);
  process.exit(0);
}

main();
