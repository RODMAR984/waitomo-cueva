// Owner/admin: lee Place ID, consulta Google Places Details, guarda google_place_summary (service role).
// Secret: GOOGLE_MAPS_API_KEY (Places API habilitada en la clave).
// Opcional: session_token (mismo que Autocomplete) para agrupar facturación de sesión según Google.

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
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const googleKey = (Deno.env.get("GOOGLE_MAPS_API_KEY") ?? "").trim();

  if (!supabaseUrl || !anonKey || !serviceKey) {
    return new Response(JSON.stringify({ error: "missing_env" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  if (!googleKey) {
    return new Response(JSON.stringify({ error: "missing_google_key" }), {
      status: 503,
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

  let body: { organization_id?: string; place_id?: string; session_token?: string } = {};
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const organizationId = String(body.organization_id || "").trim();
  const placeIdOverride = String(body.place_id || "").trim();
  if (!organizationId) {
    return new Response(JSON.stringify({ error: "invalid_args" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const { data: org, error: orgErr } = await supabase
    .from("organizations")
    .select("id, owner_id, google_place_id")
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
    org.owner_id === actorId ||
    role === "owner" ||
    role === "admin" ||
    role === "superadmin";
  if (!canEdit) {
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const placeId = placeIdOverride || String(org.google_place_id || "").trim();
  if (!placeId) {
    return new Response(JSON.stringify({ error: "missing_place_id" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const sessionToken = String(body.session_token || "").trim().slice(0, 120);
  const fields = "rating,user_ratings_total,formatted_address";
  let detailsUrl =
    `https://maps.googleapis.com/maps/api/place/details/json?place_id=${
      encodeURIComponent(placeId)
    }&fields=${fields}&key=${encodeURIComponent(googleKey)}`;
  if (sessionToken) {
    detailsUrl += `&sessiontoken=${encodeURIComponent(sessionToken)}`;
  }

  const gRes = await fetch(detailsUrl);
  const gJson = await gRes.json().catch(() => null);
  const status = gJson?.status;
  if (status !== "OK" || !gJson?.result) {
    return new Response(
      JSON.stringify({
        error: "google_places_failed",
        status: status || "UNKNOWN",
        message: gJson?.error_message || null,
      }),
      {
        status: 502,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  }

  const r = gJson.result;
  const fetchedAt = new Date().toISOString();
  const summary = {
    rating: typeof r.rating === "number" ? r.rating : null,
    user_ratings_total: typeof r.user_ratings_total === "number"
      ? r.user_ratings_total
      : null,
    formatted_address: typeof r.formatted_address === "string"
      ? r.formatted_address
      : null,
    fetched_at: fetchedAt,
  };

  const patch: Record<string, unknown> = {
    google_place_summary: summary,
  };
  if (placeIdOverride) {
    patch.google_place_id = placeIdOverride;
  }

  const { error: upErr } = await supabase
    .from("organizations")
    .update(patch)
    .eq("id", organizationId);

  if (upErr) {
    return new Response(JSON.stringify({ error: "db_update_failed", message: upErr.message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, summary }), {
    status: 200,
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
