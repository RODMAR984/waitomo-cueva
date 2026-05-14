#!/usr/bin/env node
/**
 * Ejecuta Maestro contra un flow YAML. Comprueba que el CLI esté en PATH.
 * Carga credenciales Maestro desde archivos locales (sin subir a git):
 *   Maestro/.env  luego  Maestro/.env.local  (este pisa al anterior)
 * Las variables de entorno del proceso / del shell tienen prioridad sobre los archivos.
 *
 * Uso:
 *   node scripts/maestro-run.cjs Maestro/flows/run-client.yaml
 *   node scripts/maestro-run.cjs --smart-suite
 *
 * `--smart-suite` ejecuta solo los segmentos (cliente / org admin / plataforma) para los que
 * exista un par email+password en el entorno; no hace falta tener las tres cuentas.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const {
  getMaestroEnv,
  resolveMaestroCli,
  hasCredentialPair,
} = require('./maestro-env.cjs');

const SEGMENTS = [
  {
    label: 'Cliente',
    relPath: 'Maestro/flows/segments/suite-segment-client.yaml',
    hasCreds: (e) => hasCredentialPair(e, 'MAESTRO_CLIENT_EMAIL', 'MAESTRO_CLIENT_PASSWORD'),
  },
  {
    label: 'Admin de organización',
    relPath: 'Maestro/flows/segments/suite-segment-org-admin.yaml',
    hasCreds: (e) => hasCredentialPair(e, 'MAESTRO_ORG_ADMIN_EMAIL', 'MAESTRO_ORG_ADMIN_PASSWORD'),
  },
  {
    label: 'Plataforma (superadmin)',
    relPath: 'Maestro/flows/segments/suite-segment-platform.yaml',
    hasCreds: (e) => hasCredentialPair(e, 'MAESTRO_ADMIN_EMAIL', 'MAESTRO_ADMIN_PASSWORD'),
  },
];

function printMaestroNotFound(maestroCli, winNotFound) {
  if (winNotFound && maestroCli === 'maestro') {
    // eslint-disable-next-line no-console
    console.error(
      '\n[maestro] Windows no encontró "maestro" en el PATH de esta terminal.\n' +
        'Solución rápida: variable de entorno MAESTRO_CLI=C:\\ruta\\a\\maestro\\bin\\maestro.bat\n' +
        'O reiniciá Cursor/IDE después de agregar Maestro al PATH del usuario.\n',
    );
    return;
  }
  // eslint-disable-next-line no-console
  console.error(
    '\n[maestro] No se encontró el comando "maestro" en el PATH.\n' +
      'Instalá el CLI desde https://maestro.mobile.dev/getting-started/installing-maestro\n' +
      'o definí MAESTRO_CLI con la ruta a maestro.bat (Windows), y reiniciá la terminal.\n',
  );
}

function runMaestroTest(maestroCli, absFlowPath, env) {
  return spawnSync(maestroCli, ['test', absFlowPath], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env,
  });
}

function exitCodeFromSpawn(r) {
  if (r.status != null) return r.status;
  return 1;
}

const flowArg = process.argv[2];
if (!flowArg) {
  // eslint-disable-next-line no-console
  console.error(
    [
      'Uso: node scripts/maestro-run.cjs <ruta-al-flow.yaml>',
      '       node scripts/maestro-run.cjs --smart-suite',
      'Ejemplo: node scripts/maestro-run.cjs Maestro/flows/run-client.yaml',
      '',
      '--smart-suite: solo segmentos con MAESTRO_*_EMAIL + password definidos (ver Maestro/README.md).',
      'Credenciales: copiá Maestro/.env.example → Maestro/.env.local y completá.',
      'Instalación del CLI Maestro: https://maestro.mobile.dev/getting-started/installing-maestro',
    ].join('\n'),
  );
  process.exit(1);
}

const fromFilesAndShell = getMaestroEnv();
const env = fromFilesAndShell;
const maestroCli = resolveMaestroCli(env);

if (flowArg === '--smart-suite') {
  const allHave = SEGMENTS.every((s) => s.hasCreds(env));
  const toRun = SEGMENTS.filter((s) => s.hasCreds(env));
  if (toRun.length === 0) {
    // eslint-disable-next-line no-console
    console.error(
      [
        '[maestro] --smart-suite: no hay ningún par email+password Maestro completo.',
        'Definí al menos uno de:',
        '  MAESTRO_CLIENT_EMAIL + MAESTRO_CLIENT_PASSWORD',
        '  MAESTRO_ORG_ADMIN_EMAIL + MAESTRO_ORG_ADMIN_PASSWORD',
        '  MAESTRO_ADMIN_EMAIL + MAESTRO_ADMIN_PASSWORD',
        '',
        'Archivo recomendado: Maestro/.env.local (copiá desde Maestro/.env.example).',
      ].join('\n'),
    );
    process.exit(1);
  }

  const root = process.cwd();

  if (allHave) {
    // eslint-disable-next-line no-console
    console.log('[maestro] --smart-suite: las tres credenciales → un solo Maestro (suite-all.yaml)\n');
    const abs = path.join(root, 'Maestro/flows/suite-all.yaml');
    if (!fs.existsSync(abs)) {
      // eslint-disable-next-line no-console
      console.error(`[maestro] No existe: ${abs}`);
      process.exit(1);
    }
    const r = runMaestroTest(maestroCli, abs, env);
    const winNotFound =
      process.platform === 'win32' &&
      (r.status === 9009 ||
        (typeof r.stderr === 'string' && r.stderr.toLowerCase().includes('no se reconoce')));
    if (r.error && (r.error.code === 'ENOENT' || r.error.errno === 'ENOENT')) {
      printMaestroNotFound(maestroCli, winNotFound);
      process.exit(127);
    }
    if (winNotFound && maestroCli === 'maestro') {
      printMaestroNotFound(maestroCli, winNotFound);
      process.exit(127);
    }
    process.exit(exitCodeFromSpawn(r));
  }

  const skipped = SEGMENTS.filter((s) => !s.hasCreds(env)).map((s) => s.label);
  if (skipped.length) {
    // eslint-disable-next-line no-console
    console.log(`[maestro] Sin credenciales — se omite: ${skipped.join(', ')}`);
  }
  // eslint-disable-next-line no-console
  console.log(`[maestro] --smart-suite: ${toRun.map((s) => s.label).join(' → ')}\n`);

  for (let i = 0; i < toRun.length; i += 1) {
    const seg = toRun[i];
    const abs = path.join(root, seg.relPath);
    if (!fs.existsSync(abs)) {
      // eslint-disable-next-line no-console
      console.error(`[maestro] No existe el flow: ${abs}`);
      process.exit(1);
    }
    // eslint-disable-next-line no-console
    console.log(`[maestro] ▶ ${seg.label} (${seg.relPath})\n`);
    const r = runMaestroTest(maestroCli, abs, env);
    const winNotFound =
      process.platform === 'win32' &&
      (r.status === 9009 ||
        (typeof r.stderr === 'string' && r.stderr.toLowerCase().includes('no se reconoce')));
    if (r.error && (r.error.code === 'ENOENT' || r.error.errno === 'ENOENT')) {
      printMaestroNotFound(maestroCli, winNotFound);
      process.exit(127);
    }
    if (winNotFound && maestroCli === 'maestro') {
      printMaestroNotFound(maestroCli, winNotFound);
      process.exit(127);
    }
    if (r.status !== 0) {
      process.exit(exitCodeFromSpawn(r));
    }
  }
  // eslint-disable-next-line no-console
  console.log('\n[maestro] Smart suite OK.\n');
  process.exit(0);
}

const abs = path.isAbsolute(flowArg) ? flowArg : path.join(process.cwd(), flowArg);
const r = runMaestroTest(maestroCli, abs, env);
const winNotFound =
  process.platform === 'win32' &&
  (r.status === 9009 ||
    (typeof r.stderr === 'string' && r.stderr.toLowerCase().includes('no se reconoce')));
if (r.error && (r.error.code === 'ENOENT' || r.error.errno === 'ENOENT')) {
  printMaestroNotFound(maestroCli, winNotFound);
  process.exit(127);
}
if (winNotFound && maestroCli === 'maestro') {
  printMaestroNotFound(maestroCli, winNotFound);
  process.exit(127);
}
process.exit(exitCodeFromSpawn(r));
