/**
 * YYYY-MM-DD en calendario local (no UTC). Evita desfase vs toISOString() en zonas negativas a UTC.
 * @param {Date} [d]
 * @returns {string}
 */
export function formatYmdLocal(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
