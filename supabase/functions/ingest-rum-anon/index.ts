import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey, x-rum-anon-key",
};

function json(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function originAllowed(origin: string, allowlist: string[]): boolean {
  if (!allowlist.length) return true;
  const o = (origin || "").trim();
  if (!o) return false;
  return allowlist.some((entry) => {
    const e = entry.trim();
    if (!e) return false;
    if (e === "*") return true;
    return o === e || o.startsWith(e);
  });
}

type Incoming = { name?: string; ts?: string; payload?: Record<string, unknown> };

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const expectedKey = Deno.env.get("RUM_ANON_INGEST_KEY") ?? "";
  if (!expectedKey) return json(503, { error: "RUM_ANON_INGEST_KEY not configured" });

  const supplied = req.headers.get("x-rum-anon-key") || "";
  if (supplied !== expectedKey) return json(401, { error: "Invalid rum key" });

  const origin = req.headers.get("Origin") || "";
  const allowRaw = Deno.env.get("RUM_ALLOWED_ORIGINS") || "";
  const allowlist = allowRaw.split(",").map((s) => s.trim()).filter(Boolean);
  if (!originAllowed(origin, allowlist)) return json(403, { error: "Origin not allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !service) return json(500, { error: "Missing Supabase env" });

  let body: { events?: Incoming[] };
  try {
    body = (await req.json()) as { events?: Incoming[] };
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const raw = Array.isArray(body?.events) ? body.events : [];
  if (raw.length === 0) return json(200, { ok: true, inserted: 0 });
  const events = raw.slice(0, 40);

  const rows = events.map((e) => ({
    event_name: String(e.name || "unknown").slice(0, 120),
    payload: {
      ts: e.ts || new Date().toISOString(),
      ...(e.payload && typeof e.payload === "object" ? e.payload : {}),
    },
  }));

  const supabaseAdmin = createClient(supabaseUrl, service);
  const { error } = await supabaseAdmin.from("web_rum_anonymous").insert(rows);
  if (error) return json(500, { error: error.message });

  return json(200, { ok: true, inserted: rows.length });
});
