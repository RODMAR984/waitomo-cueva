// Callback OAuth MP: intercambia code → tokens, guarda en mercadopago_org_credentials, habilita checkout.
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, MP_OAUTH_CLIENT_ID, MP_OAUTH_CLIENT_SECRET, MERCADOPAGO_OAUTH_STATE_SECRET

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

function redirectToApp(targetUrl: string) {
  return Response.redirect(targetUrl, 302);
}

function isAllowedNativeReturn(raw: string) {
  const s = String(raw || "").trim();
  if (!s || s.length > 512) return false;
  const low = s.toLowerCase();
  return (
    low.startsWith("waitomo://") ||
    low.startsWith("exp://") ||
    low.startsWith("exps://") ||
    low.startsWith("exp+")
  );
}

function isAllowedWebReturn(raw: string) {
  const s = String(raw || "").trim();
  if (!s || s.length > 512) return false;
  try {
    const u = new URL(s);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const host = u.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1") return true;
    if (host === "fitengine.app" || host.endsWith(".fitengine.app")) return true;
    if (host.endsWith(".vercel.app")) return true;
    return false;
  } catch {
    return false;
  }
}

function buildMpConnectAppUrl(
  nativePayload: { native_return?: string; web_return?: string } | null,
  parts: { status: string; reason?: string },
) {
  const qs = new URLSearchParams();
  qs.set("mercadopago_connect", "done");
  qs.set("status", parts.status);
  if (parts.reason) qs.set("reason", parts.reason);
  const q = qs.toString();
  const native = String(nativePayload?.native_return || "").trim();
  if (native && isAllowedNativeReturn(native)) {
    return native.includes("?") ? `${native}&${q}` : `${native}?${q}`;
  }
  const web = String(nativePayload?.web_return || "").trim();
  if (web && isAllowedWebReturn(web)) {
    const sep = web.includes("?") ? "&" : "?";
    return `${web}${sep}${q}`;
  }
  const returnBase = (Deno.env.get("FITENGINE_WEB_APP_URL") || "https://app.fitengine.app").replace(/\/$/, "");
  return `${returnBase}/?${q}`;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "GET") return new Response("method_not_allowed", { status: 405 });

  const url = new URL(req.url);
  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  const errParam = url.searchParams.get("error") || "";

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const mpClientId = Deno.env.get("MP_OAUTH_CLIENT_ID") ?? "";
  const mpClientSecret = Deno.env.get("MP_OAUTH_CLIENT_SECRET") ?? "";
  const stateSecret = Deno.env.get("MERCADOPAGO_OAUTH_STATE_SECRET") ?? "";
  if (!supabaseUrl || !serviceKey || !mpClientId || !mpClientSecret || !stateSecret) {
    return new Response("missing_env", { status: 500 });
  }
  if (errParam) {
    return redirectToApp(buildMpConnectAppUrl(null, { status: "error", reason: errParam }));
  }
  if (!code || !state || !state.includes(".")) {
    return redirectToApp(buildMpConnectAppUrl(null, { status: "error", reason: "invalid_params" }));
  }

  const [encoded, sig] = state.split(".");
  const expected = await hmacSHA256(stateSecret, encoded);
  if (sig !== expected) {
    return redirectToApp(buildMpConnectAppUrl(null, { status: "error", reason: "invalid_state" }));
  }

  let payload: { org_id?: string; native_return?: string; web_return?: string; actor_id?: string; iat?: number };
  try {
    payload = JSON.parse(b64urlToText(encoded));
  } catch {
    return redirectToApp(buildMpConnectAppUrl(null, { status: "error", reason: "invalid_state_payload" }));
  }
  const organizationId = String(payload?.org_id || "").trim();
  if (!organizationId) {
    return redirectToApp(buildMpConnectAppUrl(payload, { status: "error", reason: "missing_org" }));
  }

  const callbackUrl = `${supabaseUrl.replace(/\/$/, "")}/functions/v1/mercadopago-oauth-callback`;
  const tokenRes = await fetch("https://api.mercadopago.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: mpClientId,
      client_secret: mpClientSecret,
      code,
      redirect_uri: callbackUrl,
    }),
  });
  const tokenBodyText = await tokenRes.text();
  if (!tokenRes.ok) {
    let detail = "";
    try {
      const j = JSON.parse(tokenBodyText);
      const d = j?.message || j?.error_description || j?.error;
      if (d) detail = String(d);
    } catch {
      if (tokenBodyText) detail = tokenBodyText.slice(0, 240);
    }
    const reason = detail
      ? `token_exchange_failed:${detail}`.slice(0, 500)
      : "token_exchange_failed";
    return redirectToApp(buildMpConnectAppUrl(payload, { status: "error", reason }));
  }

  let tokenJson: {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    user_id?: number | string;
  };
  try {
    tokenJson = JSON.parse(tokenBodyText);
  } catch {
    return redirectToApp(buildMpConnectAppUrl(payload, { status: "error", reason: "token_exchange_invalid_json" }));
  }
  const accessToken = String(tokenJson?.access_token || "").trim();
  if (!accessToken) {
    return redirectToApp(buildMpConnectAppUrl(payload, { status: "error", reason: "missing_access_token" }));
  }
  const refreshToken = String(tokenJson?.refresh_token || "").trim();
  const expiresIn = Number(tokenJson?.expires_in || 0);
  const expiresAt = expiresIn > 0
    ? new Date(Date.now() + expiresIn * 1000).toISOString()
    : null;
  const mpUserId = tokenJson?.user_id != null ? String(tokenJson.user_id) : null;

  const supabase = createClient(supabaseUrl, serviceKey);
  const { error: credErr } = await supabase.from("mercadopago_org_credentials").upsert(
    {
      organization_id: organizationId,
      access_token: accessToken,
      refresh_token: refreshToken || null,
      token_expires_at: expiresAt,
      mp_user_id: mpUserId,
    },
    { onConflict: "organization_id" },
  );
  if (credErr) {
    const msg = String(credErr.message || "db_credentials_failed");
    return redirectToApp(buildMpConnectAppUrl(payload, { status: "error", reason: msg }));
  }

  const { error: upErr } = await supabase
    .from("organizations")
    .update({
      mercadopago_checkout_enabled: true,
      mercadopago_oauth_linked: true,
      mercadopago_mp_user_id: mpUserId,
    })
    .eq("id", organizationId);
  if (upErr) {
    const msg = String(upErr.message || "db_update_failed");
    return redirectToApp(buildMpConnectAppUrl(payload, { status: "error", reason: msg }));
  }

  return redirectToApp(buildMpConnectAppUrl(payload, { status: "ok" }));
});
