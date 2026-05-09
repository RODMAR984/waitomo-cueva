// Owner/admin: autocompletado Google Places (legacy) para elegir Place ID. Misma auth que sync-google-place-summary.
// Secret: GOOGLE_MAPS_API_KEY (Places API en la clave). Body: organization_id, input, session_token?, language?

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, content-type, x-client-info, apikey",
};

const MAX_INPUT = 120;
const MIN_INPUT = 2;

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

  let body: {
    organization_id?: string;
    input?: string;
    session_token?: string;
    language?: string;
  } = {};
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const organizationId = String(body.organization_id || "").trim();
  const rawInput = String(body.input || "");
  const sessionToken = String(body.session_token || "").trim().slice(0, 120);
  const langRaw = String(body.language || "es").trim().toLowerCase();
  const language = /^[a-z]{2}(-[a-z]{2})?$/i.test(langRaw) ? langRaw.slice(0, 5) : "es";

  if (!organizationId) {
    return new Response(JSON.stringify({ error: "invalid_args" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const input = rawInput.trim();
  if (input.length < MIN_INPUT) {
    return new Response(JSON.stringify({ predictions: [] }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  if (input.length > MAX_INPUT) {
    return new Response(JSON.stringify({ error: "input_too_long" }), {
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

  const params = new URLSearchParams({
    input,
    key: googleKey,
    language,
  });
  // Sin types fijos: cubre gimnasios, estudios y coaches con ficha en Maps.
  if (sessionToken) params.set("sessiontoken", sessionToken);

  const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`;
  const gRes = await fetch(url);
  const gJson = await gRes.json().catch(() => null);
  const status = gJson?.status;
  if (status !== "OK" && status !== "ZERO_RESULTS") {
    return new Response(
      JSON.stringify({
        error: "google_autocomplete_failed",
        status: status || "UNKNOWN",
        message: gJson?.error_message || null,
      }),
      {
        status: 502,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  }

  const raw = Array.isArray(gJson?.predictions) ? gJson.predictions : [];
  const predictions = raw.slice(0, 10).map((p: Record<string, unknown>) => {
    const sf =
      p.structured_formatting && typeof p.structured_formatting === "object"
        ? p.structured_formatting as Record<string, unknown>
        : {};
    return {
      place_id: typeof p.place_id === "string" ? p.place_id : "",
      description: typeof p.description === "string" ? p.description : "",
      main_text: typeof sf.main_text === "string" ? sf.main_text : "",
      secondary_text: typeof sf.secondary_text === "string" ? sf.secondary_text : "",
    };
  }).filter((p: { place_id: string }) => p.place_id.length > 0);

  return new Response(JSON.stringify({ predictions }), {
    status: 200,
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
