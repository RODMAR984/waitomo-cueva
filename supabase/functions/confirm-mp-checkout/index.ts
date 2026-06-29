// Verifica pago MP (return URL o polling cliente) y activa abono del socio.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fulfillMpPayment } from "../_shared/fulfillMpPayment.ts";

const MP_API = "https://api.mercadopago.com";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
};

async function fetchPaymentJson(
  paymentId: string,
  bearer: string,
): Promise<Record<string, unknown> | null> {
  const mpRes = await fetch(`${MP_API}/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${bearer}` },
  });
  if (!mpRes.ok) return null;
  try {
    return (await mpRes.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function resolveMpToken(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
): Promise<string> {
  const globalMp = (Deno.env.get("MP_ACCESS_TOKEN") || "").trim();
  if (!orgId) return globalMp;

  const { data: orgRow } = await supabase
    .from("organizations")
    .select("mercadopago_checkout_enabled")
    .eq("id", orgId)
    .maybeSingle();

  const { data: cred } = await supabase
    .from("mercadopago_org_credentials")
    .select("access_token")
    .eq("organization_id", orgId)
    .maybeSingle();

  const accessOk = !!(cred?.access_token && String(cred.access_token).trim());
  if (accessOk && orgRow?.mercadopago_checkout_enabled) {
    return String(cred.access_token).trim();
  }
  return globalMp;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return new Response(JSON.stringify({ error: "missing_env" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const token = authHeader.replace("Bearer ", "");
  const supabaseAnon = createClient(supabaseUrl, anonKey);
  const { data: { user }, error: userError } = await supabaseAnon.auth.getUser(token);
  if (userError || !user?.id) {
    return new Response(JSON.stringify({ error: "invalid_token" }), {
      status: 401,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  let body: { payment_id?: string; organization_id?: string; collection_status?: string } = {};
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const paymentId = String(body.payment_id || "").trim();
  const orgHint = String(body.organization_id || "").trim();
  const collectionStatus = String(body.collection_status || "").trim().toLowerCase();

  if (!paymentId) {
    return new Response(JSON.stringify({ error: "missing_payment_id" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  if (collectionStatus && collectionStatus !== "approved") {
    return new Response(
      JSON.stringify({ ok: false, reason: "payment_not_approved", collection_status: collectionStatus }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);
  const mpToken = await resolveMpToken(supabaseAdmin, orgHint);
  if (!mpToken) {
    return new Response(JSON.stringify({ error: "mp_token_missing" }), {
      status: 503,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const payment = await fetchPaymentJson(paymentId, mpToken);
  if (!payment) {
    return new Response(JSON.stringify({ error: "mp_payment_not_found" }), {
      status: 502,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const metaUser = String(
    (payment.metadata as Record<string, unknown> | undefined)?.member_user_id || "",
  ).trim();
  if (metaUser && metaUser !== user.id) {
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const result = await fulfillMpPayment(supabaseAdmin, payment);
  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
