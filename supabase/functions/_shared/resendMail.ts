/** Envío transaccional vía Resend (requiere RESEND_API_KEY en secrets de la función). */

export type TrialEmailType = "welcome" | "ending_3d" | "ending_1d" | "expired";

export function resendConfigured(): boolean {
  return Boolean(String(Deno.env.get("RESEND_API_KEY") || "").trim());
}

export function emailFromAddress(): string {
  return (
    String(Deno.env.get("FITENGINE_EMAIL_FROM") || "").trim() ||
    "FitEngine <onboarding@fitengine.app>"
  );
}

export function salesContactEmail(): string {
  return String(Deno.env.get("FITENGINE_SALES_EMAIL") || "").trim() || "ventas@fitengine.app";
}

export function buildTrialEmail(type: TrialEmailType, ctx: {
  ownerName: string;
  orgName: string;
  daysLeft?: number | null;
  trialEndsLabel?: string;
}) {
  const sales = salesContactEmail();
  const name = ctx.ownerName || "Hola";
  const org = ctx.orgName || "tu espacio";
  const ends = ctx.trialEndsLabel || "";

  const subjects: Record<TrialEmailType, string> = {
    welcome: `Bienvenido a FitEngine — ${org}`,
    ending_3d: `Tu prueba FitEngine termina en 3 días`,
    ending_1d: `Mañana termina tu prueba FitEngine`,
    expired: `Tu prueba FitEngine terminó`,
  };

  const bodies: Record<TrialEmailType, string> = {
    welcome: `
      <p>Hola ${escapeHtml(name)},</p>
      <p>Tu espacio <strong>${escapeHtml(org)}</strong> ya está listo con <strong>14 días de prueba gratis</strong>.</p>
      <p>Entrá al panel para configurar planes, horarios y tu marca.${ends ? ` La prueba vence el <strong>${escapeHtml(ends)}</strong>.` : ""}</p>
      <p>Si necesitás ayuda, escribinos a <a href="mailto:${escapeHtml(sales)}">${escapeHtml(sales)}</a>.</p>
      <p>— Equipo FitEngine</p>
    `,
    ending_3d: `
      <p>Hola ${escapeHtml(name)},</p>
      <p>Quedan <strong>3 días</strong> de tu prueba gratis en <strong>${escapeHtml(org)}</strong>.</p>
      <p>Seguí configurando tu gym desde el panel. Para activar tu plan después del trial, contactanos en <a href="mailto:${escapeHtml(sales)}">${escapeHtml(sales)}</a>.</p>
      <p>— Equipo FitEngine</p>
    `,
    ending_1d: `
      <p>Hola ${escapeHtml(name)},</p>
      <p><strong>Mañana</strong> termina tu prueba de FitEngine para <strong>${escapeHtml(org)}</strong>.</p>
      <p>Tus datos se conservan. Escribinos a <a href="mailto:${escapeHtml(sales)}">${escapeHtml(sales)}</a> para seguir usando la plataforma.</p>
      <p>— Equipo FitEngine</p>
    `,
    expired: `
      <p>Hola ${escapeHtml(name)},</p>
      <p>Tu prueba gratis de FitEngine para <strong>${escapeHtml(org)}</strong> finalizó.</p>
      <p>Podés seguir viendo tu información, pero no crear planes, bloques ni cobros hasta activar una suscripción. Contactanos: <a href="mailto:${escapeHtml(sales)}">${escapeHtml(sales)}</a>.</p>
      <p>— Equipo FitEngine</p>
    `,
  };

  return {
    subject: subjects[type],
    html: wrapHtml(bodies[type]),
  };
}

function escapeHtml(s: string) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrapHtml(inner: string) {
  return `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;color:#0f172a;line-height:1.5">${inner}</body></html>`;
}

export async function sendResendEmail(to: string, subject: string, html: string) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    return { ok: false as const, skipped: true, reason: "RESEND_API_KEY missing" };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: emailFromAddress(),
      to: [to],
      subject,
      html,
    }),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false as const, skipped: false, reason: JSON.stringify(payload) };
  }
  return { ok: true as const, id: payload?.id ?? null };
}
