/**
 * Estima series efectivas por grupo muscular desde texto de bloques FitEngine.
 * Genérico: cualquier organización, ES/EN y formatos habituales (fuerza, cross, hyrox, etc.).
 * Espejado en supabase/functions/generate-routine/volumeParser.ts
 */

const RM_TOKEN_RE = /@(?:\d{1,3}|[a-zA-Z]{2,4})%\d{1,2}rm[^\n@]*/gi;

/** Orden importa: patrones más específicos primero. */
const MUSCLE_RULES = [
  { keys: ['snatch', 'arranque', 'muscle snatch', 'power snatch', 'hang snatch'], groups: ['full body', 'hombros'] },
  { keys: ['clean and jerk', 'clean & jerk', 'c&j', 'clean y jerk'], groups: ['full body', 'hombros'] },
  { keys: ['clean', 'cargada', 'hang clean', 'power clean', 'squat clean'], groups: ['full body', 'cuádriceps'] },
  { keys: ['split jerk', 'push jerk', 'jerk'], groups: ['hombros', 'tríceps'] },
  { keys: ['thruster', 'wall ball', 'wall-ball', 'wallball'], groups: ['cuádriceps', 'hombros', 'core'] },
  { keys: ['burpee', 'devil press', 'man maker', 'man-maker'], groups: ['full body', 'pecho'] },
  { keys: ['box jump', 'box-jump', 'salto al cajon', 'salto al cajón', 'saltos al cajon'], groups: ['cuádriceps', 'gemelos'] },
  { keys: ['ski erg', 'skierg', 'ski-erg', 'rower', 'remo erg', 'concept 2', 'concept2', 'c2 row', 'bike erg', 'assault bike', 'air bike', 'echo bike', 'airdyne'], groups: ['condicionamiento', 'espalda'] },
  { keys: ['sled push', 'sled pull', 'prowler', 'trineo', 'farmers carry', 'farmer carry', 'farmer walk', 'sandbag', 'yoke'], groups: ['full body', 'condicionamiento'] },
  { keys: ['double under', 'double-under', 'doble salto', 'jump rope', 'saltar la cuerda', 'single under'], groups: ['condicionamiento', 'gemelos'] },
  { keys: ['run', 'correr', 'sprint', 'trote', '800m', '400m', '1km', 'hyrox'], groups: ['condicionamiento'] },
  { keys: ['back squat', 'front squat', 'goblet squat', 'overhead squat', 'ohs', 'zercher', 'pistol', 'hack squat', 'leg press', 'sentadilla', 'squat'], groups: ['cuádriceps', 'glúteos'] },
  { keys: ['deadlift', 'peso muerto', 'rdl', 'romanian', 'stiff leg', 'stiff-leg', 'good morning', 'hip thrust', 'glute bridge', 'kb swing', 'kettlebell swing', 'kettlebell', 'swing'], groups: ['isquios', 'glúteos'] },
  { keys: ['bench press', 'bench', 'press banca', 'floor press', 'push up', 'push-up', 'flexion', 'flexión', 'fondos en paralelas'], groups: ['pecho', 'tríceps'] },
  { keys: ['dip', 'fondo'], groups: ['pecho', 'tríceps'] },
  { keys: ['pull up', 'pull-up', 'pullup', 'dominada', 'chin up', 'chin-up', 'muscle up', 'muscle-up'], groups: ['espalda', 'bíceps'] },
  { keys: ['lat pulldown', 'jalon', 'jalón', 'pulldown', 'pull-down'], groups: ['espalda', 'bíceps'] },
  { keys: ['barbell row', 'pendlay', 'db row', 'dumbbell row', 'remo con mancuerna', 'remo'], groups: ['espalda', 'bíceps'] },
  { keys: ['overhead press', 'strict press', 'press militar', 'shoulder press', 'military press', 'push press', 'hombro', 'lateral raise', 'elevacion lateral', 'elevación lateral', 'face pull'], groups: ['hombros'] },
  { keys: ['bicep curl', 'hammer curl', 'curl', 'bíceps', 'biceps'], groups: ['bíceps'] },
  { keys: ['tricep extension', 'skull crusher', 'skullcrusher', 'pushdown', 'tricep', 'tríceps'], groups: ['tríceps'] },
  { keys: ['lunge', 'zancada', 'split squat', 'bulgarian', 'step up', 'step-up', 'walking lunge'], groups: ['cuádriceps', 'glúteos'] },
  { keys: ['leg curl', 'ham curl', 'nordic curl', 'curl femoral'], groups: ['isquios'] },
  { keys: ['leg extension', 'extension de pierna', 'extensión de pierna'], groups: ['cuádriceps'] },
  { keys: ['calf raise', 'calf', 'gemelo', 'elevacion de talon', 'elevación de talón', 'talones'], groups: ['gemelos'] },
  { keys: ['toes to bar', 'ttb', 'ghd', 'sit up', 'sit-up', 'situp', 'plank', 'plancha', 'hollow', 'v-up', 'pallof', 'ab wheel'], groups: ['core'] },
  { keys: ['fly', 'apertura', 'pec deck', 'chest fly'], groups: ['pecho'] },
  { keys: ['handstand', 'wall walk', 'rope climb', 'subida a cuerda'], groups: ['hombros', 'core'] },
];

