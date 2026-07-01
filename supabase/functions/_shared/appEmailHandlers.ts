// Handlers compartidos para app-emails y trial-emails (sin Deno.serve).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildClientWelcomeEmail,
  buildStaffWelcomeEmail,
  buildTrialEmail,
  resendConfigured,
  sendResendEmail,
  type AppWelcomeAudience,
  type TrialEmailType,
} from "./fitengineEmail.ts";

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

function displayName(user: { user_metadata?: Record<string, unknown>; email?: string | null }) {
  const meta = user.user_metadata || {};
  return String(meta.full_name || meta.name || user.email?.split("@")[0] || "").trim();
}

async function alreadySentUser(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  emailType: string,
  organizationId?: string | null,
) {
  let q = supabaseAdmin
    .from("app_email_sent")
    .select("id")
    .eq("user_id", userId)
    .eq("email_type", emailType);
  if (organizationId) {
    q = q.eq("organization_id", organizationId);
  } else {
    q = q.is("organization_id", null);
  }
  const { data } = await q.maybeSingle();
  return Boolean(data?.id);
}

async function logSentUser(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  emailType: string,
  recipientEmail: string,
  resendId: string | null,
  organizationId?: string | null,
) {
  await supabaseAdmin.from("app_email_sent").insert({
    user_id: userId,
    email_type: emailType,
    recipient_email: recipientEmail,
    resend_id: resendId,
    organization_id: organizationId || null,
  });
}

async function alreadySentTrial(
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

async function logSentTrial(
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

  return {
    org,
    email: userData.user.email,
    ownerName: displayName(userData.user),
    ownerId: org.owner_id,
  };
}

export async function sendOrgTrialEmail(
  supabaseAdmin: ReturnType<typeof createClient>,
  organizationId: string,
  emailType: TrialEmailType,
) {
  if (!resendConfigured()) {
    return { organizationId, emailType, skipped: true, reason: "resend_not_configured" };
  }
  if (await alreadySentTrial(supabaseAdmin, organizationId, emailType)) {
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

  await logSentTrial(supabaseAdmin, organizationId, emailType, email, sent.id);
  return { organizationId, emailType, ok: true, to: email, resendId: sent.id };
}

async function resolveOrgName(
  supabaseAdmin: ReturnType<typeof createClient>,
  organizationId: string | null | undefined,
) {
  if (!organizationId) return null;
  const { data } = await supabaseAdmin
    .from("organizations")
    .select("name")
    .eq("id", organizationId)
    .maybeSingle();
  return data?.name || null;
}

export async function sendUserWelcome(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  audience: AppWelcomeAudience,
  organizationId?: string | null,
) {
  const emailType =
    audience === "client"
      ? "welcome_client"
      : audience === "staff"
      ? "welcome_staff"
      : audience === "client_joined"
      ? "welcome_client_joined"
      : "welcome_owner_trial";

  if (!resendConfigured()) {
    return { userId, audience, skipped: true, reason: "resend_not_configured" };
  }

  if (audience === "owner_trial") {
    if (!organizationId) return { userId, audience, error: "organization_id_required" };
    const ctx = await getOwnerContext(supabaseAdmin, organizationId);
    if ("error" in ctx) return { userId, audience, error: ctx.error };
    if (ctx.ownerId !== userId) return { userId, audience, error: "not_org_owner" };
    return sendOrgTrialEmail(supabaseAdmin, organizationId, "welcome");
  }

  if (await alreadySentUser(supabaseAdmin, userId, emailType, organizationId)) {
    return { userId, audience, skipped: true, reason: "already_sent" };
  }

  const { data: userData, error: userErr } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (userErr || !userData?.user?.email) {
    return { userId, audience, error: userErr?.message || "email_missing" };
  }

  const name = displayName(userData.user);
  const email = userData.user.email;
  let mail;

  if (audience === "staff") {
    mail = buildStaffWelcomeEmail({ name });
  } else {
    const orgName = await resolveOrgName(supabaseAdmin, organizationId);
    mail = buildClientWelcomeEmail({ name, orgName });
  }

  const sent = await sendResendEmail(email, mail.subject, mail.html);
  if (!sent.ok) {
    return { userId, audience, error: sent.reason, skipped: sent.skipped };
  }

  await logSentUser(supabaseAdmin, userId, emailType, email, sent.id, organizationId);
  return { userId, audience, ok: true, to: email, resendId: sent.id };
}

export async function processTrialReminders(supabaseAdmin: ReturnType<typeof createClient>) {
  const { data: orgs, error } = await supabaseAdmin
    .from("organizations")
    .select("id, trial_expires_at, subscription_status")
    .in("subscription_status", ["trial", "expired"])
    .not("trial_expires_at", "is", null);

  if (error) return { error: error.message };

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
    results.push(await sendOrgTrialEmail(supabaseAdmin, org.id, type));
  }

  return { processed: results.length, results };
}
