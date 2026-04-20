// Crea una preferencia de Checkout Pro (Mercado Pago) y devuelve init_point.
// Requiere secretos: MP_ACCESS_TOKEN, SUPABASE_URL, SUPABASE_ANON_KEY.
// Opcional: CHECKOUT_BACK_URL_BASE (HTTPS, ej. https://waitomofitengine.com) para back_urls.

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
  const supabaseAnon = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
  );

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

  if (!(amount > 0) || Number.isNaN(amount)) {
    return new Response(JSON.stringify({ error: "amount must be > 0" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const mpToken = Deno.env.get("MP_ACCESS_TOKEN");
  if (!mpToken) {
    return new Response(JSON.stringify({ error: "MP_ACCESS_TOKEN not configured" }), {
      status: 503,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const base = (Deno.env.get("CHECKOUT_BACK_URL_BASE") || "https://waitomofitengine.com")
    .replace(/\/$/, "");
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
  const notificationUrl = supabaseUrl
    ? `${supabaseUrl}/functions/v1/mercadopago-webhook`
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
