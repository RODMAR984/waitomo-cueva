// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
};

type Severity = "info" | "warning" | "critical";
type Status = "open" | "resolved";

type RuleResult = {
  alertKey: string;
  alertType: string;
  status: Status;
  severity: Severity;
  title: string;
  body: string;
  ctaLabel?: string | null;
  ctaRoute?: string | null;
  metricValue?: number | null;
  baselineValue?: number | null;
  details?: Record<string, unknown>;
};

function json(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function ymdDate(iso: string): string {
  return String(iso || "").slice(0, 10);
}

function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = String(ymd).split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + days);
  return dt.toISOString().slice(0, 10);
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function todayYmdInTimeZone(timeZone: string | null | undefined): string {
  const tz = String(timeZone || "").trim() || "UTC";
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const y = parts.find((p) => p.type === "year")?.value;
    const m = parts.find((p) => p.type === "month")?.value;
    const d = parts.find((p) => p.type === "day")?.value;
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch {}
  return new Date().toISOString().slice(0, 10);
}

async function upsertAlertForOrg(
  supabaseAdmin: ReturnType<typeof createClient>,
  organizationId: string,
  rule: RuleResult,
) {
  const nowIso = new Date().toISOString();
  const { data: existing, error: existingErr } = await supabaseAdmin
    .from("admin_ai_alerts")
    .select("id, status")
    .eq("organization_id", organizationId)
    .eq("alert_key", rule.alertKey)
    .maybeSingle();
  if (existingErr) throw existingErr;

  const baseRow = {
    organization_id: organizationId,
    alert_key: rule.alertKey,
    alert_type: rule.alertType,
    status: rule.status,
    severity: rule.severity,
    title: rule.title,
    body: rule.body,
    cta_label: rule.ctaLabel ?? null,
    cta_route: rule.ctaRoute ?? null,
    metric_value: rule.metricValue ?? null,
    baseline_value: rule.baselineValue ?? null,
    details: rule.details ?? {},
  };

  if (rule.status === "open") {
    const row = {
      ...baseRow,
      observed_at: nowIso,
      resolved_at: null,
      ...(existing?.status !== "open" ? { last_notified_at: nowIso } : {}),
    };
    const { error } = await supabaseAdmin
      .from("admin_ai_alerts")
      .upsert(row, { onConflict: "organization_id,alert_key" });
    if (error) throw error;
  } else if (existing?.status === "open") {
    const { error } = await supabaseAdmin
      .from("admin_ai_alerts")
      .update({
        ...baseRow,
        resolved_at: nowIso,
      })
      .eq("organization_id", organizationId)
      .eq("alert_key", rule.alertKey);
    if (error) throw error;
  }
}

