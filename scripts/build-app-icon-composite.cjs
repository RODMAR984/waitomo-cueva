#!/usr/bin/env node
/**
 * favicon.png suele ir sin fondo → en el cajón de apps se ve mal.
 * Genera assets/app-icon-composite.png: 1024×1024, fondo negro, logo centrado (fit "inside").
 *
 * Requisito: npm i -D sharp
 * Uso: npm run icons:build
 * Tras cambiar favicon.png, volvé a correr esto y commiteá el PNG generado.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const srcPath = path.join(root, 'assets', 'favicon.png');
const outPath = path.join(root, 'assets', 'app-icon-composite.png');

const SIZE = 1024;
/** Margen alrededor del dibujo (0.12 = ~76% del lado útil, típico “safe” para máscaras). */
const MARGIN_FRAC = 0.12;
const BG = { r: 0, g: 0, b: 0, alpha: 1 }; // negro sólido (transparencias del logo no “flotan”)

async function main() {
  let sharp;
  try {
    sharp = require('sharp');
  } catch {
    console.error('[icons:build] Falta sharp. Ejecutá: npm i -D sharp');
    process.exit(1);
  }

  if (!fs.existsSync(srcPath)) {
    console.error('[icons:build] No existe:', path.relative(root, srcPath));
    process.exit(1);
  }

  const inner = Math.round(SIZE * (1 - 2 * MARGIN_FRAC));
  const logoBuf = await sharp(srcPath)
    .resize(inner, inner, { fit: 'inside', withoutEnlargement: false })
    .ensureAlpha()
    .toBuffer();

  await sharp({
    create: {
      width: SIZE,
      height: SIZE,
      channels: 4,
      background: BG,
    },
  })
    .composite([{ input: logoBuf, gravity: 'center' }])
    .png()
    .toFile(outPath);

  console.log('[icons:build] OK →', path.relative(root, outPath));
}

main().catch((e) => {
  console.error('[icons:build]', e?.message || e);
  process.exit(1);
});
