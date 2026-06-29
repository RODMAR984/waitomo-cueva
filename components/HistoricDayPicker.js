import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { formatYmdLocal } from '../utils/formatYmdLocal';

/** Días recientes reservados a "Últimos días" (misma ventana que AdminScreen). */
const RECENT_DAYS_EXCLUSIVE = 7;
/** Calendario histórico: ~2 meses hacia atrás desde el límite reciente. */
const HISTORIC_DAYS_SPAN = 62;

function blockFechaKey(b, fechaKeyFrom) {
  if (b?.fechaKey) return b.fechaKey;
  try {
    return fechaKeyFrom(new Date(b?.fecha || 0));
  } catch {
    return '';
  }
}

function buildHistoricCalendarDays() {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const newestHistoric = new Date(today);
  newestHistoric.setDate(today.getDate() - RECENT_DAYS_EXCLUSIVE - 1);
  const oldest = new Date(today);
  oldest.setDate(today.getDate() - HISTORIC_DAYS_SPAN);

  const out = [];
  for (let d = new Date(oldest); d <= newestHistoric; d.setDate(d.getDate() + 1)) {
    out.push(formatYmdLocal(d));
  }
  return out;
}

/**
 * Selector de día histórico (plan ya filtrado) + bloques del día elegido.
 */
export default function HistoricDayPicker({
  blocks,
  fechaKeyFrom,
  dateLocale,
  tStr,
  styles,
  planLabel,
  renderBlock,
}) {
  const calendarDays = useMemo(() => buildHistoricCalendarDays(), []);

  const sevenAgo = useMemo(() => {
    const n = new Date();
    n.setHours(12, 0, 0, 0);
    n.setDate(n.getDate() - RECENT_DAYS_EXCLUSIVE);
    return n;
  }, []);

  const blocksByDate = useMemo(() => {
    const map = new Map();
    for (const b of blocks || []) {
      const fk = blockFechaKey(b, fechaKeyFrom);
      if (!fk) continue;
      const d = new Date(`${fk}T12:00:00`);
      if (Number.isNaN(d.getTime()) || d >= sevenAgo) continue;
      if (!map.has(fk)) map.set(fk, []);
      map.get(fk).push(b);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => String(a.hora || '').localeCompare(String(b.hora || '')));
    }
    return map;
  }, [blocks, fechaKeyFrom, sevenAgo]);

  const datesWithBlocks = useMemo(() => new Set(blocksByDate.keys()), [blocksByDate]);

  const oldestInCalendar = calendarDays[0] || '';

  const olderDateKeys = useMemo(
    () =>
      [...blocksByDate.keys()]
        .filter((fk) => fk < oldestInCalendar)
        .sort((a, b) => b.localeCompare(a)),
    [blocksByDate, oldestInCalendar],
  );

  const [selectedKey, setSelectedKey] = useState(null);

  const blocksFingerprint = useMemo(
    () => [...blocksByDate.keys()].sort().join(','),
    [blocksByDate],
  );

  useEffect(() => {
    const inCalendar = calendarDays.filter((fk) => blocksByDate.has(fk));
    const pick = inCalendar[inCalendar.length - 1] || olderDateKeys[0] || null;
    setSelectedKey(pick);
  }, [blocksFingerprint, planLabel, calendarDays, blocksByDate, olderDateKeys]);

  const monthSections = useMemo(() => {
    const sections = [];
    let currentMonth = '';
    for (const fk of calendarDays) {
      const d = new Date(`${fk}T12:00:00`);
      const label = d.toLocaleDateString(dateLocale, { month: 'long', year: 'numeric' });
      if (label !== currentMonth) {
        currentMonth = label;
        sections.push({ monthLabel: label, days: [] });
      }
      sections[sections.length - 1].days.push(fk);
    }
    return sections;
  }, [calendarDays, dateLocale]);

  const selectedBlocks = selectedKey ? blocksByDate.get(selectedKey) || [] : [];

  const formatChipDate = (fk) => {
    try {
      return new Date(`${fk}T12:00:00`).toLocaleDateString(dateLocale, {
        day: 'numeric',
        month: 'short',
      });
    } catch {
      return fk;
    }
  };

  if (blocksByDate.size === 0) {
    return (
      <Text style={styles.sectionEmptyText}>{tStr('admin_historico_sin_rutinas')}</Text>
    );
  }

  return (
    <View>
      <Text style={styles.historicHint}>{tStr('admin_historico_hint')}</Text>
      {!!planLabel && (
        <Text style={styles.historicPlanHint} numberOfLines={1}>
          {planLabel}
        </Text>
      )}

      {monthSections.map((sec) => (
        <View key={sec.monthLabel} style={styles.historicMonthBlock}>
          <Text style={styles.historicMonthTitle}>{sec.monthLabel}</Text>
          <View style={styles.historicDayGrid}>
            {sec.days.map((fk) => {
              const d = new Date(`${fk}T12:00:00`);
              const has = datesWithBlocks.has(fk);
              const selected = selectedKey === fk;
              return (
                <TouchableOpacity
                  key={fk}
                  disabled={!has}
                  onPress={() => setSelectedKey(fk)}
                  accessibilityLabel={formatChipDate(fk)}
                  style={[
                    styles.historicDayCell,
                    has && styles.historicDayCellHasData,
                    selected && styles.historicDayCellSelected,
                    !has && styles.historicDayCellEmpty,
                  ]}
                >
                  <Text
                    style={[
                      styles.historicDayCellText,
                      selected && styles.historicDayCellTextSelected,
                      !has && styles.historicDayCellTextMuted,
                    ]}
                  >
                    {d.getDate()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ))}

      {olderDateKeys.length > 0 ? (
        <View style={styles.historicOlderRow}>
          <Text style={styles.historicOlderLabel}>{tStr('admin_historico_mas_antiguo')}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.historicOlderScroll}
          >
            {olderDateKeys.map((fk) => {
              const selected = selectedKey === fk;
              return (
                <TouchableOpacity
                  key={fk}
                  onPress={() => setSelectedKey(fk)}
                  style={[styles.historicOlderChip, selected && styles.historicOlderChipSelected]}
                >
                  <Text
                    style={[
                      styles.historicOlderChipText,
                      selected && styles.historicOlderChipTextSelected,
                    ]}
                  >
                    {formatChipDate(fk)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.historicSelectedPanel}>
        {selectedKey ? (
          <Text style={styles.historicSelectedDateLabel}>
            {new Date(`${selectedKey}T12:00:00`).toLocaleDateString(dateLocale, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </Text>
        ) : null}
        {selectedBlocks.length === 0 ? (
          <Text style={styles.sectionEmptyText}>{tStr('admin_historico_sin_fecha')}</Text>
        ) : (
          <ScrollView
            nestedScrollEnabled
            style={styles.historicSelectedScroll}
            contentContainerStyle={styles.historicSelectedScrollContent}
            showsVerticalScrollIndicator
          >
            {selectedBlocks.map((b) => renderBlock(b))}
          </ScrollView>
        )}
      </View>
    </View>
  );
}
