#!/usr/bin/env node
/**
 * Lee Site URL y Redirect URLs (uri_allow_list) vía Supabase Management API.
 *
 * Uso (PowerShell, NO pegues el token en el chat):
 *   $env:SUPABASE_ACCESS_TOKEN='sbp_...'
 *   node scripts/supabase-mgmt-auth-config.cjs
 *
 * Token: Dashboard Supabase → Account (abajo izq.) → Access Tokens → Generate new token.
 * Ref del proyecto: mismo que en supabaseClient.js (URL .../nfjjkvjsssgxxsuocmhj.supabase.co).
 */
'use strict';

const PROJECT_REF = 'nfjjkvjsssgxxsuocmhj';
const token = String(process.env.SUPABASE_ACCESS_TOKEN || '').trim();

async function main() {
  if (!token) {
    console.error(
      'Falta SUPABASE_ACCESS_TOKEN. En PowerShell: $env:SUPABASE_ACCESS_TOKEN="sbp_..." ; node scripts/supabase-mgmt-auth-config.cjs',
    );
    process.exit(1);
  }

  const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch (_) {
    body = { raw: text.slice(0, 500) };
  }

  if (!res.ok) {
    console.error('Error HTTP', res.status, body?.message || body?.msg || body);
    process.exit(1);
  }

  const site = body?.site_url ?? body?.SITE_URL;
  const allow = body?.uri_allow_list ?? body?.URI_ALLOW_LIST ?? body?.additional_redirect_urls;

  console.log('--- Supabase Auth (proyecto', PROJECT_REF + ') ---');
  console.log('site_url:', site ?? '(no viene en respuesta; revisá JSON abajo)');
  console.log('uri_allow_list / redirects:', allow ?? '(ver JSON)');
  console.log('');
  console.log(JSON.stringify(body, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
