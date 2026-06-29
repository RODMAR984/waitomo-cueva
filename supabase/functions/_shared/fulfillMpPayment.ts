import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

function addDaysIsoYmd(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function metaString(payment: Record<string, unknown>, key: string): string {
  const meta = payment.metadata;
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return "";
  const v = (meta as Record<string, unknown>)[key];
  return v != null ? String(v).trim() : "";
}

/**
 * Marca cobro en billing_payments y activa user_abonos cuando MP confirma pago approved.
 */
export async function fulfillMpPayment(
  supabase: SupabaseClient,
  payment: Record<string, unknown>,
): Promise<{ ok: boolean; reason?: string; organization_id?: string | null; plan_id?: string | null }> {
  const status = payment.status;
  if (status !== "approved") {
    return { ok: false, reason: "not_approved" };
  }

  const orgId = metaString(payment, "organization_id");
  const userId = metaString(payment, "member_user_id");
  const planId = metaString(payment, "plan_id");
  const abonoId = metaString(payment, "abono_id");
  const periodo = metaString(payment, "periodo");
  const extRef = String(
    payment.external_reference || metaString(payment, "fitengine_external_ref") || "",
  ).trim();
  const paymentId = String(payment.id || "").trim();
  const amount = Number(payment.transaction_amount ?? 0);
  const currency = String(payment.currency_id ?? "ARS");
  const paidAt = payment.date_approved
    ? new Date(String(payment.date_approved)).toISOString()
    : new Date().toISOString();

  if (orgId && extRef) {
    const { error: billErr } = await supabase.from("billing_payments").upsert(
      {
        organization_id: orgId,
        member_user_id: userId || null,
        client_id: extRef,
        plan_id: planId || null,
        periodo: periodo || null,
        monto: amount,
        moneda: currency,
        metodo: "mercadopago",
        status: "pagado",
        paid_at: paidAt,
      },
      { onConflict: "organization_id,client_id" },
    );
    if (billErr) {
      console.error("fulfillMpPayment billing_payments", billErr.message);
      return { ok: false, reason: "billing_upsert_failed" };
    }
  }

  if (userId && abonoId && planId) {
    const durationDays = Number(metaString(payment, "duration_days") || "30") || 30;
    const rawSessions = metaString(payment, "included_sessions");
    const includedSessions = rawSessions ? Number(rawSessions) : null;
    const startDate = new Date().toISOString().slice(0, 10);
    const endDate = addDaysIsoYmd(durationDays);

    const { data: existing } = await supabase
      .from("user_abonos")
      .select("id")
      .eq("user_id", userId)
      .eq("abono_id", abonoId)
      .eq("status", "active")
      .gte("end_date", startDate)
      .limit(1)
      .maybeSingle();

    if (!existing?.id) {
      const { error: abonoErr } = await supabase.from("user_abonos").insert({
        user_id: userId,
        abono_id: abonoId,
        plan_id: planId,
        status: "active",
        start_date: startDate,
        end_date: endDate,
        sessions_total: includedSessions,
        sessions_used: 0,
      });
      if (abonoErr) {
        console.error("fulfillMpPayment user_abonos", abonoErr.message);
        return { ok: false, reason: "abono_insert_failed" };
      }
    }

    await supabase.from("profiles").update({ plan_actual: planId }).eq("id", userId);

    try {
      await supabase.from("user_plans").upsert(
        { user_id: userId, plan_id: planId, activo: true },
        { onConflict: "user_id,plan_id" },
      );
    } catch {
      /* legacy opcional */
    }
  }

  console.log(
    JSON.stringify({
      source: "mp_fulfill",
      ok: true,
      has_org: Boolean(orgId),
      has_abono: Boolean(abonoId),
      mp_payment_id: paymentId || null,
    }),
  );

  return { ok: true, organization_id: orgId || null, plan_id: planId || null };
}
