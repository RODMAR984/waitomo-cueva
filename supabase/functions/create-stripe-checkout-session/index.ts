// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.25.0?target=deno";
import { resolveCheckoutBackUrlBase } from "../_shared/checkoutUrls.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...cors, "Content-Type": "application/json" } });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
  if (!supabaseUrl || !anonKey || !serviceKey || !stripeSecret) {
    return new Response(JSON.stringify({ error: "missing_env" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
  }
  const token = authHeader.replace("Bearer ", "");
  const supabaseAnon = createClient(supabaseUrl, anonKey);
  const { data: userData, error: userErr } = await supabaseAnon.auth.getUser(token);
  if (userErr || !userData?.user?.id) {
    return new Response(JSON.stringify({ error: "invalid_token" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
  }
  const actorId = userData.user.id;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
  }

  const organizationId = String(body.organization_id || "").trim();
  const memberUserId = String(body.member_user_id || actorId).trim();
  const planId = String(body.plan_id || "admin").trim();
  const periodo = String(body.periodo || new Date().toISOString().slice(0, 7)).trim();
  const amount = Number(body.amount || 0);
  const title = String(body.title || "FitEngine").slice(0, 120);
  if (!organizationId || !(amount > 0)) {
    return new Response(JSON.stringify({ error: "invalid_args" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);
  const { data: member, error: memberErr } = await supabaseAdmin
    .from("organization_memberships")
    .select("organization_id, active")
    .eq("organization_id", organizationId)
    .eq("user_id", actorId)
    .eq("active", true)
    .limit(1)
    .maybeSingle();
  if (memberErr) {
    return new Response(JSON.stringify({ error: memberErr.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
  if (!member) {
    return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...cors, "Content-Type": "application/json" } });
  }

  const { data: org, error: orgErr } = await supabaseAdmin
    .from("organizations")
    .select("stripe_connect_account_id, stripe_checkout_enabled, billing_currency")
    .eq("id", organizationId)
    .maybeSingle();
  if (orgErr) {
    return new Response(JSON.stringify({ error: orgErr.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
  const stripeAccountId = String(org?.stripe_connect_account_id || "").trim();
  const stripeCheckoutEnabled = !!org?.stripe_checkout_enabled;
  if (!stripeCheckoutEnabled || !stripeAccountId) {
    return new Response(JSON.stringify({ error: "stripe_not_configured_for_org" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const orgCurrency = String(org?.billing_currency || "USD").trim().toLowerCase();
  const currency = String(body.currency || orgCurrency || "usd").trim().toLowerCase();

  const stripe = new Stripe(stripeSecret, { apiVersion: "2023-10-16" });
  const webBase = resolveCheckoutBackUrlBase();
  const successUrl = `${webBase}/?payment=success`;
  const cancelUrl = `${webBase}/?payment=cancel`;
  const amountCents = Math.round(amount * 100);

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    success_url: successUrl,
    cancel_url: cancelUrl,
    line_items: [{
      quantity: 1,
      price_data: {
        currency,
        unit_amount: amountCents,
        product_data: { name: title },
      },
    }],
    metadata: {
      organization_id: organizationId,
      member_user_id: memberUserId,
      plan_id: planId,
      periodo,
    },
  }, {
    stripeAccount: stripeAccountId,
  });

  const paymentId = String(session.id || "");
  const { error: upErr } = await supabaseAdmin
    .from("billing_payments")
    .upsert({
      organization_id: organizationId,
      member_user_id: memberUserId || null,
      client_id: paymentId,
      plan_id: planId || null,
      periodo: periodo || null,
      monto: amount,
      moneda: currency.toUpperCase(),
      metodo: "stripe",
      status: "pendiente",
    }, { onConflict: "organization_id,client_id" });
  if (upErr) {
    return new Response(JSON.stringify({ error: upErr.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ ok: true, checkout_url: session.url, payment_id: paymentId }), {
    status: 200,
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
