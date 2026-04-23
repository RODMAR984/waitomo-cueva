#!/usr/bin/env node
'use strict';

/**
 * Mismo pipeline que `perf:web:export` pero con ENABLE_PWA=1 (manifest standalone + SW).
 * Uso: `npm run perf:web:export:pwa`
 */
const { spawnSync } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');
const env = { ...process.env, ENABLE_PWA: '1' };
const cmd =
  'npx expo export --platform web && node scripts/copy-web-sw-optional.cjs && node scripts/inject-web-branding.cjs';
const r = spawnSync(cmd, { cwd: root, env, stdio: 'inherit', shell: true });
process.exit(r.status === null ? 1 : r.status);
