import { supabase } from '../supabaseClient';

/**
 * Supabase devuelve error genérico "non-2xx"; el cuerpo JSON de la función suele traer `error` / `detail`.
 */
function throwInvokeError(error, data) {
  const base = error?.message || String(error || 'invoke_failed');
  const parts = [base];
  if (data != null && typeof data === 'object') {
    if (data.step != null) parts.push(`paso: ${String(data.step)}`);
    if (data.hint != null) parts.push(String(data.hint));
    if (data.error != null) parts.push(String(data.error));
    if (data.detail != null) parts.push(String(data.detail));
    if (data.message != null && data.message !== data.error) parts.push(String(data.message));
  }
  const ctx = error?.context;
  if (ctx && typeof ctx === 'object') {
    if (ctx.status != null) parts.push(`HTTP ${ctx.status}`);
    const b = ctx.body;
    if (typeof b === 'string' && b.trim()) {
      try {
        const j = JSON.parse(b);
        if (j?.error) parts.push(String(j.error));
        if (j?.detail) parts.push(String(j.detail));
      } catch {
        parts.push(b.slice(0, 240));
      }
    }
  }
  const msg = [...new Set(parts.filter(Boolean))].join(' — ');
  const err = new Error(msg);
  err.original = error;
  err.responseData = data;
  throw err;
}

async function invokeGenerateRoutine(body) {
  const { data, error } = await supabase.functions.invoke('generate-routine', { body });
  if (error) throwInvokeError(error, data);
  if (!data?.ok || !data?.result) {
    throw new Error(data?.error || 'ai_generation_failed');
  }
  return data;
}

export async function generateRoutineDraft({
  organizationId,
  targetClientId = null,
  sessionDate,
  slotLabel,
  planKey,
  durationMinutes = 45,
  focus = '',
  extraNotes = '',
}) {
  return invokeGenerateRoutine({
    mode: 'routine',
    organization_id: organizationId,
    target_client_id: targetClientId,
    session_date: sessionDate,
    slot_label: slotLabel,
    plan_key: planKey,
    duration_minutes: durationMinutes,
    focus,
    extra_notes: extraNotes,
  });
}

export async function rewriteBlockWithAi({
  organizationId,
  rawText,
  titleHint = '',
  planKey = '',
  slotLabel = '',
}) {
  return invokeGenerateRoutine({
    mode: 'rewrite',
    organization_id: organizationId,
    raw_text: rawText,
    title_hint: titleHint,
    plan_key: planKey,
    slot_label: slotLabel,
  });
}

export async function draftMessageWithAi({
  organizationId,
  rawText,
  titleHint = '',
  planKey = '',
  slotLabel = '',
  sessionDate = '',
  extraNotes = '',
}) {
  return invokeGenerateRoutine({
    mode: 'message',
    organization_id: organizationId,
    raw_text: rawText,
    title_hint: titleHint,
    plan_key: planKey,
    slot_label: slotLabel,
    session_date: sessionDate,
    extra_notes: extraNotes,
  });
}

/** Resumen corto de miembro para staff: `factsText` debe ser solo hechos (perfil/reservas/abonos). */
export async function draftMemberSummaryWithAi({
  organizationId,
  factsText,
  displayName,
  locale = 'es',
}) {
  const raw = String(factsText || '').trim();
  const isEn = String(locale || '').toLowerCase().startsWith('en');
  const titleHint = isEn ? `Internal staff snapshot: ${displayName}` : `Resumen interno staff: ${displayName}`;
  const extraNotes = isEn
    ? 'Task: write ONE short paragraph (4-7 sentences) for gym staff. Use ONLY facts from the data block (profile, subscription alerts, attendance summary with last attended / no-shows / cancellations, booking list). Mention attendance gaps or no-shows if the numbers say so. If something is missing, say so plainly. No %RM format; plain prose. No medical diagnosis.'
    : 'Tarea: escribí UN párrafo corto (4-7 oraciones) para el staff del gimnasio. Usá SOLO hechos del bloque (perfil, alertas de membresía/vencimiento, resumen de asistencia con última vez que vino, ausencias y cancelaciones, lista de reservas). Si los números muestran huecos o muchas ausencias, mencionarlo con tacto. Si falta dato, decilo claro. Sin formato %RM; texto corrido. No diagnosticar ni inventar historial.';
  return draftMessageWithAi({
    organizationId,
    rawText: raw || '(sin datos)',
    titleHint,
    planKey: 'member_summary',
    slotLabel: '',
    sessionDate: new Date().toISOString().slice(0, 10),
    extraNotes,
  });
}

/** Sugerencia breve de respuesta para chat staff-cliente usando contexto reciente del canal. */
export async function draftChatReplyWithAi({
  organizationId,
  channelName = '',
  conversationText,
  draftIntent = '',
  templateType = '',
  locale = 'es',
}) {
  const isEn = String(locale || '').toLowerCase().startsWith('en');
  const titleHint = isEn
    ? `Chat reply suggestion: ${channelName || 'channel'}`
    : `Sugerencia de respuesta chat: ${channelName || 'canal'}`;
  const raw = String(conversationText || '').trim();
  const intent = String(draftIntent || '').trim();
  const template = String(templateType || '').trim().toLowerCase();
  const templateHint = (() => {
    if (template === 'payment_reminder') {
      return isEn
        ? 'Template mode: payment reminder. Mention due/pending payment with respectful tone, propose simple next step, avoid threats.'
        : 'Modo plantilla: recordatorio de pago. Mencioná pago pendiente/vencido con tono respetuoso, proponé un siguiente paso simple, sin amenazas.';
    }
    if (template === 'schedule_change') {
      return isEn
        ? 'Template mode: schedule change. Explain the new time clearly, include from-when, and invite confirmation.'
        : 'Modo plantilla: cambio de horario. Explicá horario nuevo con claridad, desde cuándo aplica e invitá a confirmar.';
    }
    if (template === 'win_back') {
      return isEn
        ? 'Template mode: win-back. Warm, short, and motivational. Invite the member to return with a simple CTA.'
        : 'Modo plantilla: win-back. Tono cálido, breve y motivador. Invitar a volver con una llamada a la acción simple.';
    }
    return '';
  })();
  const extraNotes = isEn
    ? `Task: draft one concise, empathetic reply as staff. Use only conversation context; do not invent policies, prices, schedules, or promises not mentioned. Keep it actionable and friendly. If needed, ask one clarifying question. Current draft (if any): ${intent || '(none)'}. ${templateHint}`.trim()
    : `Tarea: redactar una respuesta corta y empática como staff. Usar solo el contexto del chat; no inventar políticas, precios, horarios ni promesas no mencionadas. Mantener tono claro y accionable. Si hace falta, hacer una sola pregunta de aclaración. Borrador actual (si existe): ${intent || '(ninguno)'}. ${templateHint}`.trim();
  return draftMessageWithAi({
    organizationId,
    rawText: raw || '(sin contexto)',
    titleHint,
    planKey: 'chat_reply',
    slotLabel: '',
    sessionDate: new Date().toISOString().slice(0, 10),
    extraNotes,
  });
}

export async function normalizeRmPatternWithAi({
  organizationId,
  rawText,
  planKey = '',
}) {
  return invokeGenerateRoutine({
    mode: 'rm_format',
    organization_id: organizationId,
    raw_text: rawText,
    plan_key: planKey,
  });
}
