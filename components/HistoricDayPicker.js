import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  HISTORIC_RECENT_DAYS_EXCLUSIVE,
  buildHistoricMonthGrids,
} from '../utils/historicCalendarMonths';

function blockFechaKey(b, fechaKeyFrom) {
  if (b?.fechaKey) return b.fechaKey;
  try {
    return fechaKeyFrom(new Date(b?.fecha || 0));
  } catch {
    return '';
  }
}

function HistoricMonthGrid({
  month,
  weekdayLabels,
  datesWithBlocks,
  selectedKey,
  onPickDay,
  styles,
}) {
  return (
    <View style={styles.historicMonthCol}>
      <Text style={styles.historicMonthTitle}>{month.title}</Text>
      <View style={styles.historicWeekdayRow}>
        {weekdayLabels.map((label, i) => (
          <Text key={`${month.monthKey}-wd-${i}`} style={styles.historicWeekdayLabel}>
            {label}
          </Text>
        ))}
      </View>
      {month.weeks.map((week, wi) => (
        <View key={`${month.monthKey}-w-${wi}`} style={styles.historicWeekRow}>
          {week.map((cell, ci) => {
            if (!cell) {
              return <View key={`${month.monthKey}-${wi}-${ci}`} style={styles.historicDayCellEmptySlot} />;
            }
            const { fk, day, inRange } = cell;
            const has = inRange && datesWithBlocks.has(fk);
            const selected = selectedKey === fk;
            const disabled = !inRange || !has;
            return (
              <TouchableOpacity
                key={fk}
                disabled={disabled}
                onPress={() => onPickDay(fk)}
                style={[
                  styles.historicDayCell,
                  !inRange && styles.historicDayCellOutOfRange,
                  inRange && has && styles.historicDayCellHasData,
                  selected && styles.historicDayCellSelected,
                  inRange && !has && styles.historicDayCellNoData,
                ]}
              >
                <Text
                  style={[
                    styles.historicDayCellText,
                    !inRange && styles.historicDayCellTextOutOfRange,
                    selected && styles.historicDayCellTextSelected,
                    inRange && !has && styles.historicDayCellTextMuted,
                  ]}
                >
                  {day}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

/**
 * Selector de día histórico: 2 meses calendario + parciales, colapsable y compacto.
 */
export default function HistoricDayPicker({
  blocks,
  fechaKeyFrom,
  dateLocale,
  tStr,
  styles,
  planLabel,
  renderBlock,
  brandColor,
  isDesktopWeb,
}) {
  const calendar = useMemo(() => buildHistoricMonthGrids(dateLocale), [dateLocale]);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const sevenAgo = useMemo(() => {
    const n = new Date();
    n.setHours(12, 0, 0, 0);
    n.setDate(n.getDate() - HISTORIC_RECENT_DAYS_EXCLUSIVE);
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
  const hasAnyHistoric = blocksByDate.size > 0;

  const olderDateKeys = useMemo(
    () =>
      [...blocksByDate.keys()]
        .filter((fk) => fk < calendar.rangeStartKey)
        .sort((a, b) => b.localeCompare(a)),
    [blocksByDate, calendar.rangeStartKey],
  );

  const [selectedKey, setSelectedKey] = useState(null);

  const blocksFingerprint = useMemo(
    () => [...blocksByDate.keys()].sort().join(','),
    [blocksByDate],
  );

  useEffect(() => {
    const inCalendar = calendar.inRangeKeys.filter((fk) => blocksByDate.has(fk));
    const pick = inCalendar[inCalendar.length - 1] || olderDateKeys[0] || null;
    setSelectedKey(pick);
  }, [blocksFingerprint, planLabel, calendar.inRangeKeys, blocksByDate, olderDateKeys]);

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

  const formatFullDate = (fk) => {
    try {
      return new Date(`${fk}T12:00:00`).toLocaleDateString(dateLocale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return fk;
    }
  };

  const pickDay = (fk) => {
    setSelectedKey(fk);
    setCalendarOpen(false);
  };

  const summaryText = selectedKey
    ? formatFullDate(selectedKey)
    : hasAnyHistoric
      ? tStr('admin_historico_elegi_dia')
      : tStr('admin_historico_sin_rutinas');

  return (
    <View>
      <TouchableOpacity
        style={styles.historicCalendarToggle}
        onPress={() => setCalendarOpen((v) => !v)}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityState={{ expanded: calendarOpen }}
      >
        <View style={styles.historicCalendarToggleLeft}>
          <Ionicons name="calendar-outline" size={15} color={brandColor} />
          <Text style={styles.historicCalendarToggleTitle} numberOfLines={1}>
            {tStr('admin_historico')}{' '}
            <Text style={styles.historicCalendarToggleSub}>{summaryText}</Text>
          </Text>
        </View>
        <Ionicons
          name={calendarOpen ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={brandColor}
        />
      </TouchableOpacity>

      {calendarOpen ? (
        <View style={styles.historicCalendarPanel}>
          {!hasAnyHistoric ? (
            <Text style={[styles.sectionEmptyText, styles.historicEmptyBanner]}>
              {tStr('admin_historico_sin_rutinas')}
            </Text>
          ) : null}

          <ScrollView
            nestedScrollEnabled
            style={styles.historicCalendarScroll}
            contentContainerStyle={styles.historicCalendarScrollContent}
            showsVerticalScrollIndicator
          >
            <View style={isDesktopWeb ? styles.historicMonthsRow : null}>
              {calendar.months.map((month) => (
                <HistoricMonthGrid
                  key={month.monthKey}
                  month={month}
                  weekdayLabels={calendar.weekdayLabels}
                  datesWithBlocks={datesWithBlocks}
                  selectedKey={selectedKey}
                  onPickDay={pickDay}
                  styles={styles}
                />
              ))}
            </View>
          </ScrollView>

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
                      onPress={() => pickDay(fk)}
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
        </View>
      ) : null}

      {selectedKey && selectedBlocks.length > 0 ? (
        <View style={styles.historicSelectedPanel}>
          <Text style={styles.historicSelectedDateLabel}>{formatFullDate(selectedKey)}</Text>
          <ScrollView
            nestedScrollEnabled
            style={styles.historicSelectedScroll}
            contentContainerStyle={styles.historicSelectedScrollContent}
            showsVerticalScrollIndicator
          >
            {selectedBlocks.map((b) => renderBlock(b))}
          </ScrollView>
        </View>
      ) : selectedKey && hasAnyHistoric && !calendarOpen ? (
        <Text style={styles.historicInlineEmpty}>{tStr('admin_historico_sin_fecha')}</Text>
      ) : null}
    </View>
  );
}
