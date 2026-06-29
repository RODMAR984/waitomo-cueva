/**
 * Estima series efectivas por grupo muscular a partir de texto de bloques FitEngine.
 * Usado en cliente (preview) y espejado en supabase/functions/generate-routine/volumeParser.ts.
 */

const RM_TOKEN_RE = /@(?:\d{1,3}|[a-zA-Z]{2,4})%\d{1,2}rm[^\n@]*/gi;

const MUSCLE_RULES = [
  { keys: ['squat', 'sentadilla', 'zercher', 'pistol', 'wall ball'], groups: ['cuádriceps', 'glúteos'] },
  { keys: ['deadlift', 'peso muerto', 'rdl', 'romanian', 'hip thrust', 'good morning'], groups: ['isquios', 'glúteos', 'espalda baja'] },
  { keys: ['bench', 'press banca', 'floor press', 'dip', 'fondo'], groups: ['pecho', 'tríceps'] },
  { keys: ['pull up', 'pull-up', 'dominada', 'chin up', 'muscle up'], groups: ['espalda', 'bíceps'] },
  { keys: ['row', 'remo', 'pendlay'], groups: ['espalda', 'bíceps'] },
  { keys: ['overhead', 'press militar', 'ohs', 'strict press', 'push press', 'jerk', 'hombro'], groups: ['hombros', 'tríceps'] },
  { keys: ['snatch', 'arranque'], groups: ['full body', 'hombros'] },
  { keys: ['clean', 'cargada', 'hang clean'], groups: ['full body', 'cuádriceps'] },
  { keys: ['curl', 'bíceps', 'biceps'], groups: ['bíceps'] },
  { keys: ['tricep', 'tríceps', 'extension', 'skull'], groups: ['tríceps'] },
  { keys: ['lunge', 'zancada', 'split squat', 'step up'], groups: ['cuádriceps', 'glúteos'] },
  { keys: ['calf', 'gemelo', 'elevación de talón'], groups: ['gemelos'] },
  { keys: ['ab', 'core', 'plancha', 'sit up', 'toes to bar', 'ttb', 'ghd'], groups: ['core'] },
];

