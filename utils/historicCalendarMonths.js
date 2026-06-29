import { formatYmdLocal } from './formatYmdLocal';

/** Días reservados a «Últimos días» (misma ventana que AdminScreen). */
export const HISTORIC_RECENT_DAYS_EXCLUSIVE = 7;
/** Meses calendario completos hacia atrás desde el mes del corte. */
export const HISTORIC_FULL_MONTHS = 2;

/** Lunes = 0 … Domingo = 6 */
function mondayIndex(date) {
  const d = date.getDay();
  return d === 0 ? 6 : d - 1;
}

export function getHistoricRangeBounds(now = new Date()) {
  const today = new Date(now);
  today.setHours(12, 0, 0, 0);
  const rangeEnd = new Date(today);
  rangeEnd.setDate(today.getDate() - HISTORIC_RECENT_DAYS_EXCLUSIVE - 1);
  const rangeStart = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth() - HISTORIC_FULL_MONTHS, 1);
  rangeStart.setHours(12, 0, 0, 0);
  return { rangeStart, rangeEnd };
}

export function formatHistoricMonthTitle(year, month, dateLocale) {
  const d = new Date(year, month, 1, 12, 0, 0);
  const raw = d.toLocaleDateString(dateLocale, { month: 'long', year: 'numeric' });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function historicWeekdayLabels(dateLocale) {
  const labels = [];
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(2024, 0, 1 + i, 12, 0, 0);
    labels.push(d.toLocaleDateString(dateLocale, { weekday: 'narrow' }));
  }
  return labels;
}

/**
 * Meses a mostrar: 2 meses completos + mes parcial al inicio/fin del rango.
 * Cada mes incluye grilla semanal (L–D) con celdas null fuera del mes.
 */
export function buildHistoricMonthGrids(dateLocale, now = new Date()) {
  const { rangeStart, rangeEnd } = getHistoricRangeBounds(now);
  const rangeStartKey = formatYmdLocal(rangeStart);
  const rangeEndKey = formatYmdLocal(rangeEnd);

  const months = [];
  let y = rangeStart.getFullYear();
  let m = rangeStart.getMonth();
  const endY = rangeEnd.getFullYear();
  const endM = rangeEnd.getMonth();

  while (y < endY || (y === endY && m <= endM)) {
    const first = new Date(y, m, 1, 12, 0, 0);
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const leading = mondayIndex(first);
    const weeks = [];
    let week = Array.from({ length: leading }, () => null);

    for (let day = 1; day <= daysInMonth; day += 1) {
      const d = new Date(y, m, day, 12, 0, 0);
      const fk = formatYmdLocal(d);
      const inRange = d >= rangeStart && d <= rangeEnd;
      week.push({ fk, day, inRange });
      if (week.length === 7) {
        weeks.push(week);
        week = [];
      }
    }
    if (week.length > 0) {
      while (week.length < 7) week.push(null);
      weeks.push(week);
    }

    months.push({
      year: y,
      month: m,
      monthKey: `${y}-${String(m + 1).padStart(2, '0')}`,
      title: formatHistoricMonthTitle(y, m, dateLocale),
      weeks,
    });

    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
  }

  const inRangeKeys = [];
  for (const month of months) {
    for (const week of month.weeks) {
      for (const cell of week) {
        if (cell?.inRange) inRangeKeys.push(cell.fk);
      }
    }
  }

  return {
    months,
    rangeStartKey,
    rangeEndKey,
    inRangeKeys,
    weekdayLabels: historicWeekdayLabels(dateLocale),
  };
}
