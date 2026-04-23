import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, content-type, x-client-info, apikey",
};

type Mode = "routine" | "rewrite" | "message" | "rm_format";

type Body = {
  mode?: Mode;
  organization_id?: string;
  target_client_id?: string | null;
  session_date?: string;
  slot_label?: string;
  plan_key?: string;
  duration_minutes?: number;
  focus?: string;
  extra_notes?: string;
  raw_text?: string;
  title_hint?: string;
};

function jsonResponse(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

/** Errores 5xx con `step` para ver en logs de Edge y en el mensaje de la app. */
function logErr(step: string, message: string, extra?: unknown) {
  console.error(`[generate-routine] ${step}:`, message, extra ?? "");
}

function err500(step: string, message: string, extra?: Record<string, unknown>) {
  logErr(step, message, extra);
  return jsonResponse(500, { error: message, step, ...extra });
}

function normalizeMode(input?: string): Mode {
  if (input === "rewrite") return "rewrite";
  if (input === "message") return "message";
  if (input === "rm_format") return "rm_format";
  return "routine";
}

/** Alineado con la app: bloques pueden guardarse con legacy value o con code corto. */
function planKeysForRecentQuery(planKey: string): string[] | null {
  const s = String(planKey || "").trim();
  if (!s) return null;
  const legacy: Record<string, string> = {
    cross_training: "cross",
    hyrox: "hyrox",
    ciclo_evolucion: "evolucion",
    stretching: "stretching",
    yoga: "yoga",
    open_box: "openbox",
  };
  const short = legacy[s] || s;
  return short === s ? [s] : [s, short];
}

function buildPrompt({
  mode,
  body,
  profile,
  recentBlocks,
}: {
  mode: Mode;
  body: Body;
  profile: { full_name?: string | null; username?: string | null } | null;
  recentBlocks: Array<{
    fecha?: string;
    slot_label?: string;
    titulo?: string;
    contenido?: string;
  }>;
}) {
  const date = String(body.session_date || "").trim() || "hoy";
  const slot = String(body.slot_label || "").trim() || "sin horario";
  const plan = String(body.plan_key || "").trim() || "sin plan";
  const focus = String(body.focus || "").trim() || "general";
  const extraNotes = String(body.extra_notes || "").trim() || "sin notas";
  const duration = Number.isFinite(Number(body.duration_minutes))
    ? Math.max(10, Math.min(180, Number(body.duration_minutes)))
    : 45;
  const text = String(body.raw_text || "").trim();
  const titleHint = String(body.title_hint || "").trim();
  const athlete = profile?.full_name || profile?.username || "cliente";

  const recent = (recentBlocks || [])
    .map((r, idx) =>
      `${idx + 1}) ${String(r.fecha || "")} ${String(r.slot_label || "")} · ${String(r.titulo || "")}\n${String(r.contenido || "").slice(0, 650)}`,
    )
    .join("\n\n");

  const baseRules = `
Reglas de formato FitEngine (OBLIGATORIAS):
- Si mencionás %RM, usar patrón exacto: @<porcentaje>%<n>rm<ejercicio>
- Ejemplo válido: @80%1rmBack Squat
- NO inventes formatos alternativos (nada de "80% RM", "1RM 80%", etc.)
- Respetá ortografía técnica clara y texto pegable en "contenido".
`;

  if (mode === "rewrite") {
    return `
Sos asistente de redacción de rutinas para coaches.
${baseRules}
Tarea: reescribir/mejorar el siguiente texto de bloque para que quede más claro y ordenado, sin perder intención.
Texto original:
${text || "(vacío)"}
Respondé SOLO JSON válido:
{"mode":"rewrite","result_text":"...texto final..."}
`;
  }

  if (mode === "message") {
    return `
Sos asistente para redactar un mensaje corto y claro para alumnos.
${baseRules}
Contexto:
- Plan: ${plan}
- Fecha: ${date}
- Horario: ${slot}
- Título sugerido: ${titleHint || "sin título"}
- Contenido base: ${text || "sin contenido"}
- Nota coach: ${extraNotes}
Redactá un mensaje breve listo para copiar y enviar.
Respondé SOLO JSON válido:
{"mode":"message","result_text":"...mensaje final..."}
`;
  }

  if (mode === "rm_format") {
    return `
Sos un normalizador de instrucciones a formato RM de FitEngine.
${baseRules}
Convertí esta instrucción de coach a texto pegable para "contenido":
${text || "(vacío)"}
Respondé SOLO JSON válido:
{"mode":"rm_format","result_text":"...contenido con patrón @xx%nrm..."}
`;
  }

  return `
Sos un asistente experto en programación de entrenamiento funcional.
${baseRules}
Tu output es un BORRADOR para que luego lo revise el coach.

Contexto:
- Atleta: ${athlete}
- Plan: ${plan}
- Fecha: ${date}
- Horario: ${slot}
- Duración: ${duration} minutos
- Foco: ${focus}
- Notas extra del coach: ${extraNotes}

Últimos bloques recientes del plan:
${recent || "sin historial reciente"}

Armá un bloque completo:
- título corto
- contenido listo para pegar (líneas, series/reps, y %RM cuando aplique)
- notas para coach (breve)
- advertencias (array de strings)

Respondé SOLO JSON válido:
{
  "mode":"routine",
  "title":"...",
  "result_text":"...contenido final...",
  "coach_notes":"...",
  "warnings":["...","..."]
}
`;
}

function safeJsonParse(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return jsonResponse(405, { error: "Method not allowed" });

  try {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return jsonResponse(401, { error: "Unauthorized" });
  const token = authHeader.replace("Bearer ", "");

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !supabaseAnonKey || !serviceKey) {
    return err500("env_supabase", "Missing SUPABASE_URL, SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY");
  }

  const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);
  /** Mismo usuario que el JWT: necesario para RPC que usan auth.uid() (p. ej. check_ai_quota). */
  const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const supabaseAdmin = createClient(supabaseUrl, serviceKey);

  const { data: userData, error: userErr } = await supabaseAnon.auth.getUser(token);
  const user = userData?.user;
  if (userErr || !user?.id) return jsonResponse(401, { error: "Invalid token" });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return jsonResponse(400, { error: "Invalid JSON body" });
  }

  const mode = normalizeMode(String(body.mode || "routine"));
  const orgIdRaw = String(body.organization_id || "").trim();
  if (!orgIdRaw) return jsonResponse(400, { error: "organization_id required" });

  // PGRST116 si hay >1 fila: duplicados o varios roles staff en la misma org → limit(1).
  const { data: member, error: memErr } = await supabaseAdmin
    .from("organization_memberships")
    .select("organization_id, role, active")
    .eq("organization_id", orgIdRaw)
    .eq("user_id", user.id)
    .eq("active", true)
    .in("role", ["coach", "admin", "owner", "superadmin"])
    .limit(1)
    .maybeSingle();

  if (memErr) {
    return err500("membership_query", memErr.message, {
      hint: memErr.hint,
      code: memErr.code,
    });
  }
  if (!member) return jsonResponse(403, { error: "forbidden" });

  const { data: quotaRaw, error: quotaErr } = await supabaseUser.rpc("check_ai_quota", {
    p_org_id: orgIdRaw,
  });
  if (quotaErr) {
    return err500("check_ai_quota_rpc", quotaErr.message, {
      code: quotaErr.code,
      hint: "¿Existe la función SQL check_ai_quota y GRANT a authenticated?",
    });
  }
  let quotaData = quotaRaw as Record<string, unknown> | null;
  if (Array.isArray(quotaData)) {
    quotaData = (quotaData[0] as Record<string, unknown>) ?? null;
  }
  if (!quotaData || typeof quotaData !== "object") {
    return err500("check_ai_quota_shape", "Unexpected RPC response", {
      raw_type: Array.isArray(quotaRaw) ? "array" : typeof quotaRaw,
    });
  }
  if (!quotaData.ok) {
    if (quotaData.reason === "forbidden") {
      return jsonResponse(403, { error: "forbidden", quota: quotaData });
    }
    return jsonResponse(429, { error: "quota_exceeded", quota: quotaData });
  }

  const [profileRes, recentRes] = await Promise.all([
    body.target_client_id
      ? supabaseAdmin
          .from("profiles")
          .select("full_name, username")
          .eq("id", body.target_client_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    (() => {
      const keys = planKeysForRecentQuery(String(body.plan_key || ""));
      let q = supabaseAdmin
        .from("training_daily_blocks")
        .select("fecha, slot_label, titulo, contenido")
        .eq("organization_id", orgIdRaw);
      if (keys == null) {
        return q.order("fecha", { ascending: false }).limit(4);
      }
      if (keys.length === 1) {
        q = q.eq("plan_key", keys[0]);
      } else {
        q = q.in("plan_key", keys);
      }
      return q.order("fecha", { ascending: false }).limit(4);
    })(),
  ]);

  if (profileRes.error) {
    return err500("profile_fetch", profileRes.error.message, { code: profileRes.error.code });
  }
  if (recentRes.error) {
    return err500("recent_blocks_fetch", recentRes.error.message, {
      code: recentRes.error.code,
      hint: "Tabla training_daily_blocks / plan_key",
    });
  }

  const prompt = buildPrompt({
    mode,
    body,
    profile: profileRes.data,
    recentBlocks: Array.isArray(recentRes.data) ? recentRes.data : [],
  });

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) return jsonResponse(503, { error: "GEMINI_API_KEY not configured" });
  const model = Deno.env.get("GEMINI_MODEL") || "gemini-2.5-flash";

  const gemRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.35,
          responseMimeType: "application/json",
        },
      }),
    },
  );

  const gemJson = await gemRes.json().catch(() => null);
  if (!gemRes.ok) {
    const detail = JSON.stringify(gemJson || {}).slice(0, 500);
    await supabaseAdmin.from("ai_generation_logs").insert({
      organization_id: orgIdRaw,
      user_id: user.id,
      target_client_id: body.target_client_id || null,
      feature:
        mode === "routine"
          ? "generate_routine"
          : mode === "rewrite"
          ? "rewrite_block"
          : mode === "message"
          ? "draft_message"
          : "rm_format",
      success: false,
      error_message: detail,
    });
    return jsonResponse(502, { error: "gemini_api_error", detail });
  }

  const text =
    gemJson?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || "").join("\n") ||
    "";
  const parsed = safeJsonParse(text);
  if (!parsed) {
    await supabaseAdmin.from("ai_generation_logs").insert({
      organization_id: orgIdRaw,
      user_id: user.id,
      target_client_id: body.target_client_id || null,
      feature:
        mode === "routine"
          ? "generate_routine"
          : mode === "rewrite"
          ? "rewrite_block"
          : mode === "message"
          ? "draft_message"
          : "rm_format",
      success: false,
      error_message: "invalid_json_from_model",
    });
    return jsonResponse(502, { error: "invalid_model_json", raw: text.slice(0, 1200) });
  }

  const usage = gemJson?.usageMetadata || {};
  const inTok = Number(usage.promptTokenCount || 0);
  const outTok = Number(usage.candidatesTokenCount || 0);
  const inPrice = Number(Deno.env.get("GEMINI_PRICE_INPUT_PER_MILLION") || "0.30");
  const outPrice = Number(Deno.env.get("GEMINI_PRICE_OUTPUT_PER_MILLION") || "2.50");
  const costUsd = (inTok / 1_000_000) * inPrice + (outTok / 1_000_000) * outPrice;
  const costCents = Math.max(0, Math.round(costUsd * 100));

  const { error: logInsertErr } = await supabaseAdmin.from("ai_generation_logs").insert({
    organization_id: orgIdRaw,
    user_id: user.id,
    target_client_id: body.target_client_id || null,
    feature:
      mode === "routine"
        ? "generate_routine"
        : mode === "rewrite"
        ? "rewrite_block"
        : mode === "message"
        ? "draft_message"
        : "rm_format",
    input_tokens: inTok,
    output_tokens: outTok,
    cost_usd_cents: costCents,
    success: true,
  });
  if (logInsertErr) {
    return err500("ai_log_insert_success", logInsertErr.message, {
      code: logInsertErr.code,
      hint: "Tabla ai_generation_logs o políticas",
    });
  }

  return jsonResponse(200, {
    ok: true,
    mode,
    result: parsed,
    usage: { input_tokens: inTok, output_tokens: outTok, cost_usd_cents: costCents },
    quota: quotaData,
  });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logErr("unhandled_exception", msg, e);
    return jsonResponse(500, {
      error: msg,
      step: "unhandled_exception",
    });
  }
});
