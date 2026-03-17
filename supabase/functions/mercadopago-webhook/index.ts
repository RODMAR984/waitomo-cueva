// Edge Function: recibe webhook de Mercado Pago y registra el cobro en finanzas_ledger.
// Requiere: MP_ACCESS_TOKEN y FINANZAS_OWNER_ID (uuid del dueño de la caja) en Secrets.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MP_API = "https://api.mercadopago.com";

interface MPWebhookBody {
  type?: string;
  action?: string;
  data?: { id: string };
  id?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const mpAccessToken = Deno.env.get("MP_ACCESS_TOKEN");
  const ownerId = Deno.env.get("FINANZAS_OWNER_ID");

  if (!mpAccessToken || !ownerId) {
    console.error("Missing MP_ACCESS_TOKEN or FINANZAS_OWNER_ID");
    return new Response(
      JSON.stringify({ error: "Server config missing" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  let paymentId: string | null = null;
  const contentType = req.headers.get("content-type") || "";

  try {
    if (contentType.includes("application/json")) {
      const body: MPWebhookBody = await req.json();
      paymentId = body?.data?.id ?? body?.id ?? null;
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      const text = await req.text();
      const params = new URLSearchParams(text);
      paymentId = params.get("id") ?? params.get("data.id") ?? null;
    }
  } catch {
    return new Response(JSON.stringify({ error: "Invalid body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!paymentId) {
    return new Response(JSON.stringify({ error: "No payment id" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Obtener detalle del pago desde Mercado Pago
  const mpRes = await fetch(`${MP_API}/v1/payments/${paymentId}`, {
    headers: {
      Authorization: `Bearer ${mpAccessToken}`,
    },
  });

  if (!mpRes.ok) {
    console.error("MP API error", mpRes.status, await mpRes.text());
    return new Response(JSON.stringify({ error: "MP API error" }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  const payment = await mpRes.json();
  const status = payment?.status;
  if (status !== "approved") {
    return new Response(
      JSON.stringify({ ok: true, skipped: "payment not approved", status }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  const amount = Number(payment?.transaction_amount ?? 0);
  const currency = payment?.currency_id ?? "ARS";

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const { error } = await supabase.from("finanzas_ledger").insert({
    owner_id: ownerId,
    tipo: "ingreso",
    metodo: "mercadopago",
    monto: amount,
    moneda: currency,
    notas: `Cobro MP · ${paymentId}${payment?.description ? ` · ${payment.description}` : ""}`,
    fuente: "mercadopago_webhook",
    link_id: paymentId,
    fecha: new Date().toISOString(),
    source: "mercadopago_webhook",
  });

  if (error) {
    console.error("Supabase insert error", error);
    return new Response(JSON.stringify({ error: "DB error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({ ok: true, payment_id: paymentId, amount }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
