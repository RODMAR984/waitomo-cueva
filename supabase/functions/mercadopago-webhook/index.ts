// Webhook MP: confirma pago y escribe finanzas_ledger. Soporta token global (legacy) u OAuth por org (prueba tokens hasta GET 200).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fulfillMpPayment } from "../_shared/fulfillMpPayment.ts";

const MP_API = "https://api.mercadopago.com";

interface MPWebhookBody {
  type?: string;
  action?: string;
  data?: { id: string };
  id?: string;
}

async function fetchPaymentJson(
  paymentId: string,
  bearer: string,
): Promise<{ ok: boolean; json: Record<string, unknown> | null }> {
  const mpRes = await fetch(`${MP_API}/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${bearer}` },
  });
  if (!mpRes.ok) return { ok: false, json: null };
  try {
    const json = await mpRes.json();
    return { ok: true, json: json as Record<string, unknown> };
  } catch {
    return { ok: false, json: null };
  }
}

function orgIdFromPayment(payment: Record<string, unknown> | null): string | null {
  if (!payment) return null;
  const meta = payment.metadata;
  if (meta && typeof meta === "object" && meta !== null && !Array.isArray(meta)) {
    const oid = (meta as Record<string, unknown>).organization_id;
    if (oid != null && String(oid).trim()) return String(oid).trim();
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const ownerIdEnv = Deno.env.get("FINANZAS_OWNER_ID");
  const globalMp = (Deno.env.get("MP_ACCESS_TOKEN") || "").trim();
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !serviceKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return new Response(
      JSON.stringify({ error: "Server config missing" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
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

  console.log(JSON.stringify({ source: "mp_webhook", phase: "received", has_payment_id: true }));

  const supabase = createClient(supabaseUrl, serviceKey);

  let payment: Record<string, unknown> | null = null;
  let resolvedOrgId: string | null = null;

  if (globalMp) {
    const r = await fetchPaymentJson(paymentId, globalMp);
    if (r.ok && r.json) {
      payment = r.json;
      resolvedOrgId = orgIdFromPayment(payment);
    }
  }

  if (!payment) {
    const { data: creds } = await supabase
      .from("mercadopago_org_credentials")
      .select("organization_id, access_token");
    const rows = Array.isArray(creds) ? creds : [];
    for (const row of rows) {
      const tok = String(row?.access_token || "").trim();
      if (!tok) continue;
      const r = await fetchPaymentJson(paymentId, tok);
      if (r.ok && r.json) {
        payment = r.json;
        resolvedOrgId = String(row.organization_id || "").trim() || orgIdFromPayment(payment);
        break;
      }
    }
  }

  if (!payment) {
    console.error("MP webhook: could not fetch payment", paymentId);
    return new Response(JSON.stringify({ error: "MP API error" }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  const status = payment.status;
  if (status !== "approved") {
    return new Response(
      JSON.stringify({ ok: true, skipped: "payment not approved", status }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  const amount = Number(payment.transaction_amount ?? 0);
  const currency = String(payment.currency_id ?? "ARS");

  let ledgerOwnerId = ownerIdEnv;
  if (resolvedOrgId) {
    const { data: org } = await supabase
      .from("organizations")
      .select("owner_id")
      .eq("id", resolvedOrgId)
      .maybeSingle();
    if (org?.owner_id) ledgerOwnerId = String(org.owner_id);
  }

  if (!ledgerOwnerId) {
    console.error("No ledger owner: set FINANZAS_OWNER_ID or organization metadata");
    return new Response(JSON.stringify({ error: "missing_ledger_owner" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { error } = await supabase.from("finanzas_ledger").insert({
    owner_id: ledgerOwnerId,
    tipo: "ingreso",
    metodo: "mercadopago",
    monto: amount,
    moneda: currency,
    notas: `Cobro MP · ${paymentId}${resolvedOrgId ? ` · org ${resolvedOrgId}` : ""}`,
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

  try {
    await fulfillMpPayment(supabase, payment);
  } catch (e) {
    console.error("fulfillMpPayment error", e);
  }

  console.log(
    JSON.stringify({
      source: "mp_webhook",
      phase: "ledger_insert_ok",
      has_org: Boolean(resolvedOrgId),
      amount_bucket: amount >= 1000 ? "1000plus" : amount >= 100 ? "100_999" : "under100",
    }),
  );

  return new Response(
    JSON.stringify({ ok: true, payment_id: paymentId, amount, organization_id: resolvedOrgId }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
