// Hook Send Email de Supabase Auth: confirmación, recuperación y bienvenida (Resend).
// Dashboard → Authentication → Hooks → Send Email
// URL: https://nfjjkvjsssgxxsuocmhj.supabase.co/functions/v1/auth-send-email
// Secret: SEND_EMAIL_HOOK_SECRET (mismo en secrets de la función)

import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";
import {
  buildAuthRecoveryEmail,
  buildAuthSignupConfirmEmail,
  resendConfigured,
  sendResendEmail,
} from "../_shared/fitengineEmail.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, content-type, x-client-info, apikey, webhook-id, webhook-timestamp, webhook-signature",
};

function json(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function signupRole(user: { user_metadata?: Record<string, unknown> }): "client" | "staff" | "unknown" {
  const role = String(user?.user_metadata?.role || "").toLowerCase();
  if (role === "coach" || role === "admin" || role === "superadmin") return "staff";
  if (role === "cliente" || role === "client") return "client";
  const intent = String(user?.user_metadata?.signup_intent || "").toLowerCase();
  if (intent === "staff" || intent === "coach") return "staff";
  return "client";
}

function displayName(user: { user_metadata?: Record<string, unknown>; email?: string | null }) {
  const meta = user.user_metadata || {};
  return String(meta.full_name || meta.name || user.email?.split("@")[0] || "").trim();
}

function buildVerifyUrl(
  emailData: {
    token_hash?: string;
    token?: string;
    redirect_to?: string;
    email_action_type?: string;
  },
) {
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
  const tokenHash = String(emailData.token_hash || emailData.token || "");
  const actionType = String(emailData.email_action_type || "signup");
  const redirectTo = String(
    emailData.redirect_to || Deno.env.get("FITENGINE_WEB_APP_URL") || "https://app.fitengine.app/",
  );
  return `${supabaseUrl}/auth/v1/verify?token=${encodeURIComponent(tokenHash)}&type=${encodeURIComponent(actionType)}&redirect_to=${encodeURIComponent(redirectTo)}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }
  if (req.method !== "POST") {
    return json(405, { error: "method_not_allowed" });
  }

  const hookSecret = Deno.env.get("SEND_EMAIL_HOOK_SECRET") || "";
  const raw = await req.text();

  let payload: {
    user?: { email?: string; user_metadata?: Record<string, unknown> };
    email_data?: {
      token?: string;
      token_hash?: string;
      redirect_to?: string;
      email_action_type?: string;
      site_url?: string;
    };
  };

  try {
    if (hookSecret) {
      const wh = new Webhook(hookSecret);
      payload = wh.verify(raw, Object.fromEntries(req.headers)) as typeof payload;
    } else {
      payload = JSON.parse(raw);
    }
  } catch (e) {
    return json(401, { error: "invalid_hook_signature", detail: String(e) });
  }

  const user = payload.user || {};
  const emailData = payload.email_data || {};
  const actionType = String(emailData.email_action_type || "");
  const to = String(user?.email || "").trim();

  if (!to) {
    return json(400, { error: "missing_recipient" });
  }

  if (!resendConfigured()) {
    return json(503, { error: "resend_not_configured" });
  }

  const actionUrl = buildVerifyUrl(emailData);
  const name = displayName(user);

  let mail: { subject: string; html: string } | null = null;

  if (actionType === "signup") {
    const role = signupRole(user);
    mail = buildAuthSignupConfirmEmail({
      name,
      confirmUrl: actionUrl,
      role: role === "unknown" ? "client" : role,
    });
  } else if (actionType === "recovery") {
    mail = buildAuthRecoveryEmail({ name, actionUrl });
  } else {
    return json(200, { skipped: true, reason: "unsupported_action", actionType });
  }

  const sent = await sendResendEmail(to, mail.subject, mail.html);
  if (!sent.ok) {
    return json(502, { error: sent.reason, skipped: sent.skipped });
  }

  return json(200, {});
});
