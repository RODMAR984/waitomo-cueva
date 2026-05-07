// Crea preferencia Checkout Pro MP. Token: credencial OAuth de la org (si organization_id + habilitado) o MP_ACCESS_TOKEN (legacy).
// Body: amount, title, external_reference, organization_id (recomendado para cobrar en cuenta del gym).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, content-type, x-client-info, apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
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
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabaseAnon = createClient(supabaseUrl, anonKey);

  const { data: { user }, error: userError } = await supabaseAnon.auth.getUser(
    token,
  );
  if (userError || !user?.id) {
    return new Response(JSON.stringify({ error: "Invalid token" }), {
      status: 401,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  let body: {
    amount?: number;
    title?: string;
    external_reference?: string;
    organization_id?: string;
  };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const amount = Number(body?.amount);
  const title = String(body?.title || "FitEngine").slice(0, 120);
  const external_reference = String(
    body?.external_reference || `${user.id}_${Date.now()}`,
  ).slice(0, 256);
  const organizationId = String(body?.organization_id || "").trim();

  if (!(amount > 0) || Number.isNaN(amount)) {
    return new Response(JSON.stringify({ error: "amount must be > 0" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);

  let mpToken = (Deno.env.get("MP_ACCESS_TOKEN") || "").trim();
  let orgForMetadata = organizationId;

  if (organizationId) {
    const { data: mem } = await supabaseAdmin
      .from("organization_memberships")
      .select("organization_id")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .eq("active", true)
      .limit(1)
      .maybeSingle();
    if (!mem) {
      return new Response(JSON.stringify({ error: "forbidden", detail: "not_a_member" }), {
        status: 403,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { data: orgRow } = await supabaseAdmin
      .from("organizations")
      .select("mercadopago_checkout_enabled")
      .eq("id", organizationId)
      .maybeSingle();

    const { data: cred } = await supabaseAdmin
      .from("mercadopago_org_credentials")
      .select("access_token")
      .eq("organization_id", organizationId)
      .maybeSingle();

    const accessOk = !!(cred?.access_token && String(cred.access_token).trim());
    if (accessOk && !orgRow?.mercadopago_checkout_enabled) {
      return new Response(
        JSON.stringify({
          error: "mercadopago_checkout_disabled",
          detail: "enable_checkout_in_admin_or_disconnect",
        }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }
    if (accessOk && orgRow?.mercadopago_checkout_enabled) {
      mpToken = String(cred.access_token).trim();
    }
  }

  if (!mpToken) {
    return new Response(
      JSON.stringify({
        error: "MP_ACCESS_TOKEN not configured",
        detail: "connect_mercadopago_in_admin_or_set_MP_ACCESS_TOKEN",
      }),
      {
        status: 503,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  }

  const base = (Deno.env.get("CHECKOUT_BACK_URL_BASE") || "https://waitomofitengine.com")
    .replace(/\/$/, "");
  const supabaseUrlClean = (Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
  const notificationUrl = supabaseUrlClean
    ? `${supabaseUrlClean}/functions/v1/mercadopago-webhook`
    : undefined;

  const unit_price = Math.round(amount * 100) / 100;

  const preferenceBody: Record<string, unknown> = {
    items: [
      {
        title,
        quantity: 1,
        unit_price,
      },
    ],
    external_reference,
    metadata: orgForMetadata
      ? { organization_id: orgForMetadata, fitengine_external_ref: external_reference }
      : { fitengine_external_ref: external_reference },
    back_urls: {
      success: `${base}/`,
      failure: `${base}/`,
      pending: `${base}/`,
    },
    auto_return: "approved",
  };

  if (user.email && String(user.email).includes("@")) {
    preferenceBody.payer = { email: user.email };
  }

  if (notificationUrl) {
    preferenceBody.notification_url = notificationUrl;
  }

  const mpRes = await fetch(
    "https://api.mercadopago.com/checkout/preferences",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${mpToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preferenceBody),
    },
  );

  if (!mpRes.ok) {
    const errText = await mpRes.text();
    console.error("MP preference error", mpRes.status, errText);
    return new Response(
      JSON.stringify({
        error: "mercadopago_api_error",
        detail: errText.slice(0, 400),
      }),
      { status: 502, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  const pref = await mpRes.json();
  const init_point = pref?.init_point;
  const preference_id = pref?.id;
  if (!init_point) {
    return new Response(JSON.stringify({ error: "No init_point in MP response" }), {
      status: 502,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({ init_point, preference_id }),
    { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
  );
});
