/** Plantillas y envío transaccional FitEngine vía Resend. */

export type TrialEmailType = "welcome" | "ending_3d" | "ending_1d" | "expired";
export type AppWelcomeAudience = "client" | "staff" | "owner_trial" | "client_joined";

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

export function supportContactEmail(): string {
  return String(Deno.env.get("FITENGINE_SUPPORT_EMAIL") || "").trim() || "soporte@fitengine.app";
}

export function appWebUrl(): string {
  return (String(Deno.env.get("FITENGINE_WEB_APP_URL") || "").trim() || "https://app.fitengine.app")
    .replace(/\/$/, "");
}

export function marketingUrl(): string {
  return (String(Deno.env.get("FITENGINE_LINKS_BASE_URL") || "").trim() || "https://fitengine.app")
    .replace(/\/$/, "");
}

function escapeHtml(s: string) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stepsList(items: string[]) {
  const lis = items.map((t) => `<li style="margin:0 0 8px">${escapeHtml(t)}</li>`).join("");
  return `<ul style="margin:12px 0;padding-left:20px;color:#334155">${lis}</ul>`;
}

export function wrapFitEngineEmail(opts: {
  preheader?: string;
  title: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footerNote?: string;
}) {
  const app = appWebUrl();
  const support = supportContactEmail();
  const cta = opts.ctaLabel && opts.ctaUrl
    ? `<p style="margin:24px 0"><a href="${escapeHtml(opts.ctaUrl)}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">${escapeHtml(opts.ctaLabel)}</a></p>`
    : "";
  const preheader = opts.preheader
    ? `<span style="display:none;max-height:0;overflow:hidden">${escapeHtml(opts.preheader)}</span>`
    : "";

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:system-ui,-apple-system,sans-serif;color:#0f172a;line-height:1.55">
${preheader}
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px"><tr><td align="center">
<table width="100%" style="max-width:560px;background:#fff;border-radius:12px;border:1px solid #e2e8f0;padding:28px 24px">
<tr><td>
<p style="margin:0 0 4px;font-size:13px;font-weight:700;letter-spacing:0.04em;color:#64748b">FITENGINE</p>
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3">${escapeHtml(opts.title)}</h1>
${opts.bodyHtml}
${cta}
<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>
<p style="margin:0;font-size:13px;color:#64748b">
App: <a href="${escapeHtml(app)}" style="color:#2563eb">${escapeHtml(app)}</a><br/>
Soporte: <a href="mailto:${escapeHtml(support)}" style="color:#2563eb">${escapeHtml(support)}</a>
</p>
${opts.footerNote ? `<p style="margin:12px 0 0;font-size:12px;color:#94a3b8">${escapeHtml(opts.footerNote)}</p>` : ""}
</td></tr></table>
</td></tr></table>
</body></html>`;
}

export function buildClientWelcomeEmail(ctx: { name: string; orgName?: string | null }) {
  const name = ctx.name || "Hola";
  const org = ctx.orgName?.trim();
  const title = org ? `Ya estás en ${org}` : "Bienvenido a FitEngine";
  const intro = org
    ? `Tu cuenta en <strong>${escapeHtml(org)}</strong> está lista.`
    : "Tu cuenta de socio está creada en FitEngine.";

  const body = `
    <p>Hola ${escapeHtml(name)},</p>
    <p>${intro}</p>
    <p><strong>Qué podés hacer ahora:</strong></p>
    ${stepsList([
      "Reservar clases y ver el calendario de tu gym.",
      "Seguir tu rutina y registrar entrenamientos.",
      "Gestionar tu abono o pase cuando tu espacio lo habilite.",
      "Si tenés un código de invitación, unilo desde la app en «Unirme con código».",
    ])}
    <p>Si no ves tu gym todavía, pedile al coach el link o código <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px">fitengine.app/join</code>.</p>
  `;

  return {
    subject: org ? `Bienvenido a ${org} — FitEngine` : "Bienvenido a FitEngine",
    html: wrapFitEngineEmail({
      preheader: "Tu cuenta está lista. Entrá a la app y reservá tu primera clase.",
      title,
      bodyHtml: body,
      ctaLabel: "Abrir FitEngine",
      ctaUrl: appWebUrl(),
    }),
  };
}

export function buildStaffWelcomeEmail(ctx: { name: string }) {
  const name = ctx.name || "Hola";
  const body = `
    <p>Hola ${escapeHtml(name)},</p>
    <p>Tu cuenta de <strong>staff / coach</strong> en FitEngine fue creada.</p>
    <p><strong>Próximos pasos:</strong></p>
    ${stepsList([
      "Iniciá sesión con el email y la contraseña que elegiste.",
      "Configurá tu espacio (nombre, marca y datos del gym).",
      "Administrá el panel desde el navegador en app.fitengine.app (recomendado en desktop).",
      "Invitá socios con el código o link de tu gym.",
    ])}
    <p>El panel completo de administración funciona en la web; en la app móvil nativa el acceso staff es limitado por diseño.</p>
  `;

  return {
    subject: "Bienvenido al equipo FitEngine — configurá tu espacio",
    html: wrapFitEngineEmail({
      preheader: "Tu cuenta coach está lista. Entrá al panel y configurá tu gym.",
      title: "Cuenta staff creada",
      bodyHtml: body,
      ctaLabel: "Ir al panel",
      ctaUrl: appWebUrl(),
    }),
  };
}

export function buildAuthRecoveryEmail(ctx: { name: string; actionUrl: string }) {
  const name = ctx.name || "Hola";
  const body = `
    <p>Hola ${escapeHtml(name)},</p>
    <p>Recibimos un pedido para restablecer la contraseña de tu cuenta FitEngine.</p>
    <p>Si fuiste vos, usá el botón de abajo. El enlace expira en breve por seguridad.</p>
    <p>Si no pediste este cambio, ignorá este email — tu contraseña no se modificará.</p>
  `;
  return {
    subject: "Restablecer contraseña — FitEngine",
    html: wrapFitEngineEmail({
      preheader: "Enlace para crear una nueva contraseña en FitEngine.",
      title: "Nueva contraseña",
      bodyHtml: body,
      ctaLabel: "Restablecer contraseña",
      ctaUrl: ctx.actionUrl,
      footerNote: "Por seguridad, no compartas este enlace.",
    }),
  };
}

export function buildAuthSignupConfirmEmail(ctx: {
  name: string;
  confirmUrl: string;
  role: "client" | "staff" | "unknown";
}) {
  const name = ctx.name || "Hola";
  const isStaff = ctx.role === "staff";
  const roleSteps = isStaff
    ? [
        "Confirmá tu email con el botón de abajo.",
        "Iniciá sesión y completá la configuración de tu espacio.",
        "Invitá socios cuando tengas tu código de gym.",
      ]
    : [
        "Confirmá tu email con el botón de abajo.",
        "Unite a tu gym con el código que te dio tu coach (o desde el link de invitación).",
        "Reservá clases y seguí tu rutina desde la app.",
      ];

  const body = `
    <p>Hola ${escapeHtml(name)},</p>
    <p>Gracias por registrarte en <strong>FitEngine</strong>${isStaff ? " como staff/coach" : ""}.</p>
    <p>Para activar tu cuenta, confirmá tu email. Después podés entrar a la app con tu contraseña.</p>
    <p><strong>Después de confirmar:</strong></p>
    ${stepsList(roleSteps)}
  `;

  return {
    subject: isStaff
      ? "Confirmá tu email — FitEngine para coaches"
      : "Confirmá tu email — Bienvenido a FitEngine",
    html: wrapFitEngineEmail({
      preheader: "Confirmá tu email para empezar a usar FitEngine.",
      title: "Confirmá tu cuenta",
      bodyHtml: body,
      ctaLabel: "Confirmar email",
      ctaUrl: ctx.confirmUrl,
      footerNote: "Si no creaste esta cuenta, ignorá este mensaje.",
    }),
  };
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
  const app = appWebUrl();

  const subjects: Record<TrialEmailType, string> = {
    welcome: `Bienvenido a FitEngine — ${org}`,
    ending_3d: `Tu prueba FitEngine termina en 3 días`,
    ending_1d: `Mañana termina tu prueba FitEngine`,
    expired: `Tu prueba FitEngine terminó`,
  };

  const trialSteps = [
    "Completá el perfil de tu gym (marca, horarios, ubicación).",
    "Creá planes, bloques de entrenamiento y clases.",
    "Invitá socios con tu link o código de gym.",
    "Conectá cobros (Mercado Pago / Stripe) cuando quieras activar ventas.",
  ];

  let title = "";
  let body = "";
  let ctaLabel = "Abrir panel";
  let ctaUrl = app;
  let preheader = "";

  switch (type) {
    case "welcome":
      title = `Tu prueba de 14 días empezó`;
      preheader = `14 días gratis para configurar ${org}.`;
      body = `
        <p>Hola ${escapeHtml(name)},</p>
        <p><strong>${escapeHtml(org)}</strong> ya está en FitEngine con <strong>14 días de prueba gratis</strong>${ends ? ` (vence el <strong>${escapeHtml(ends)}</strong>)` : ""}.</p>
        <p><strong>Empezá por acá:</strong></p>
        ${stepsList(trialSteps)}
        <p>Durante el trial tenés acceso al panel para configurar todo. Al terminar, contactá ventas para activar tu plan: <a href="mailto:${escapeHtml(sales)}">${escapeHtml(sales)}</a>.</p>
      `;
      break;
    case "ending_3d":
      title = "Quedan 3 días de prueba";
      preheader = "Tu trial termina en 3 días.";
      body = `
        <p>Hola ${escapeHtml(name)},</p>
        <p>Quedan <strong>3 días</strong> de prueba gratis en <strong>${escapeHtml(org)}</strong>.</p>
        <p>Aprovechá para terminar de configurar planes, horarios e invitaciones. Para seguir después del trial: <a href="mailto:${escapeHtml(sales)}">${escapeHtml(sales)}</a>.</p>
      `;
      break;
    case "ending_1d":
      title = "Mañana termina tu prueba";
      preheader = "Último día de trial.";
      body = `
        <p>Hola ${escapeHtml(name)},</p>
        <p><strong>Mañana</strong> termina tu prueba de FitEngine para <strong>${escapeHtml(org)}</strong>.</p>
        <p>Tus datos se conservan. Escribinos a <a href="mailto:${escapeHtml(sales)}">${escapeHtml(sales)}</a> para activar tu suscripción.</p>
      `;
      break;
    case "expired":
      title = "Tu prueba finalizó";
      preheader = "Trial vencido — activá tu plan para seguir editando.";
      body = `
        <p>Hola ${escapeHtml(name)},</p>
        <p>Tu prueba gratis de FitEngine para <strong>${escapeHtml(org)}</strong> finalizó.</p>
        <p>Podés seguir viendo tu información, pero no crear planes, bloques ni cobros hasta activar una suscripción.</p>
        <p>Contacto comercial: <a href="mailto:${escapeHtml(sales)}">${escapeHtml(sales)}</a>.</p>
      `;
      ctaLabel = "Ver panel";
      break;
  }

  return {
    subject: subjects[type],
    html: wrapFitEngineEmail({
      preheader,
      title,
      bodyHtml: body,
      ctaLabel,
      ctaUrl,
    }),
  };
}

/** Re-export legacy name used by trial-emails */
export const buildTrialEmail_legacy = buildTrialEmail;

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
