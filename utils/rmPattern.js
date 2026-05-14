/**
 * Patrones @…%…rm… en bloques de rutina (Admin + Trabajo del día).
 * - Forma canónica: @70%1rmSentadilla (carga al % de tu 1RM)
 * - Mismo esquema para 2RM, 3RM, 7RM, 10RM: @65%7rmPress — el número entre % y rm es el tipo de RM
 *   (la app usa la fórmula de TrainingDataContext.calculateWeight para nRM → kg).
 * - Variante: @cc%1rmSnatch (porcentaje en letras → sin kg hasta tener RM guardado)
 */

import { fitengineLogoColors } from '../theme/colors';

/** Teal logo FitEngine para tokens RM (independiente del acento del gym / Waitomo). */
export const RM_HIGHLIGHT_COLOR = fitengineLogoColors.primary;

/**
 * Regex global: grupo 1 = parte antes de %, 2 = tipo RM (1–99: 1rm, 7rm, 10rm…), 3 = ejercicio.
 */
export function getRmTokenRegex() {
  return /@((?:\d{1,3}|[a-zA-Z]{2,4}))%(\d{1,2})rm([^\n@]*)/gi;
}

export function parseRmPercentageToken(raw) {
  if (raw == null || raw === '') return NaN;
  const s = String(raw).trim();
  if (/^\d{1,3}$/.test(s)) return parseFloat(s);
  return NaN;
}

export function extractRmTags(texto) {
  if (!texto || typeof texto !== 'string') return [];
  const rx = getRmTokenRegex();
  const out = [];
  let m;
  const re = new RegExp(rx.source, rx.flags);
  while ((m = re.exec(texto)) !== null) {
    out.push(m[0]);
  }
  return out;
}

/**
 * Parte un texto en segmentos literales y tokens RM (para preview / líneas).
 */
export function splitTextWithRmTokens(text) {
  if (!text || typeof text !== 'string') return [{ type: 'text', value: '' }];
  const rx = getRmTokenRegex();
  const parts = [];
  let last = 0;
  let m;
  const re = new RegExp(rx.source, rx.flags);
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      parts.push({ type: 'text', value: text.slice(last, m.index) });
    }
    const pctRaw = m[1];
    const reps = parseInt(m[2], 10);
    const exercise = String(m[3] || '').trim();
    parts.push({
      type: 'rm',
      full: m[0],
      pctRaw,
      reps,
      exercise,
      pctNumber: parseRmPercentageToken(pctRaw),
    });
    last = re.lastIndex;
  }
  if (last < text.length) {
    parts.push({ type: 'text', value: text.slice(last) });
  }
  return parts.length ? parts : [{ type: 'text', value: text }];
}
