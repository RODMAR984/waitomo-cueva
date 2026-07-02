#!/usr/bin/env node
/**
 * Termina la config de emails FitEngine (Resend + hook Auth).
 *
 * Uso (PowerShell, en la raíz del repo):
 *   node scripts/setup-fitengine-email.cjs re_TU_CLAVE_DE_RESEND
 *
 * O con variable de entorno:
 *   $env:RESEND_API_KEY='re_...'
 *   node scripts/setup-fitengine-email.cjs
 *
 * Opcional (para activar el hook sin dashboard):
 *   $env:SUPABASE_ACCESS_TOKEN='sbp_...'   # Account → Access Tokens en supabase.com
 */
'use strict';

const { execSync } = require('child_process');
const crypto = require('crypto');

const PROJECT_REF = 'nfjjkvjsssgxxsuocmhj';
const HOOK_URL = `https://${PROJECT_REF}.supabase.co/functions/v1/auth-send-email`;

function run(cmd) {
  execSync(cmd, { stdio: 'inherit', shell: true });
}

async function patchAuthHook(token, hookSecret) {
  const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      hook_send_email_enabled: true,
      hook_send_email_uri: HOOK_URL,
      hook_send_email_secrets: hookSecret,
    }),
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text.slice(0, 400) };
  }
  if (!res.ok) {
    throw new Error(`Management API ${res.status}: ${body?.message || body?.msg || text}`);
  }
  return body;
}

async function main() {
  const resendKey = String(process.argv[2] || process.env.RESEND_API_KEY || '').trim();
  if (!resendKey || !resendKey.startsWith('re_')) {
    console.error('');
    console.error('Falta la clave de Resend (empieza con re_).');
    console.error('');
    console.error('  1) Entrá a https://resend.com/api-keys');
    console.error('  2) Create API Key → copiá la clave');
    console.error('  3) node scripts/setup-fitengine-email.cjs re_...');
    console.error('');
    process.exit(1);
  }

  const hookSecret =
    String(process.env.SEND_EMAIL_HOOK_SECRET || '').trim() ||
    `v1,whsec_${crypto.randomBytes(32).toString('base64')}`;

  const from = process.env.FITENGINE_EMAIL_FROM || 'FitEngine <onboarding@resend.dev>';
  const support = process.env.FITENGINE_SUPPORT_EMAIL || 'soporte@fitengine.app';
  const sales = process.env.FITENGINE_SALES_EMAIL || 'ventas@fitengine.app';

  console.log('Subiendo secrets a Supabase...');
  run(
    `npx supabase secrets set RESEND_API_KEY=${resendKey} FITENGINE_EMAIL_FROM="${from}" FITENGINE_SUPPORT_EMAIL=${support} FITENGINE_SALES_EMAIL=${sales} SEND_EMAIL_HOOK_SECRET="${hookSecret}" --project-ref ${PROJECT_REF}`,
  );

  const mgmt = String(process.env.SUPABASE_ACCESS_TOKEN || '').trim();
  if (mgmt) {
    console.log('Activando hook Send Email vía Management API...');
    try {
      await patchAuthHook(mgmt, hookSecret);
      console.log('Hook activado.');
    } catch (e) {
      console.warn('No se pudo activar el hook por API:', e.message);
      printManualHook(hookSecret);
    }
  } else {
    printManualHook(hookSecret);
  }

  console.log('');
  console.log('Listo. Probá registrarte con un mail tuyo en app.fitengine.app');
}

function printManualHook(hookSecret) {
  console.log('');
  console.log('--- Activar hook a mano (1 minuto) ---');
  console.log('Supabase → Authentication → Hooks → Send Email → HTTP');
  console.log('URL:', HOOK_URL);
  console.log('Secret (pegá tal cual):', hookSecret);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
