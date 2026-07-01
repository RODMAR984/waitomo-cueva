// Trial SaaS: bienvenida (desde app) + recordatorios por cron (3d, 1d, vencido). Solo email (Resend).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildTrialEmail,
  resendConfigured,
  sendResendEmail,
  type TrialEmailType,
} from "../_shared/resendMail.ts";

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

function daysLeftFromExpires(iso: string | null): number | null {
  if (!iso) return null;
  const end = new Date(iso).getTime();
  if (!Number.isFinite(end)) return null;
  const diff = end - Date.now();
  return Math.ceil(diff / (24 * 60 * 60 * 1000));
}

function formatDateEs(iso: string | null) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("es-AR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return String(iso).slice(0, 10);
  }
}

async function getOwnerContext(
  supabaseAdmin: ReturnType<typeof createClient>,
  organizationId: string,
) {
  const { data: org, error } = await supabaseAdmin
    .from("organizations")
    .select("id, name, owner_id, trial_expires_at, subscription_status")
    .eq("id", organizationId)
    .maybeSingle();
  if (error || !org?.owner_id) return { error: error?.message || "org_not_found" };

  const { data: userData, error: userErr } = await supabaseAdmin.auth.admin.getUserById(
    org.owner_id,
  );
  if (userErr || !userData?.user?.email) {
    return { error: userErr?.message || "owner_email_missing" };
  }

  const meta = userData.user.user_metadata || {};
  const ownerName =
    String(meta.full_name || meta.name || userData.user.email?.split("@")[0] || "").trim();

  return {
    org,
    email: userData.user.email,
    ownerName,
  };
}

async function alreadySent(
  supabaseAdmin: ReturnType<typeof createClient>,
  organizationId: string,
  emailType: TrialEmailType,
) {
  const { data } = await supabaseAdmin
    .from("trial_email_sent")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("email_type", emailType)
    .maybeSingle();
  return Boolean(data?.id);
}

async function logSent(
  supabaseAdmin: ReturnType<typeof createClient>,
  organizationId: string,
  emailType: TrialEmailType,
  recipientEmail: string,
  resendId: string | null,
) {
  await supabaseAdmin.from("trial_email_sent").insert({
    organization_id: organizationId,
    email_type: emailType,
    recipient_email: recipientEmail,
    resend_id: resendId,
  });
}

async function sendOrgEmail(
  supabaseAdmin: ReturnType<typeof createClient>,
  organizationId: string,
  emailType: TrialEmailType,
  force = false,
) {
  if (!resendConfigured()) {
    return { organizationId, emailType, skipped: true, reason: "resend_not_configured" };
  }
  if (!force && (await alreadySent(supabaseAdmin, organizationId, emailType))) {
    return { organizationId, emailType, skipped: true, reason: "already_sent" };
  }

  const ctx = await getOwnerContext(supabaseAdmin, organizationId);
  if ("error" in ctx) {
    return { organizationId, emailType, error: ctx.error };
  }

  const { org, email, ownerName } = ctx;
  const mail = buildTrialEmail(emailType, {
    ownerName,
    orgName: org.name,
    daysLeft: daysLeftFromExpires(org.trial_expires_at),
    trialEndsLabel: formatDateEs(org.trial_expires_at),
  });

  const sent = await sendResendEmail(email, mail.subject, mail.html);
  if (!sent.ok) {
    return { organizationId, emailType, error: sent.reason, skipped: sent.skipped };
  }

  if (!force) {
    await logSent(supabaseAdmin, organizationId, emailType, email, sent.id);
  }

  return { organizationId, emailType, ok: true, to: email, resendId: sent.id };
}

async function handleWelcome(
  supabaseAdmin: ReturnType<typeof createClient>,
  organizationId: string,
  userId: string,
) {
  const ctx = await getOwnerContext(supabaseAdmin, organizationId);
  if ("error" in ctx) return json(400, { error: ctx.error });
  if (ctx.org.owner_id !== userId) {
    return json(403, { error: "not_org_owner" });
  }
  const result = await sendOrgEmail(supabaseAdmin, organizationId, "welcome");
  return json(result.ok ? 200 : 502, result);
}

async function handleProcessReminders(supabaseAdmin: ReturnType<typeof createClient>) {
  const { data: orgs, error } = await supabaseAdmin
    .from("organizations")
    .select("id, trial_expires_at, subscription_status")
    .in("subscription_status", ["trial", "expired"])
    .not("trial_expires_at", "is", null);

  if (error) return json(500, { error: error.message });

  const results: unknown[] = [];
  for (const org of orgs || []) {
    const left = daysLeftFromExpires(org.trial_expires_at);
    let type: TrialEmailType | null = null;
    if (org.subscription_status === "expired" || (left != null && left <= 0)) {
      type = "expired";
    } else if (left === 3) {
      type = "ending_3d";
    } else if (left === 1) {
      type = "ending_1d";
    }
    if (!type) continue;
    results.push(await sendOrgEmail(supabaseAdmin, org.id, type));
  }

  return json(200, { processed: results.length, results });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }
  if (req.method !== "POST") {
    return json(405, { error: "method_not_allowed" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const supabaseAdmin = createClient(supabaseUrl, serviceKey);

  let body: { action?: string; organizationId?: string } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const action = String(body.action || "");

  if (action === "process_reminders") {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token || token !== serviceKey) {
      return json(401, { error: "service_role_required" });
    }
    return handleProcessReminders(supabaseAdmin);
  }

  if (action === "welcome") {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json(401, { error: "missing_auth" });
    }
    const token = authHeader.replace("Bearer ", "");
    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await supabaseUser.auth.getUser(token);
    if (userErr || !userData?.user?.id) {
      return json(401, { error: "invalid_token" });
    }
    const organizationId = String(body.organizationId || "").trim();
    if (!organizationId) {
      return json(400, { error: "organization_id_required" });
    }
    return handleWelcome(supabaseAdmin, organizationId, userData.user.id);
  }

  return json(400, { error: "unknown_action" });
});
