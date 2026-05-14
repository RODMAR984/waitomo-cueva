/**
 * Carga de entorno Maestro compartida por `maestro-run.cjs` y `--smart-suite`.
 */
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
  const files = [
    path.join(root, 'Maestro', '.env'),
    path.join(root, 'maestro', '.env'),
    path.join(root, 'Maestro', '.env.local'),
    path.join(root, 'maestro', '.env.local'),
  ];
  let out = {};
  for (const fp of files) {
    out = { ...out, ...parseEnvFile(fp) };
  }
  return out;
}

/** Archivo local + shell: las variables del proceso pisan el archivo. */
function getMaestroEnv() {
  return { ...loadMaestroEnvFromFiles(), ...process.env };
}

/**
 * @param {NodeJS.ProcessEnv} env
 * @returns {string}
 */
function resolveMaestroCli(env) {
  const explicit = env.MAESTRO_CLI && String(env.MAESTRO_CLI).trim();
  if (explicit && fs.existsSync(explicit)) return explicit;

  if (process.platform === 'win32') {
    const home = env.USERPROFILE || env.HOME || '';
    const candidates = [
      path.join(home, 'Downloads', 'maestro', 'bin', 'maestro.bat'),
      path.join(home, '.maestro', 'bin', 'maestro.bat'),
      'C:\\maestro\\bin\\maestro.bat',
    ];
    for (const c of candidates) {
      if (c && fs.existsSync(c)) return c;
    }
  }
  return 'maestro';
}

/**
 * @param {NodeJS.ProcessEnv} env
 * @param {string} emailKey
 * @param {string} passKey
 */
function hasCredentialPair(env, emailKey, passKey) {
  const e = String(env[emailKey] ?? '').trim();
  const p = String(env[passKey] ?? '').trim();
  return Boolean(e && p);
}

module.exports = {
  parseEnvFile,
  loadMaestroEnvFromFiles,
  getMaestroEnv,
  resolveMaestroCli,
  hasCredentialPair,
};
