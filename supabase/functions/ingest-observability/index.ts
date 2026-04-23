import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
};

function json(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

type IncomingEvent = {
  id?: string;
  type?: string;
  name?: string;
  ts?: string;
  role?: string | null;
  organization_id?: string | null;
  payload?: Record<string, unknown>;
  error_message?: string | null;
  stack?: string | null;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json(401, { error: "Unauthorized" });

  const token = authHeader.replace("Bearer ", "");
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !anon || !service) return json(500, { error: "Missing Supabase env vars" });

  const supabaseAnon = createClient(supabaseUrl, anon);
  const supabaseAdmin = createClient(supabaseUrl, service);

  const { data: userData, error: userErr } = await supabaseAnon.auth.getUser(token);
  const user = userData?.user;
  if (userErr || !user?.id) return json(401, { error: "Invalid token" });

  let body: { events?: IncomingEvent[] };
  try {
    body = (await req.json()) as { events?: IncomingEvent[] };
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const events = Array.isArray(body?.events) ? body.events.slice(0, 200) : [];
  if (events.length === 0) return json(200, { ok: true, synced_ids: [] });

  const rows = events.map((e) => ({
    event_id: String(e.id || ""),
    user_id: user.id,
    organization_id: e.organization_id || null,
    role: e.role || null,
    event_type: String(e.type || "event"),
    event_name: String(e.name || "unknown"),
    event_ts: e.ts || new Date().toISOString(),
    payload: e.payload ?? {},
    error_message: e.error_message || null,
    stack: e.stack || null,
  }));

  const { error } = await supabaseAdmin
    .from("observability_events")
    .upsert(rows, { onConflict: "event_id" });
  if (error) return json(500, { error: error.message });

  return json(200, {
    ok: true,
    synced_ids: rows.map((r) => r.event_id).filter(Boolean),
  });
});
