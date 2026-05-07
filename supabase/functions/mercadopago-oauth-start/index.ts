// Inicia OAuth Mercado Pago (vendedor) para una organización — mismo patrón que stripe-connect-start.
// Secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, MP_OAUTH_CLIENT_ID, MERCADOPAGO_OAUTH_STATE_SECRET

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, content-type, x-client-info, apikey",
};

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const mpClientId = Deno.env.get("MP_OAUTH_CLIENT_ID") ?? "";
  const stateSecret = Deno.env.get("MERCADOPAGO_OAUTH_STATE_SECRET") ?? "";
  if (!supabaseUrl || !anonKey || !serviceKey || !mpClientId || !stateSecret) {
    return new Response(JSON.stringify({ error: "missing_env" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  const token = authHeader.replace("Bearer ", "");
  const supabaseAnon = createClient(supabaseUrl, anonKey);
  const { data: userData, error: userErr } = await supabaseAnon.auth.getUser(token);
  if (userErr || !userData?.user?.id) {
    return new Response(JSON.stringify({ error: "invalid_token" }), {
      status: 401,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  const actorId = userData.user.id;

  let body: { organization_id?: string; native_return_url?: string } = {};
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  const organizationId = String(body.organization_id || "").trim();
  if (!organizationId) {
    return new Response(JSON.stringify({ error: "invalid_args" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const nativeReturnRaw = String(body.native_return_url || "").trim();
  let nativeReturn = "";
  if (nativeReturnRaw) {
    if (nativeReturnRaw.length > 512) {
      return new Response(JSON.stringify({ error: "native_return_url_too_long" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const low = nativeReturnRaw.toLowerCase();
    const ok =
      low.startsWith("waitomo://") ||
      low.startsWith("exp://") ||
      low.startsWith("exps://") ||
      low.startsWith("exp+");
    if (!ok) {
      return new Response(JSON.stringify({ error: "native_return_url_not_allowed" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    nativeReturn = nativeReturnRaw;
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const { data: org, error: orgErr } = await supabase
    .from("organizations")
    .select("id, owner_id")
    .eq("id", organizationId)
    .maybeSingle();
  if (orgErr || !org) {
    return new Response(JSON.stringify({ error: "org_not_found" }), {
      status: 404,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  const { data: membership } = await supabase
    .from("organization_memberships")
    .select("role, active")
    .eq("organization_id", organizationId)
    .eq("user_id", actorId)
    .eq("active", true)
    .limit(1)
    .maybeSingle();
  const role = String(membership?.role || "").trim().toLowerCase();
  const canEdit =
    org.owner_id === actorId || role === "owner" || role === "admin" || role === "superadmin";
  if (!canEdit) {
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const callbackUrl = `${supabaseUrl.replace(/\/$/, "")}/functions/v1/mercadopago-oauth-callback`;
  const payload: Record<string, unknown> = {
    org_id: organizationId,
    actor_id: actorId,
    iat: Date.now(),
  };
  if (nativeReturn) payload.native_return = nativeReturn;
  const encoded = b64url(JSON.stringify(payload));
  const sig = await hmacSHA256(stateSecret, encoded);
  const state = `${encoded}.${sig}`;

  const oauthUrl =
    `https://auth.mercadopago.com.ar/authorization` +
    `?response_type=code` +
    `&client_id=${encodeURIComponent(mpClientId)}` +
    `&platform=mp` +
    `&state=${encodeURIComponent(state)}` +
    `&redirect_uri=${encodeURIComponent(callbackUrl)}`;

  return new Response(JSON.stringify({ ok: true, oauth_url: oauthUrl }), {
    status: 200,
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
