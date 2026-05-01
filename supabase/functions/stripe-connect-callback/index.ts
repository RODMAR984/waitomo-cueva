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

/** HTTP redirect: WebView / Chrome in-app no siempre ejecutan meta refresh HTML. */
function redirectToApp(targetUrl: string) {
  return Response.redirect(targetUrl, 302);
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
  if (error) return redirectToApp(`${returnUrl}&status=error&reason=${encodeURIComponent(error)}`);
  if (!code || !state || !state.includes(".")) {
    return redirectToApp(`${returnUrl}&status=error&reason=invalid_params`);
  }

  const [encoded, sig] = state.split(".");
  const expected = await hmacSHA256(stateSecret, encoded);
  if (sig !== expected) {
    return redirectToApp(`${returnUrl}&status=error&reason=invalid_state`);
  }

  let payload: any;
  try {
    payload = JSON.parse(b64urlToText(encoded));
  } catch {
    return redirectToApp(`${returnUrl}&status=error&reason=invalid_state_payload`);
  }
  const organizationId = String(payload?.org_id || "").trim();
  if (!organizationId) {
    return redirectToApp(`${returnUrl}&status=error&reason=missing_org`);
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
  const tokenBodyText = await tokenRes.text();
  if (!tokenRes.ok) {
    let detail = "";
    try {
      const j = JSON.parse(tokenBodyText);
      const desc = j?.error_description || j?.error;
      if (desc) detail = String(desc);
    } catch {
      if (tokenBodyText) detail = tokenBodyText.slice(0, 240);
    }
    const reason = detail
      ? `token_exchange_failed:${detail}`.slice(0, 500)
      : "token_exchange_failed";
    return redirectToApp(`${returnUrl}&status=error&reason=${encodeURIComponent(reason)}`);
  }
  let tokenJson: any;
  try {
    tokenJson = JSON.parse(tokenBodyText);
  } catch {
    return redirectToApp(`${returnUrl}&status=error&reason=token_exchange_invalid_json`);
  }
  const stripeAccountId = String(tokenJson?.stripe_user_id || "").trim();
  if (!stripeAccountId) {
    return redirectToApp(`${returnUrl}&status=error&reason=missing_account_id`);
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
    const msg = String(upErr.message || "db_update_failed");
    const details = String(upErr.details || "").trim();
    const hint = String(upErr.hint || "").trim();
    const reason = details ? `${msg}: ${details}` : msg;
    const reasonWithHint = hint ? `${reason} (${hint})` : reason;
    return redirectToApp(`${returnUrl}&status=error&reason=${encodeURIComponent(reasonWithHint)}`);
  }

  return redirectToApp(`${returnUrl}&status=ok&account_id=${encodeURIComponent(stripeAccountId)}`);
});
