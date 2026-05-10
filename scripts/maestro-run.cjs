#!/usr/bin/env node
/**
 * Ejecuta Maestro contra un flow YAML. Comprueba que el CLI esté en PATH.
 * Carga credenciales Maestro desde archivos locales (sin subir a git):
 *   maestro/.env  luego  maestro/.env.local  (este pisa al anterior)
 * Las variables de entorno del proceso / del shell tienen prioridad sobre los archivos.
 *
 * Uso: node scripts/maestro-run.cjs maestro/flows/run-client.yaml
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * @param {string} filePath
 * @returns {Record<string, string>}
 */
function parseEnvFile(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) return out;
  const text = fs.readFileSync(filePath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!key) continue;
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (val === '') continue;
    out[key] = val;
  }
  return out;
}

function loadMaestroEnvFromFiles() {
  const root = process.cwd();
  const a = parseEnvFile(path.join(root, 'maestro', '.env'));
  const b = parseEnvFile(path.join(root, 'maestro', '.env.local'));
  return { ...a, ...b };
}

const flowPath = process.argv[2];
if (!flowPath) {
  // eslint-disable-next-line no-console
  console.error(
    [
      'Uso: node scripts/maestro-run.cjs <ruta-al-flow.yaml>',
      'Ejemplo: node scripts/maestro-run.cjs maestro/flows/run-client.yaml',
      '',
      'Credenciales: copiá maestro/.env.example → maestro/.env.local y completá.',
      'Instalación del CLI Maestro: https://maestro.mobile.dev/getting-started/installing-maestro',
    ].join('\n'),
  );
  process.exit(1);
}

const abs = path.isAbsolute(flowPath) ? flowPath : path.join(process.cwd(), flowPath);
const fromFiles = loadMaestroEnvFromFiles();
/** Archivo local primero; variables ya definidas en el shell pisan el archivo. */
const env = { ...fromFiles, ...process.env };

const r = spawnSync('maestro', ['test', abs], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env,
});
if (r.error && (r.error.code === 'ENOENT' || r.error.errno === 'ENOENT')) {
  // eslint-disable-next-line no-console
  console.error(
    '\n[maestro] No se encontró el comando "maestro" en el PATH.\n' +
      'Instalá el CLI desde https://maestro.mobile.dev/getting-started/installing-maestro\n' +
      'y asegurate de que el binario esté en PATH antes de correr npm run test:mobile*\n',
  );
  process.exit(127);
}
process.exit(r.status != null ? r.status : 1);
