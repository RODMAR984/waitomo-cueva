import { supabase } from '../supabaseClient';
import { normalizeBlockPlanKey } from './trainingBlockPlan';

function slotLabel(hora) {
  const h = String(hora || '').trim();
  if (!h) return '00:00';
  return h.length >= 5 ? h.slice(0, 5) : h;
}

function coachLabelFromProfile(p) {
  if (!p) return null;
  const name = (p.full_name || '').trim();
  const user = (p.username || '').trim();
  if (name && user) return `${name} (@${user})`;
  return name || (user ? `@${user}` : null);
}

/**
 * Fila PostgREST → objeto bloque (compatible con Admin + TrabajoDelDia).
 * `_coach_label` puede venir del fetch enriquecido (nombre para mostrar).
 */
export function rowToBloque(row) {
  if (!row) return null;
  const fk =
    typeof row.fecha === 'string' && row.fecha.length >= 10
      ? row.fecha.slice(0, 10)
      : row.fecha
        ? new Date(row.fecha).toISOString().slice(0, 10)
        : '';
  const d = fk ? new Date(`${fk}T12:00:00`) : new Date();
  let videoLinks = row.video_links;
  let rmTags = row.rm_tags;
  if (typeof videoLinks === 'string') {
    try {
      videoLinks = JSON.parse(videoLinks);
    } catch {
      videoLinks = [];
    }
  }
  if (typeof rmTags === 'string') {
    try {
      rmTags = JSON.parse(rmTags);
    } catch {
      rmTags = [];
    }
  }
  return {
    id: row.client_block_id,
    server_id: row.id,
    organization_id: row.organization_id,
    plan: row.plan_key,
    coachId: row.coach_id,
    coachDisplayName: row._coach_label || null,
    fecha: d.toISOString(),
    fechaKey: fk,
    hora: row.slot_label,
    titulo: row.titulo || '',
    contenido: row.contenido || '',
    notas: row.notas || '',
    capacity: row.capacity != null ? Number(row.capacity) : null,
    videoLinks: Array.isArray(videoLinks) ? videoLinks : [],
    rmTags: Array.isArray(rmTags) ? rmTags : [],
    updated_at_remote: row.updated_at,
  };
}

/**
 * Objeto bloque → payload upsert (sin id uuid de fila).
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function bloqueToRow(b, organizationId, defaultCoachId) {
  if (!b?.id || !organizationId) return null;
  const fk = b.fechaKey || (b.fecha ? String(b.fecha).slice(0, 10) : '');
  if (!fk) return null;
  let coachId = b.coachId && UUID_RE.test(String(b.coachId)) ? b.coachId : null;
  if (!coachId) coachId = defaultCoachId && UUID_RE.test(String(defaultCoachId)) ? defaultCoachId : null;
  if (!coachId) return null;
  return {
    organization_id: organizationId,
    plan_key: normalizeBlockPlanKey(b.plan) || String(b.plan || '').trim(),
    coach_id: coachId,
    fecha: fk,
    slot_label: slotLabel(b.hora || b.horario),
    titulo: b.titulo || '',
    contenido: b.contenido || '',
    notas: b.notas || '',
    capacity:
      b.capacity == null || Number.isNaN(Number(b.capacity)) || Number(b.capacity) <= 0
        ? null
        : Number(b.capacity),
    video_links: Array.isArray(b.videoLinks) ? b.videoLinks : [],
    rm_tags: Array.isArray(b.rmTags) ? b.rmTags : [],
    client_block_id: b.id,
  };
}

/**
 * Descarga bloques de una sede y los fusiona con la lista local (misma org + herencia sin organization_id).
 */
export function mergeRemoteTrainingBlocks(localArr, remoteRows, orgId, opts) {
  const local = Array.isArray(localArr) ? localArr : [];
  const remote = (remoteRows || []).map(rowToBloque).filter(Boolean);
  const replaceOrgWhenEmpty = !!(opts && opts.replaceOrgWhenEmpty);
  if (replaceOrgWhenEmpty && remote.length === 0) {
    const keepOtherOrgs = [];
    for (const b of local) {
      if (b.organization_id && b.organization_id !== orgId) keepOtherOrgs.push(b);
    }
    return keepOtherOrgs;
  }
  const remoteById = new Map(remote.map((b) => [b.id, b]));

  const keepOtherOrgs = [];
  const orgLocal = [];
  for (const b of local) {
    if (b.organization_id && b.organization_id !== orgId) {
      keepOtherOrgs.push(b);
      continue;
    }
    orgLocal.push(b);
  }

  const orgLocalIds = new Set(orgLocal.map((b) => b.id));
  const merged = [];
  for (const b of orgLocal) {
    const r = remoteById.get(b.id);
    merged.push(r || b);
  }
  for (const r of remote) {
    if (!orgLocalIds.has(r.id)) merged.push(r);
  }

  return [...keepOtherOrgs, ...merged];
}

/**
 * Sincroniza hacia Supabase: upsert filas de la org y borra client_block_id quitados.
 */
export async function syncTrainingBlocksToSupabase(nextBlocks, removedClientIds, organizationId, defaultCoachId) {
  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData?.session?.user?.id;
  if (!uid || !organizationId) return { ok: false, reason: 'no_session_or_org' };

  const forOrg = (Array.isArray(nextBlocks) ? nextBlocks : []).filter(
    (b) => b && (b.organization_id === organizationId || !b.organization_id),
  );

  const rows = [];
  for (const b of forOrg) {
    const row = bloqueToRow(
      !b.organization_id ? { ...b, organization_id: organizationId } : b,
      organizationId,
      defaultCoachId,
    );
    if (row) rows.push(row);
  }

  if (rows.length) {
    const { error: upErr } = await supabase.from('training_daily_blocks').upsert(rows, {
      onConflict: 'organization_id,client_block_id',
    });
    if (upErr) {
      console.warn('training_daily_blocks upsert', upErr.message);
      return { ok: false, error: upErr };
    }
  }

  const removed = (removedClientIds || []).filter(Boolean);
  if (removed.length) {
    const { error: delErr } = await supabase
      .from('training_daily_blocks')
      .delete()
      .eq('organization_id', organizationId)
      .in('client_block_id', removed);
    if (delErr) {
      console.warn('training_daily_blocks delete', delErr.message);
      return { ok: false, error: delErr };
    }
  }

  return { ok: true };
}

export async function fetchTrainingBlocksForOrg(organizationId) {
  if (!organizationId) return { data: [], error: null };
  const { data, error } = await supabase
    .from('training_daily_blocks')
    .select(
      'id, organization_id, plan_key, coach_id, fecha, slot_label, titulo, contenido, notas, capacity, video_links, rm_tags, client_block_id, updated_at',
    )
    .eq('organization_id', organizationId)
    .order('fecha', { ascending: false })
    .limit(4000);
  if (error) return { data: [], error };

  const rows = data || [];
  const coachIds = [...new Set(rows.map((r) => r.coach_id).filter(Boolean))];
  let labelById = {};
  if (coachIds.length) {
    const { data: profs, error: pErr } = await supabase
      .from('profiles')
      .select('id, full_name, username')
      .in('id', coachIds);
    if (!pErr && profs?.length) {
      labelById = Object.fromEntries(
        profs.map((p) => [p.id, coachLabelFromProfile(p)]).filter(([, lab]) => !!lab),
      );
    }
  }

  const enriched = rows.map((r) => ({
    ...r,
    _coach_label: labelById[r.coach_id] || null,
  }));
  return { data: enriched, error: null };
}