function parseYmd(ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || '').trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatYmd(d) {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

export function weekKeyFromYmd(ymd) {
  const d = parseYmd(ymd);
  if (!d) return String(ymd || 'unknown').slice(0, 10);
  const day = d.getDay();
  const diff = (day + 6) % 7;
  const mon = new Date(d);
  mon.setDate(d.getDate() - diff);
  return formatYmd(mon);
}

function normalizeText(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

export function musclesForLine(line) {
  const n = normalizeText(line);
  const found = new Set();
  for (const rule of MUSCLE_RULES) {
    if (rule.keys.some((k) => n.includes(k))) {
      rule.groups.forEach((g) => found.add(g));
    }
  }
  if (!found.size) found.add('general');
  return [...found];
}

/**
 * @returns {{ sets: number, reps: number }[]}
 */
export function extractSetsRepsFromLine(line) {
  const out = [];
  const raw = String(line || '');
  const withoutRm = raw.replace(RM_TOKEN_RE, ' ');

  let m;
  const reAxB = /(\d{1,2})\s*[x×]\s*(\d{1,3})\b/gi;
  while ((m = reAxB.exec(withoutRm)) !== null) {
    out.push({ sets: Number(m[1]), reps: Number(m[2]) });
  }

  const reSeries = /(\d{1,2})\s+series?\s+(?:de\s+)?(\d{1,3})\s+reps?/gi;
  while ((m = reSeries.exec(withoutRm)) !== null) {
    out.push({ sets: Number(m[1]), reps: Number(m[2]) });
  }

  const emom = withoutRm.match(/\bemom\s*(\d{1,3})\b/i);
  if (emom) out.push({ sets: Number(emom[1]), reps: 1 });

  const rounds = withoutRm.match(/\b(\d{1,2})\s+rounds?\b/i);
  if (rounds && !out.length) out.push({ sets: Number(rounds[1]), reps: 1 });

  if (!out.length && /@(?:\d{1,3}|[a-zA-Z]{2,4})%\d{1,2}rm/i.test(raw)) {
    out.push({ sets: 3, reps: 3 });
  }

  return out.filter((p) => p.sets > 0 && p.sets <= 50 && p.reps > 0 && p.reps <= 100);
}

/**
 * @param {Array<{ fecha?: string, titulo?: string, contenido?: string, notas?: string }>} blocks
 */
export function analyzeBlocksVolume(blocks) {
  const muscleTotals = {};
  const weeklyMuscle = {};
  let parsedLines = 0;
  let unparsedLines = 0;

  for (const block of blocks || []) {
    const text = [block.titulo, block.contenido, block.notas].filter(Boolean).join('\n');
    const fecha = String(block.fecha || '').slice(0, 10);
    const wk = weekKeyFromYmd(fecha);
    if (!weeklyMuscle[wk]) weeklyMuscle[wk] = {};

    const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      const patterns = extractSetsRepsFromLine(line);
      if (!patterns.length) {
        unparsedLines += 1;
        continue;
      }
      parsedLines += 1;
      const muscles = musclesForLine(line);
      const share = 1 / muscles.length;
      for (const { sets } of patterns) {
        for (const muscle of muscles) {
          const add = sets * share;
          muscleTotals[muscle] = (muscleTotals[muscle] || 0) + add;
          weeklyMuscle[wk][muscle] = (weeklyMuscle[wk][muscle] || 0) + add;
        }
      }
    }
  }

  const sortedMuscles = Object.entries(muscleTotals).sort((a, b) => b[1] - a[1]);

  return {
    muscleTotals,
    weeklyMuscle,
    sortedMuscles,
    parsedLines,
    unparsedLines,
    blockCount: (blocks || []).length,
  };
}

export function formatVolumeAnalysisForPrompt(analysis) {
  if (!analysis || !analysis.blockCount) {
    return '(sin bloques en el rango; no hay volumen parseado)';
  }

  const lines = [];
  lines.push(
    `Bloques analizados: ${analysis.blockCount} · líneas con series detectadas: ${analysis.parsedLines} · sin parsear: ${analysis.unparsedLines}`,
  );
  lines.push('Totales aproximados de series efectivas por grupo muscular (parser automático, no IA):');

  if (!analysis.sortedMuscles?.length) {
    lines.push('- (ninguna serie detectada; revisá formato 5x3, 4 series de 8 reps, EMOM, etc.)');
  } else {
    for (const [muscle, sets] of analysis.sortedMuscles) {
      lines.push(`- ${muscle}: ${Math.round(sets * 10) / 10} series`);
    }
  }

  const weeks = Object.keys(analysis.weeklyMuscle || {}).sort();
  if (weeks.length > 1) {
    lines.push('');
    lines.push('Por semana (lunes como inicio):');
    for (const wk of weeks) {
      const entries = Object.entries(analysis.weeklyMuscle[wk] || {}).sort((a, b) => b[1] - a[1]);
      if (!entries.length) continue;
      const top = entries
        .slice(0, 6)
        .map(([m, s]) => `${m} ${Math.round(s * 10) / 10}`)
        .join(', ');
      lines.push(`- semana ${wk}: ${top}`);
    }
  }

  lines.push('');
  lines.push(
    'Usá estos números como base objetiva; contrastalos con la tabla de landmarks del coach y ajustá el plan si hay desvíos.',
  );

  return lines.join('\n');
}

/** Preset por defecto para nuevas orgs (solo UI; el coach puede editarlo). */
export const DEFAULT_AI_VOLUME_LANDMARKS = `Cuádriceps: MEV 8 / MAV 12-18 / MRV 22
Isquios: MEV 6 / MAV 10-16 / MRV 20
Glúteos: MEV 4 / MAV 8-14 / MRV 18
Pecho: MEV 8 / MAV 12-18 / MRV 22
Espalda: MEV 10 / MAV 14-20 / MRV 25
Hombros: MEV 6 / MAV 10-16 / MRV 20
Bíceps: MEV 4 / MAV 8-14 / MRV 18
Tríceps: MEV 4 / MAV 8-14 / MRV 18`;
