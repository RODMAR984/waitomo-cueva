import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
};

type AlertStatus = "open" | "resolved";
type AlertSeverity = "warning" | "critical";

type AlertRule = {
  key: string;
  metricName: string;
  severity: AlertSeverity;
  status: AlertStatus;
  metricValue: number | null;
  thresholdValue: number | null;
  windowMinutes: number | null;
  details: Record<string, unknown>;
};

function json(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function envNumber(name: string, fallback: number) {
  const raw = Deno.env.get(name);
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function roundMetric(value: number) {
  return Math.round(value * 10000) / 10000;
}

async function notifyWebhook(payload: unknown) {
  const webhook = Deno.env.get("OBS_ALERT_WEBHOOK_URL");
  if (!webhook) return;
  const bearer = Deno.env.get("OBS_ALERT_WEBHOOK_BEARER") || "";
  await fetch(webhook, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
    },
    body: JSON.stringify(payload),
  });
}

async function upsertAlert(supabaseAdmin: ReturnType<typeof createClient>, rule: AlertRule) {
  const nowIso = new Date().toISOString();
  const baseRow = {
    alert_key: rule.key,
    status: rule.status,
    severity: rule.severity,
    metric_name: rule.metricName,
    metric_value: rule.metricValue,
    threshold_value: rule.thresholdValue,
    window_minutes: rule.windowMinutes,
    details: rule.details,
  };

  const { data: existing, error: existingErr } = await supabaseAdmin
    .from("observability_alerts")
    .select("id, status")
    .eq("alert_key", rule.key)
    .maybeSingle();
  if (existingErr) throw existingErr;

  if (rule.status === "open") {
    const row = {
      ...baseRow,
      observed_at: nowIso,
      resolved_at: null,
      ...(existing?.status !== "open" ? { last_notified_at: nowIso } : {}),
    };
    const { error } = await supabaseAdmin
      .from("observability_alerts")
      .upsert(row, { onConflict: "alert_key" });
    if (error) throw error;
  } else if (existing?.status === "open") {
    const { error } = await supabaseAdmin
      .from("observability_alerts")
      .update({
        ...baseRow,
        resolved_at: nowIso,
      })
      .eq("alert_key", rule.key);
    if (error) throw error;
  }

  return {
    key: rule.key,
    previous_status: existing?.status || "none",
    current_status: rule.status,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json(401, { error: "Unauthorized" });
  const token = authHeader.replace("Bearer ", "");

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRole) return json(500, { error: "Missing Supabase env vars" });
  if (token !== serviceRole) return json(401, { error: "Invalid service token" });

  const supabaseAdmin = createClient(supabaseUrl, serviceRole);

  const windowMinutes = envNumber("OBS_ALERT_WINDOW_MINUTES", 15);
  const silenceMinutes = envNumber("OBS_ALERT_SILENCE_MINUTES", 20);
  /** Solo evaluar “silencio de ingest” si hubo al menos un evento en este lookback (evita alarmas en DB vacía / cold start). */
  const silenceBaselineHours = envNumber("OBS_ALERT_SILENCE_BASELINE_HOURS", 168);
  const minEvents = envNumber("OBS_ALERT_MIN_EVENTS", 30);
  const errorRateThreshold = envNumber("OBS_ALERT_ERROR_RATE_THRESHOLD", 0.12);
  const p95MsThreshold = envNumber("OBS_ALERT_P95_MS_THRESHOLD", 3000);

  const sinceWindowIso = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
  const sinceSilenceIso = new Date(Date.now() - silenceMinutes * 60 * 1000).toISOString();
  const sinceSilenceBaselineIso = new Date(Date.now() - silenceBaselineHours * 60 * 60 * 1000).toISOString();

  const { data: windowEvents, error: eventsErr } = await supabaseAdmin
    .from("observability_events")
    .select("event_type, payload, event_ts")
    .gte("event_ts", sinceWindowIso);
  if (eventsErr) return json(500, { error: eventsErr.message });

  const { data: recentEvent, error: recentErr } = await supabaseAdmin
    .from("observability_events")
    .select("event_ts")
    .gte("event_ts", sinceSilenceIso)
    .order("event_ts", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (recentErr) return json(500, { error: recentErr.message });

  const { count: silenceBaselineCount, error: baselineErr } = await supabaseAdmin
    .from("observability_events")
    .select("*", { count: "exact", head: true })
    .gte("event_ts", sinceSilenceBaselineIso);
  if (baselineErr) return json(500, { error: baselineErr.message });

  const hadBaselineIngest = (silenceBaselineCount ?? 0) > 0;

  const totalEvents = windowEvents?.length || 0;
  const totalErrors = (windowEvents || []).filter((e) => e.event_type === "error").length;
  const errorRate = totalEvents > 0 ? totalErrors / totalEvents : 0;
  const hasEnoughEvents = totalEvents >= minEvents;

  const durations = (windowEvents || [])
    .map((e) => {
      const payload = (e.payload || {}) as Record<string, unknown>;
      const raw = payload.duration_ms ?? payload.durationMs;
      const value = Number(raw);
      return Number.isFinite(value) && value > 0 ? value : null;
    })
    .filter((x): x is number => x != null)
    .sort((a, b) => a - b);

  const p95Ms = durations.length
    ? durations[Math.min(durations.length - 1, Math.floor(durations.length * 0.95))]
    : 0;

  const rules: AlertRule[] = [
    {
      key: "obs_error_rate_high",
      metricName: "error_rate",
      severity: "critical",
      status: hasEnoughEvents && errorRate >= errorRateThreshold ? "open" : "resolved",
      metricValue: roundMetric(errorRate),
      thresholdValue: errorRateThreshold,
      windowMinutes,
      details: {
        total_events: totalEvents,
        total_errors: totalErrors,
        min_events: minEvents,
      },
    },
    {
      key: "obs_latency_p95_high",
      metricName: "latency_p95_ms",
      severity: "warning",
      status: durations.length > 0 && p95Ms >= p95MsThreshold ? "open" : "resolved",
      metricValue: Math.round(p95Ms),
      thresholdValue: p95MsThreshold,
      windowMinutes,
      details: {
        samples: durations.length,
      },
    },
    {
      key: "obs_ingest_silence",
      metricName: "ingest_silence",
      severity: "critical",
      status: hadBaselineIngest && !recentEvent ? "open" : "resolved",
      metricValue: recentEvent ? 0 : 1,
      thresholdValue: 1,
      windowMinutes: silenceMinutes,
      details: {
        silence_minutes: silenceMinutes,
        baseline_hours: silenceBaselineHours,
        baseline_event_count: silenceBaselineCount ?? 0,
      },
    },
  ];

  const transitions = [];
  const notifications = [];
  for (const rule of rules) {
    const transition = await upsertAlert(supabaseAdmin, rule);
    transitions.push(transition);
    const meaningfulNotification =
      transition.current_status === "open" ||
      (transition.current_status === "resolved" && transition.previous_status === "open");
    if (meaningfulNotification) {
      notifications.push({
        alert_key: rule.key,
        status: rule.status,
        severity: rule.severity,
        metric_name: rule.metricName,
        metric_value: rule.metricValue,
        threshold_value: rule.thresholdValue,
        details: rule.details,
      });
    }
  }

  if (notifications.length > 0) {
    await notifyWebhook({
      source: "observability-alerts",
      ts: new Date().toISOString(),
      alerts: notifications,
    });
  }

  return json(200, {
    ok: true,
    totals: {
      totalEvents,
      totalErrors,
      errorRate: roundMetric(errorRate),
      p95Ms: Math.round(p95Ms),
      hasRecentEvents: Boolean(recentEvent),
      silenceBaselineCount: silenceBaselineCount ?? 0,
      silenceBaselineHours: silenceBaselineHours,
    },
    transitions,
    notifications_sent: notifications.length,
  });
});