const SEGMENT_SPLIT_RE = /\s*(?:\+|\/|,|\s+then\s+|\s+y\s+|\s+and\s+|\s+e\s+|\s&\s*)\s*/i;

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

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchesKeyword(normalizedLine, key) {
  const k = normalizeText(key);
  if (!k) return false;
  if (k.length <= 3 || k.includes(' ')) {
    return new RegExp(`\\b${escapeRegex(k)}\\b`, 'i').test(normalizedLine);
  }
  return normalizedLine.includes(k);
}

export function musclesForText(text) {
  const n = normalizeText(text);
  const found = new Set();
  for (const rule of MUSCLE_RULES) {
    if (rule.keys.some((k) => matchesKeyword(n, k))) {
      rule.groups.forEach((g) => found.add(g));
    }
  }
  if (!found.size) found.add('general');
  return [...found];
}

export function musclesForLine(line) {
  return musclesForText(line);
}

function splitExerciseSegments(line) {
  const raw = String(line || '').trim();
  if (!raw) return [];
  const parts = raw.split(SEGMENT_SPLIT_RE).map((p) => p.trim()).filter(Boolean);
  return parts.length ? parts : [raw];
}

function repsToEffectiveSets(totalReps) {
  return Math.max(1, Math.min(20, Math.round(totalReps / 6)));
}

