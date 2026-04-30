// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.25.0?target=deno";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("method_not_allowed", { status: 405 });

  const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!stripeSecret || !webhookSecret || !supabaseUrl || !serviceKey) {
    return new Response("missing_env", { status: 500 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("missing_signature", { status: 400 });
  const payload = await req.text();

  const stripe = new Stripe(stripeSecret, { apiVersion: "2023-10-16" });
  let event: any;
  try {
    event = await stripe.webhooks.constructEventAsync(payload, sig, webhookSecret);
  } catch {
    return new Response("invalid_signature", { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const paymentId = String(session.id || "");
    const paidAt = session.created ? new Date(session.created * 1000).toISOString() : new Date().toISOString();
    const amount = Number(session.amount_total || 0) / 100;
    const currency = String(session.currency || "usd").toUpperCase();
    const organizationId = String(session?.metadata?.organization_id || "").trim();
    const memberUserId = String(session?.metadata?.member_user_id || "").trim();
    const planId = String(session?.metadata?.plan_id || "").trim();
    const periodo = String(session?.metadata?.periodo || "").trim();

    const supabase = createClient(supabaseUrl, serviceKey);
    if (organizationId) {
      await supabase
        .from("billing_payments")
        .upsert({
          organization_id: organizationId,
          member_user_id: memberUserId || null,
          client_id: paymentId,
          plan_id: planId || null,
          periodo: periodo || null,
          status: "pagado",
          paid_at: paidAt,
          monto: amount,
          moneda: currency,
          metodo: "stripe",
        }, { onConflict: "organization_id,client_id" });
    } else {
      await supabase
        .from("billing_payments")
        .update({
          status: "pagado",
          paid_at: paidAt,
          monto: amount,
          moneda: currency,
          metodo: "stripe",
        })
        .eq("client_id", paymentId);
    }
  }

  return new Response("ok", { status: 200 });
});
