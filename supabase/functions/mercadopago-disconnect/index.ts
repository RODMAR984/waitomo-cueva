// Quita credenciales MP de la org (dueño/admin). POST { organization_id }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, content-type, x-client-info, apikey",
};

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
  if (!supabaseUrl || !anonKey || !serviceKey) {
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

  let body: { organization_id?: string } = {};
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

  await supabase.from("mercadopago_org_credentials").delete().eq("organization_id", organizationId);
  await supabase
    .from("organizations")
    .update({ mercadopago_checkout_enabled: false, mercadopago_oauth_linked: false })
    .eq("id", organizationId);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