async function analyzeOrganization(
  supabaseAdmin: ReturnType<typeof createClient>,
  organizationId: string,
): Promise<RuleResult[]> {
  const { data: orgRow, error: orgErr } = await supabaseAdmin
    .from("organizations")
    .select("timezone, billing_currency")
    .eq("id", organizationId)
    .maybeSingle();
  if (orgErr) throw orgErr;
  const orgTimezone = String(orgRow?.timezone || "UTC").trim();
  const orgCurrency = String(orgRow?.billing_currency || "ARS").trim().toUpperCase();
  const today = todayYmdInTimeZone(orgTimezone);
  const monthStart = `${today.slice(0, 8)}01`;
  const trailing60Start = addDaysYmd(today, -60);
  const last30Start = addDaysYmd(today, -29);
  const last7Start = addDaysYmd(today, -6);
  const prev28Start = addDaysYmd(today, -34);
  const prev28End = addDaysYmd(today, -7);
  const next14 = addDaysYmd(today, 14);
  const next7 = addDaysYmd(today, 7);

  const [
    attendedLast7Res,
    attendedPrev28Res,
    blocksUpcomingRes,
    bookingsUpcomingRes,
    orgAbonosRes,
    billingRes,
    billingTrailingRes,
    bookingsRiskRes,
  ] = await Promise.all([
    supabaseAdmin
      .from("class_bookings")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "completed_attended")
      .gte("session_date", last7Start)
      .lte("session_date", today),
    supabaseAdmin
      .from("class_bookings")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "completed_attended")
      .gte("session_date", prev28Start)
      .lte("session_date", prev28End),
    supabaseAdmin
      .from("training_daily_blocks")
      .select("id, plan_key, slot_label, capacity, fecha")
      .eq("organization_id", organizationId)
      .gte("fecha", today)
      .lte("fecha", next14),
    supabaseAdmin
      .from("class_bookings")
      .select("id, plan_key, slot_label, session_date")
      .eq("organization_id", organizationId)
      .eq("status", "scheduled")
      .gte("session_date", today)
      .lte("session_date", next14),
    supabaseAdmin.from("abonos").select("id").eq("organization_id", organizationId),
    supabaseAdmin
      .from("billing_payments")
      .select("status, monto, paid_at, created_at")
      .eq("organization_id", organizationId)
      .gte("created_at", `${monthStart}T00:00:00.000Z`),
    supabaseAdmin
      .from("billing_payments")
      .select("status, monto, paid_at, created_at")
      .eq("organization_id", organizationId)
      .gte("created_at", `${trailing60Start}T00:00:00.000Z`),
    supabaseAdmin
      .from("class_bookings")
      .select("status")
      .eq("organization_id", organizationId)
      .gte("session_date", last30Start)
      .lte("session_date", today),
  ]);

  if (attendedLast7Res.error) throw attendedLast7Res.error;
  if (attendedPrev28Res.error) throw attendedPrev28Res.error;
  if (blocksUpcomingRes.error) throw blocksUpcomingRes.error;
  if (bookingsUpcomingRes.error) throw bookingsUpcomingRes.error;
  if (orgAbonosRes.error) throw orgAbonosRes.error;
  if (billingRes.error) throw billingRes.error;
  if (billingTrailingRes.error) throw billingTrailingRes.error;
  if (bookingsRiskRes.error) throw bookingsRiskRes.error;

  const attendedLast7 = attendedLast7Res.count ?? 0;
  const attendedPrev28 = attendedPrev28Res.count ?? 0;
  const baselineWeekly = attendedPrev28 / 4;
  const dropPct = baselineWeekly > 0 ? (baselineWeekly - attendedLast7) / baselineWeekly : 0;

  const lowAttendanceRule: RuleResult = {
    alertKey: "attendance_drop_week",
    alertType: "attendance_anomaly",
    status:
      baselineWeekly >= 8 && attendedLast7 <= baselineWeekly * 0.7
        ? "open"
        : "resolved",
    severity: "warning",
    title: "Asistencia semanal por debajo de lo habitual",
    body:
      baselineWeekly > 0
        ? `Esta semana hubo ${attendedLast7} asistencias, frente a un promedio semanal previo de ${round2(
            baselineWeekly,
          )} (${Math.max(0, Math.round(dropPct * 100))}% menos). Revisá feriados, cambios de grilla y comunicación.`
        : "Todavía no hay baseline suficiente para comparar asistencia semanal.",
    ctaLabel: "Ver resumen",
    ctaRoute: "AdminResumen",
    metricValue: attendedLast7,
    baselineValue: round2(baselineWeekly),
    details: {
      attended_last_7_days: attendedLast7,
      attended_prev_28_days: attendedPrev28,
      baseline_weekly_avg: round2(baselineWeekly),
      drop_pct: round2(dropPct),
    },
  };

  const capFallback = Number(Deno.env.get("ADMIN_AI_CAPACITY_FALLBACK") || 10);
  const slotsMap = new Map<string, { cap: number; booked: number; key: string }>();
  for (const b of blocksUpcomingRes.data || []) {
    const k = `${b.fecha}|${String(b.plan_key || "")}|${String(b.slot_label || "")}`;
    const cap = Number(b.capacity);
    slotsMap.set(k, {
      cap: Number.isFinite(cap) && cap > 0 ? cap : capFallback,
      booked: 0,
      key: k,
    });
  }
  for (const r of bookingsUpcomingRes.data || []) {
    const k = `${r.session_date}|${String(r.plan_key || "")}|${String(r.slot_label || "")}`;
    const row = slotsMap.get(k);
    if (row) row.booked += 1;
  }
  const lowSlots = [...slotsMap.entries()]
    .map(([k, v]) => ({ k, occ: v.booked / Math.max(1, v.cap), ...v }))
    .filter((x) => x.occ < 0.3)
    .sort((a, b) => a.occ - b.occ);

  const lowOccRule: RuleResult = {
    alertKey: "low_occupancy_slots",
    alertType: "proactive_capacity",
    status: lowSlots.length >= 3 ? "open" : "resolved",
    severity: "info",
    title: "Franjas con baja ocupación",
    body:
      lowSlots.length >= 3
        ? `Se detectaron ${lowSlots.length} bloques próximos con ocupación menor al 30%. Podés lanzar promo dirigida o mover horarios con baja demanda.`
        : "No hay señales fuertes de baja ocupación para los próximos días.",
    ctaLabel: "Ver planes",
    ctaRoute: "AdminPlanes",
    metricValue: lowSlots.length,
    baselineValue: 3,
    details: {
      low_slots_count: lowSlots.length,
      sample_low_slots: lowSlots.slice(0, 5).map((s) => ({
        slot_key: s.k,
        booked: s.booked,
        capacity: s.cap,
        occupancy: round2(s.occ),
      })),
    },
  };

  const orgAbonoIds = (orgAbonosRes.data || []).map((a) => a.id).filter(Boolean);
  let expiringCount = 0;
  if (orgAbonoIds.length) {
    const { count, error } = await supabaseAdmin
      .from("user_abonos")
      .select("id", { count: "exact", head: true })
      .in("abono_id", orgAbonoIds)
      .eq("status", "active")
      .gte("end_date", today)
      .lte("end_date", next7);
    if (error) throw error;
    expiringCount = count ?? 0;
  }

  const renewalsRule: RuleResult = {
    alertKey: "renewals_due_7_days",
    alertType: "proactive_renewal",
    status: expiringCount >= 5 ? "open" : "resolved",
    severity: "warning",
    title: "Abonos por vencer en 7 días",
    body:
      expiringCount >= 5
        ? `Hay ${expiringCount} abonos activos que vencen esta semana. Buen momento para mensajes de renovación y seguimiento personalizado.`
        : "No hay volumen alto de vencimientos esta semana.",
    ctaLabel: "Ver abonos",
    ctaRoute: "AdminAbonos",
    metricValue: expiringCount,
    baselineValue: 5,
    details: {
      expiring_active_subscriptions_7_days: expiringCount,
      window_end: next7,
    },
  };

  const billingRows = Array.isArray(billingRes.data) ? billingRes.data : [];
  const trailingRows = Array.isArray(billingTrailingRes.data) ? billingTrailingRes.data : [];
  const riskRows = Array.isArray(bookingsRiskRes.data) ? bookingsRiskRes.data : [];
  let paidMtd = 0;
  let pendingAmount = 0;
  let pendingCount = 0;
  for (const p of billingRows) {
    const st = String(p.status || "").toLowerCase().trim();
    const amount = Number(p.monto || 0);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    if (st === "pagado" || st === "paid") {
      paidMtd += amount;
    } else {
      pendingCount += 1;
      pendingAmount += amount;
    }
  }
  // Ratio histórico de efectividad de cobro (últimos 60 días): pagado / (pagado + pendiente)
  let trailingPaid = 0;
  let trailingPending = 0;
  for (const p of trailingRows) {
    const st = String(p.status || "").toLowerCase().trim();
    const amount = Number(p.monto || 0);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    if (st === "pagado" || st === "paid") trailingPaid += amount;
    else trailingPending += amount;
  }
  const denom = trailingPaid + trailingPending;
  const historicalCollectionRate = denom > 0 ? trailingPaid / denom : 0.6;
  let noShow30 = 0;
  let canceled30 = 0;
  let attended30 = 0;
  for (const b of riskRows) {
    const st = String((b as { status?: string }).status || "").toLowerCase().trim();
    if (st === "no_show" || st === "noshow") noShow30 += 1;
    else if (st === "cancelled" || st === "canceled") canceled30 += 1;
    else if (st === "completed_attended") attended30 += 1;
  }
  const bookings30 = noShow30 + canceled30 + attended30;
  const frictionRate30 = bookings30 > 0 ? (noShow30 + canceled30) / bookings30 : 0;
  const attendanceDropPenalty = dropPct > 0.2 ? Math.min(0.12, dropPct * 0.2) : 0;
  const behaviorPenalty = Math.min(0.15, frictionRate30 * 0.25) + attendanceDropPenalty;
  const probableRate = Math.min(0.9, Math.max(0.35, historicalCollectionRate - behaviorPenalty));
  const pessimisticRate = Math.max(0.25, probableRate - 0.15);
  const optimisticRate = Math.min(0.98, probableRate + 0.15);

  const forecastPessimistic = paidMtd + pendingAmount * pessimisticRate;
  const forecastProbable = paidMtd + pendingAmount * probableRate;
  const forecastOptimistic = paidMtd + pendingAmount * optimisticRate;
  const forecastRule: RuleResult = {
    alertKey: "revenue_forecast_mtd",
    alertType: "revenue_forecast",
    status: pendingCount >= 8 ? "open" : "resolved",
    severity: "info",
    title: "Proyección rápida de ingresos del mes",
    body:
      pendingCount >= 8
        ? `Cobrado MTD: ${Math.round(paidMtd)}. Pendiente: ${pendingCount} cobros por ${Math.round(
            pendingAmount,
          )} ${orgCurrency}. Escenarios: pesimista ${Math.round(forecastPessimistic)}, probable ${Math.round(
            forecastProbable,
          )}, optimista ${Math.round(forecastOptimistic)} (${orgCurrency}). Riesgo operativo (30d): no-show/cancel ${Math.round(
            frictionRate30 * 100,
          )}%${dropPct > 0.2 ? ` y caída de asistencia ${Math.round(dropPct * 100)}%` : ""}.`
        : "No hay suficiente volumen pendiente para alertar proyección este mes.",
    ctaLabel: "Ver finanzas",
    ctaRoute: "AdminFinanzas",
    metricValue: round2(forecastProbable),
    baselineValue: round2(paidMtd),
    details: {
      paid_mtd: round2(paidMtd),
      pending_count: pendingCount,
      pending_amount: round2(pendingAmount),
      historical_collection_rate_60d: round2(historicalCollectionRate),
      rate_pessimistic: round2(pessimisticRate),
      rate_probable: round2(probableRate),
      rate_optimistic: round2(optimisticRate),
      no_show_30d: noShow30,
      canceled_30d: canceled30,
      attended_30d: attended30,
      friction_rate_30d: round2(frictionRate30),
      attendance_drop_pct_7d_vs_baseline: round2(dropPct),
      behavior_penalty: round2(behaviorPenalty),
      organization_timezone: orgTimezone,
      billing_currency: orgCurrency,
      forecast_pessimistic: round2(forecastPessimistic),
      forecast_probable: round2(forecastProbable),
      forecast_optimistic: round2(forecastOptimistic),
    },
  };

  return [lowAttendanceRule, lowOccRule, renewalsRule, forecastRule];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json(401, { error: "Unauthorized" });
  const token = authHeader.replace("Bearer ", "");

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !supabaseAnonKey || !serviceRole) {
    return json(500, { error: "Missing Supabase env vars" });
  }

  const isServiceToken = token === serviceRole;
  const supabaseAdmin = createClient(supabaseUrl, serviceRole);
  const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const orgIdFilter = String(body?.organization_id || "").trim() || null;

  if (!isServiceToken) {
    if (!orgIdFilter) {
      return json(400, { error: "organization_id required for user token" });
    }
    const { data: userData, error: userErr } = await supabaseAnon.auth.getUser(token);
    const uid = userData?.user?.id;
    if (userErr || !uid) return json(401, { error: "Invalid token" });

    const { data: member, error: memberErr } = await supabaseAdmin
      .from("organization_memberships")
      .select("organization_id, role, active")
      .eq("organization_id", orgIdFilter)
      .eq("user_id", uid)
      .eq("active", true)
      .in("role", ["owner", "admin", "coach", "superadmin"])
      .limit(1)
      .maybeSingle();
    if (memberErr) return json(500, { error: memberErr.message });
    if (!member) return json(403, { error: "forbidden" });
  }

  let orgQuery = supabaseAdmin
    .from("organizations")
    .select("id")
    .eq("active", true)
    .order("created_at", { ascending: true })
    .limit(2000);
  if (orgIdFilter) orgQuery = orgQuery.eq("id", orgIdFilter);

  const { data: orgRows, error: orgErr } = await orgQuery;
  if (orgErr) return json(500, { error: orgErr.message });

  const results: Array<Record<string, unknown>> = [];
  for (const org of orgRows || []) {
    const orgId = String(org.id || "");
    if (!orgId) continue;
    try {
      const rules = await analyzeOrganization(supabaseAdmin, orgId);
      for (const rule of rules) {
        await upsertAlertForOrg(supabaseAdmin, orgId, rule);
      }
      results.push({
        organization_id: orgId,
        rules: rules.map((r) => ({ key: r.alertKey, status: r.status, severity: r.severity })),
      });
    } catch (e) {
      results.push({
        organization_id: orgId,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return json(200, {
    ok: true,
    organizations: results.length,
    results,
  });
});