function isSectionHeaderLine(line) {
  const t = String(line || '').trim();
  if (!t) return true;
  if (/^[-*#]/.test(t)) return true;
  if (/^(calentamiento|warmup|warm up|estiramiento|cooldown|cool down|skill|tecnica|técnica|accesorios|accesory|metcon|fuerza|strength|parte a|parte b)\b/i.test(t)) {
    return true;
  }
  if (extractWorkFromSegment(t).length) return false;
  return t.length < 48 && !/\d/.test(t);
}

/**
 * @returns {{ sets: number, reps: number, effectiveSets: number }[]}
 */
function extractWorkFromSegment(segment) {
  const raw = String(segment || '');
  const withoutRm = raw.replace(RM_TOKEN_RE, ' ');
  const out = [];

  const add = (sets, reps, effectiveSets = sets) => {
    const s = Number(sets);
    const r = Number(reps);
    const e = Number(effectiveSets);
    if (s > 0 && s <= 50 && r > 0 && r <= 200 && e > 0 && e <= 50) {
      out.push({ sets: s, reps: r, effectiveSets: e });
    }
  };

  let m;
  const reAxB = /(\d{1,2})\s*[x×]\s*(\d{1,3})\b/gi;
  while ((m = reAxB.exec(withoutRm)) !== null) {
    add(Number(m[1]), Number(m[2]));
  }

  const reBxA = /\b(\d{1,3})\s*[x×]\s*(\d{1,2})\s*(?:sets?|series?)?\b/gi;
  while ((m = reBxA.exec(withoutRm)) !== null) {
    if (Number(m[1]) > Number(m[2])) add(Number(m[2]), Number(m[1]));
  }

  const reSeries = /(\d{1,2})\s+series?\s+(?:de\s+|x\s*)?(\d{1,3})\s+reps?/gi;
  while ((m = reSeries.exec(withoutRm)) !== null) {
    add(Number(m[1]), Number(m[2]));
  }

  const reSetsAt = /(\d{1,2})\s+sets?\s+(?:@|at|de)\s*(\d{1,3})\s+reps?/gi;
  while ((m = reSetsAt.exec(withoutRm)) !== null) {
    add(Number(m[1]), Number(m[2]));
  }

  const emom = withoutRm.match(/\bemom\s*(\d{1,3})?\b/i);
  if (emom) add(Number(emom[1] || 10), 1);

  const tabata = withoutRm.match(/\btabata\b/i);
  if (tabata) add(8, 1);

  const every = withoutRm.match(/\b(?:every|cada)\s+[\d:.]+\s*(?:min(?:utos?)?)?\s*[x×]\s*(\d{1,2})\b/i);
  if (every) add(Number(every[1]), 1);

  const amrap = withoutRm.match(/\bamrap\b(?:\s*(\d{1,3}))?\s*(?:min(?:utos?)?)?/i);
  if (amrap) {
    const mins = Number(amrap[1] || 12);
    add(Math.min(16, Math.max(4, Math.round(mins * 0.75))), 1);
  }

  const rounds = withoutRm.match(/\b(\d{1,2})\s+(?:rounds?|rondas?)(?:\s+of|\s+de)?\b/i);
  if (rounds && !out.length) add(Number(rounds[1]), 1);

  const ladder = withoutRm.match(/\b(\d{1,3})\s*-\s*(\d{1,3})\s*-\s*(\d{1,3})(?:\s*-\s*(\d{1,3}))?\b/);
  if (ladder) {
    const reps = [ladder[1], ladder[2], ladder[3], ladder[4]].filter(Boolean).map(Number);
    const total = reps.reduce((a, b) => a + b, 0);
    add(reps.length, Math.round(total / reps.length), repsToEffectiveSets(total));
  }

  const repsOnly = withoutRm.match(/\b(\d{1,3})\s+reps?\b/i);
  if (repsOnly && !out.length) add(3, Number(repsOnly[1]));

  if (!out.length && /@(?:\d{1,3}|[a-zA-Z]{2,4})%\d{1,2}rm/i.test(raw)) {
    add(3, 3);
  }

  return out;
}

/**
 * @returns {{ sets: number, reps: number, effectiveSets: number }[]}
 */
export function extractSetsRepsFromLine(line) {
  const segments = splitExerciseSegments(line);
  const merged = [];
  for (const seg of segments) {
    merged.push(...extractWorkFromSegment(seg));
  }
  return merged;
}

function accumulateVolume(target, muscles, effectiveSets) {
  const share = 1 / muscles.length;
  for (const muscle of muscles) {
    target[muscle] = (target[muscle] || 0) + effectiveSets * share;
  }
}

/**
 * @param {Array<{ fecha?: string, titulo?: string, contenido?: string, notas?: string }>} blocks
 */
export function analyzeBlocksVolume(blocks) {
  const muscleTotals = {};
  const weeklyMuscle = {};
  let parsedLines = 0;
  let unparsedLines = 0;
  const unparsedSamples = [];

  for (const block of blocks || []) {
    const text = [block.titulo, block.contenido, block.notas].filter(Boolean).join('\n');
    const fecha = String(block.fecha || '').slice(0, 10);
    const wk = weekKeyFromYmd(fecha);
    if (!weeklyMuscle[wk]) weeklyMuscle[wk] = {};

    const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
    let lineContext = '';

    for (const line of lines) {
      if (isSectionHeaderLine(line) && !extractSetsRepsFromLine(line).length) {
        lineContext = line;
        continue;
      }

      const segments = splitExerciseSegments(line);
      let lineParsed = false;

      for (const seg of segments) {
        const patterns = extractWorkFromSegment(seg);
        if (!patterns.length) continue;
        lineParsed = true;
        const muscles = musclesForText(`${seg} ${lineContext} ${block.titulo || ''}`);
        for (const p of patterns) {
          const eff = p.effectiveSets ?? p.sets;
          accumulateVolume(muscleTotals, muscles, eff);
          accumulateVolume(weeklyMuscle[wk], muscles, eff);
        }
      }

      if (lineParsed) {
        parsedLines += 1;
        if (!isSectionHeaderLine(line)) {
          lineContext = line.replace(/\d/g, '').trim().slice(0, 80) || lineContext;
        }
      } else {
        unparsedLines += 1;
        if (unparsedSamples.length < 5 && line.length > 3) {
          unparsedSamples.push(line.slice(0, 120));
        }
      }
    }
  }

  const sortedMuscles = Object.entries(muscleTotals).sort((a, b) => b[1] - a[1]);
  const totalLines = parsedLines + unparsedLines;
  const confidence = totalLines > 0 ? Math.round((parsedLines / totalLines) * 100) : 0;

  return {
    muscleTotals,
    weeklyMuscle,
    sortedMuscles,
    parsedLines,
    unparsedLines,
    blockCount: (blocks || []).length,
    confidence,
    unparsedSamples,
  };
}

export function formatVolumeAnalysisForPrompt(analysis) {
  if (!analysis || !analysis.blockCount) {
    return '(sin bloques en el rango; no hay volumen parseado)';
  }

  const lines = [];
  lines.push(
    `Bloques analizados: ${analysis.blockCount} · líneas con trabajo detectado: ${analysis.parsedLines} · sin parsear: ${analysis.unparsedLines} · confianza parser: ${analysis.confidence ?? 0}%`,
  );
  lines.push(
    'Totales aproximados de series efectivas por grupo muscular (parser automático multiformato; válido para cualquier sede — contrastar con la tabla del coach):',
  );

  if (!analysis.sortedMuscles?.length) {
    lines.push('- (ninguna serie detectada; formatos soportados: 5x3, 4x8, 4 series de 8 reps, EMOM, AMRAP, 21-15-9, rounds/rondas, @%RM)');
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

  if (analysis.unparsedSamples?.length) {
    lines.push('');
    lines.push('Ejemplos de líneas no parseadas (la IA puede estimarlas con cuidado):');
    for (const s of analysis.unparsedSamples) {
      lines.push(`- ${s}`);
    }
  }

  lines.push('');
  lines.push(
    'Usá estos números como base objetiva; la tabla de landmarks del coach puede usar otros nombres o idioma — mapeá por significado.',
  );

  return lines.join('\n');
}

/** Resumen corto para UI del modal Ciclo. */
export function formatVolumePreviewShort(analysis) {
  if (!analysis?.blockCount) return '';
  const top = (analysis.sortedMuscles || []).slice(0, 5);
  if (!top.length) {
    return `Parser: ${analysis.confidence ?? 0}% · sin series detectadas en ${analysis.blockCount} bloque(s)`;
  }
  const parts = top.map(([m, s]) => `${m} ${Math.round(s * 10) / 10}`).join(' · ');
  return `Parser (${analysis.confidence ?? 0}%): ${parts}`;
}

/**
 * Plantilla editable por cada organización (cualquier idioma en los labels).
 * Los nombres de grupo del parser son orientativos; el coach puede renombrar aquí.
 */
export const DEFAULT_AI_VOLUME_LANDMARKS = `Cuádriceps / Quads: MEV 8 / MAV 12-18 / MRV 22
Isquios / Hamstrings: MEV 6 / MAV 10-16 / MRV 20
Glúteos / Glutes: MEV 4 / MAV 8-14 / MRV 18
Pecho / Chest: MEV 8 / MAV 12-18 / MRV 22
Espalda / Back: MEV 10 / MAV 14-20 / MRV 25
Hombros / Shoulders: MEV 6 / MAV 10-16 / MRV 20
Bíceps / Biceps: MEV 4 / MAV 8-14 / MRV 18
Tríceps / Triceps: MEV 4 / MAV 8-14 / MRV 18
Core: MEV 4 / MAV 8-12 / MRV 16
Gemelos / Calves: MEV 6 / MAV 10-16 / MRV 20
Condicionamiento / Conditioning: según modalidad (carrera, erg, hyrox, etc.)`;
