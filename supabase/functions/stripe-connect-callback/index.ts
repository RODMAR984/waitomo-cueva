// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function b64urlToText(s: string) {
  const normalized = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return atob(normalized + pad);
}

function b64url(input: string) {
  return btoa(input).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function hmacSHA256(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  const bytes = new Uint8Array(sig);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
  return b64url(bin);
}

function htmlRedirect(url: string, title: string) {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"/><meta http-equiv="refresh" content="0; url=${url}"/></head><body><h3>${title}</h3><a href="${url}">Continuar</a></body></html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

Deno.serve(async (req: Request) => {
  if (req.method !== "GET") return new Response("method_not_allowed", { status: 405 });

  const url = new URL(req.url);
  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  const error = url.searchParams.get("error") || "";

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
  const stateSecret = Deno.env.get("STRIPE_CONNECT_STATE_SECRET") ?? "";
  const returnBase = (Deno.env.get("FITENGINE_WEB_APP_URL") || "https://app.fitengine.app").replace(/\/$/, "");
  const returnUrl = `${returnBase}/?stripe_connect=done`;
  if (!supabaseUrl || !serviceKey || !stripeSecret || !stateSecret) {
    return new Response("missing_env", { status: 500 });
  }
  if (error) return htmlRedirect(`${returnUrl}&status=error&reason=${encodeURIComponent(error)}`, "Error conectando Stripe");
  if (!code || !state || !state.includes(".")) {
    return htmlRedirect(`${returnUrl}&status=error&reason=invalid_params`, "Parametros invalidos");
  }

  const [encoded, sig] = state.split(".");
  const expected = await hmacSHA256(stateSecret, encoded);
  if (sig !== expected) {
    return htmlRedirect(`${returnUrl}&status=error&reason=invalid_state`, "Estado invalido");
  }

  let payload: any;
  try {
    payload = JSON.parse(b64urlToText(encoded));
  } catch {
    return htmlRedirect(`${returnUrl}&status=error&reason=invalid_state_payload`, "Estado invalido");
  }
  const organizationId = String(payload?.org_id || "").trim();
  if (!organizationId) {
    return htmlRedirect(`${returnUrl}&status=error&reason=missing_org`, "Falta organizacion");
  }

  const callbackUrl = `${supabaseUrl.replace(/\/$/, "")}/functions/v1/stripe-connect-callback`;
  const tokenRes = await fetch("https://connect.stripe.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_secret: stripeSecret,
      redirect_uri: callbackUrl,
    }),
  });
  if (!tokenRes.ok) {
    return htmlRedirect(`${returnUrl}&status=error&reason=token_exchange_failed`, "No se pudo conectar Stripe");
  }
  const tokenJson: any = await tokenRes.json();
  const stripeAccountId = String(tokenJson?.stripe_user_id || "").trim();
  if (!stripeAccountId) {
    return htmlRedirect(`${returnUrl}&status=error&reason=missing_account_id`, "Stripe no devolvio cuenta");
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const { error: upErr } = await supabase
    .from("organizations")
    .update({
      stripe_connect_account_id: stripeAccountId,
      stripe_checkout_enabled: true,
    })
    .eq("id", organizationId);
  if (upErr) {
    return htmlRedirect(`${returnUrl}&status=error&reason=db_update_failed`, "No se pudo guardar la cuenta");
  }

  return htmlRedirect(`${returnUrl}&status=ok&account_id=${encodeURIComponent(stripeAccountId)}`, "Stripe conectado correctamente");
});
