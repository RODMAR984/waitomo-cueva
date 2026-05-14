#!/usr/bin/env node
/**
 * Exporta web y corre Playwright usando credenciales Maestro si faltan E2E_* en el entorno.
 * Mapeo: MAESTRO_CLIENT_* → E2E_CLIENT_*; MAESTRO_ORG_ADMIN_* → E2E_ORG_ADMIN_*;
 *        MAESTRO_ADMIN_* → E2E_PLATFORM_ADMIN_* (plataforma / superadmin).
 *
 * Uso: node scripts/playwright-e2e-from-maestro.cjs journey
 */
const { spawnSync } = require('child_process');
const path = require('path');
const { getMaestroEnv } = require('./maestro-env.cjs');

const root = process.cwd();
const mode = (process.argv[2] || 'journey').trim();

function mergeE2EFromMaestro() {
  const base = getMaestroEnv();
  const o = { ...process.env };
  const fill = (e2eKey, maestroKey) => {
    const cur = o[e2eKey] && String(o[e2eKey]).trim();
    const m = base[maestroKey] && String(base[maestroKey]).trim();
    if (!cur && m) o[e2eKey] = m;
  };
  fill('E2E_CLIENT_EMAIL', 'MAESTRO_CLIENT_EMAIL');
  fill('E2E_CLIENT_PASSWORD', 'MAESTRO_CLIENT_PASSWORD');
  fill('E2E_ORG_ADMIN_EMAIL', 'MAESTRO_ORG_ADMIN_EMAIL');
  fill('E2E_ORG_ADMIN_PASSWORD', 'MAESTRO_ORG_ADMIN_PASSWORD');
  fill('E2E_PLATFORM_ADMIN_EMAIL', 'MAESTRO_ADMIN_EMAIL');
  fill('E2E_PLATFORM_ADMIN_PASSWORD', 'MAESTRO_ADMIN_PASSWORD');
  return o;
}

const env = mergeE2EFromMaestro();

if (mode !== 'journey' && mode !== 'journey-headed') {
  // eslint-disable-next-line no-console
  console.error('Uso: node scripts/playwright-e2e-from-maestro.cjs journey|journey-headed');
  process.exit(1);
}

const e1 = spawnSync('npm', ['run', 'perf:web:export'], { stdio: 'inherit', shell: true, env, cwd: root });
if (e1.status !== 0) process.exit(e1.status != null ? e1.status : 1);

const pwArgs = ['playwright', 'test', 'tests/e2e/web/full-web-journey.spec.js'];
if (mode === 'journey-headed') pwArgs.push('--headed');

const e2 = spawnSync('npx', pwArgs, { stdio: 'inherit', shell: true, env, cwd: root });
process.exit(e2.status != null ? e2.status : 1);
