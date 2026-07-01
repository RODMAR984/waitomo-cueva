// Emails transaccionales FitEngine: bienvenidas (cliente, staff, trial, unión a gym) + recordatorios trial.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { processTrialReminders, sendUserWelcome } from "../_shared/appEmailHandlers.ts";
import type { AppWelcomeAudience } from "../_shared/fitengineEmail.ts";

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

  let body: {
    action?: string;
    audience?: string;
    organizationId?: string;
  } = {};
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
    const result = await processTrialReminders(supabaseAdmin);
    if ("error" in result) return json(500, result);
    return json(200, result);
  }

  if (action === "welcome" || action === "welcome_owner_trial") {
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

    const organizationId = String(body.organizationId || "").trim() || null;
    let audience = String(body.audience || "").trim() as AppWelcomeAudience;

    if (action === "welcome_owner_trial") {
      if (!organizationId) return json(400, { error: "organization_id_required" });
      audience = "owner_trial";
    } else if (organizationId && (!audience || audience === "client")) {
      audience = "client_joined";
    }
    if (!audience) audience = "client";

    const result = await sendUserWelcome(
      supabaseAdmin,
      userData.user.id,
      audience,
      organizationId,
    );
    return json(result.ok ? 200 : result.skipped ? 200 : 502, result);
  }

  return json(400, { error: "unknown_action" });
});
