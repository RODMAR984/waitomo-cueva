// Ficha miembro (staff): datos básicos + resumen IA a partir de perfil / reservas / abonos de la org.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BackgroundWrapper from '../../components/BackgroundWrapper';
import BackNavButton from '../../components/BackNavButton';
import { supabase } from '../../supabaseClient';
import { draftMemberSummaryWithAi } from '../../utils/aiAssistant';
import { trackEvent } from '../../utils/observability';
import { useAuth } from '../../contexts/AuthContext';
import { useThemeContext } from '../../contexts/ThemeContext';
import { useLocale } from '../../contexts/LocaleContext';
import useStaffWebHideInlineBack from '../../hooks/useStaffWebHideInlineBack';
import { WEB_CONTENT_MAX_WIDTH } from '../../theme/webSpec';
import { MOBILE_RADII, MOBILE_SPACING, MOBILE_TYPE } from '../../theme/mobileSpec';

const BOOKINGS_FACTS_LIMIT = 28;

function parseSessionDay(iso) {
  if (!iso) return null;
  const s = String(iso).slice(0, 10);
  const d = new Date(`${s}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysBetweenUtcMidnight(fromDay, toDay) {
  return Math.round((toDay.getTime() - fromDay.getTime()) / 86400000);
}

/** Resumen numérico de asistencia a partir de class_bookings (misma ventana que la lista). */
function attendanceSummaryLines(books, locale) {
  const L = locale === 'en';
  const lines = [];
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  const list = Array.isArray(books) ? books : [];
  if (!list.length) {
    lines.push(L ? 'No bookings on file for this gym.' : 'No hay reservas cargadas para esta sede.');
    return lines;
  }

  let lastAttended = null;
  for (const b of list) {
    if (String(b.status || '') !== 'completed_attended') continue;
    const d = parseSessionDay(b.session_date);
    if (!d) continue;
    if (!lastAttended || d > lastAttended) lastAttended = d;
  }

  const cutoff30 = new Date(today);
  cutoff30.setDate(cutoff30.getDate() - 30);
  let attendedLast30 = 0;
  let noShowLast30 = 0;
  let cancelledLast30 = 0;
  for (const b of list) {
    const d = parseSessionDay(b.session_date);
    if (!d || d < cutoff30) continue;
    const st = String(b.status || '');
    if (st === 'completed_attended') attendedLast30 += 1;
    if (st === 'completed_no_show') noShowLast30 += 1;
    if (st === 'cancelled') cancelledLast30 += 1;
  }

  let noShowInList = 0;
  let cancelledInList = 0;
  for (const b of list) {
    const st = String(b.status || '');
    if (st === 'completed_no_show') noShowInList += 1;
    if (st === 'cancelled') cancelledInList += 1;
  }

  const upcoming = list
    .filter((b) => String(b.status || '') === 'scheduled')
    .map((b) => ({ b, d: parseSessionDay(b.session_date) }))
    .filter((x) => x.d && x.d >= today)
    .sort((a, b) => a.d.getTime() - b.d.getTime())[0];

  if (!lastAttended) {
    lines.push(
      L
        ? `No "completed_attended" in the last ${BOOKINGS_FACTS_LIMIT} booking rows (older history may exist).`
        : `No hay ninguna reserva con estado "completed_attended" entre las últimas ${BOOKINGS_FACTS_LIMIT} filas (puede haber asistencias más viejas que no entran en esta lista).`,
    );
  } else {
    const daysSince = daysBetweenUtcMidnight(lastAttended, today);
    const fmt = (d) =>
      d.toLocaleDateString(L ? 'en-US' : 'es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
    lines.push(
      L
        ? `Last attended class: ${fmt(lastAttended)} (${daysSince} day(s) ago).`
        : `Última clase asistida: ${fmt(lastAttended)} (hace ${daysSince} día(s)).`,
    );
  }

  lines.push(
    L
      ? `Completed attendances in last 30 days (within this list): ${attendedLast30}`
      : `Clases marcadas como asistidas en los últimos 30 días (según esta lista): ${attendedLast30}`,
  );
  lines.push(
    L
      ? `No-shows (completed_no_show) last 30 days: ${noShowLast30}; in whole list: ${noShowInList}.`
      : `Ausencias confirmadas (completed_no_show) últimos 30 días: ${noShowLast30}; en toda la lista: ${noShowInList}.`,
  );
  lines.push(
    L
      ? `Cancellations (cancelled) last 30 days: ${cancelledLast30}; in whole list: ${cancelledInList}.`
      : `Cancelaciones (cancelled) últimos 30 días: ${cancelledLast30}; en toda la lista: ${cancelledInList}.`,
  );

  if (upcoming) {
    const fmt = (d) =>
      d.toLocaleDateString(L ? 'en-US' : 'es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
    lines.push(
      L
        ? `Next scheduled class in list: ${fmt(upcoming.d)} ${upcoming.b.plan_key} ${upcoming.b.slot_label}`
        : `Próxima clase agendada (en la lista): ${fmt(upcoming.d)} ${upcoming.b.plan_key} ${upcoming.b.slot_label}`,
    );
  } else {
    lines.push(L ? 'No future "scheduled" class in this list.' : 'No hay clase futura con estado "scheduled" en esta lista.');
  }

  lines.push(
    L
      ? `Note: counts are based on at most the last ${BOOKINGS_FACTS_LIMIT} booking rows.`
      : `Nota: los números salen de como máximo las últimas ${BOOKINGS_FACTS_LIMIT} reservas.`,
  );
  return lines;
}

/** Fin de abono próximo (misma ventana de filas que la lista de abonos). */
function subscriptionAlertLines(subsInOrg, aboById, locale, today, fmtDate) {
  const L = locale === 'en';
  const lines = [];
  if (!subsInOrg.length) {
    lines.push(L ? 'No subscription rows for this gym.' : 'Sin abonos de esta sede para calcular vencimientos.');
    return lines;
  }
  let anyWindow = false;
  for (const row of subsInOrg) {
    const end = parseSessionDay(row.end_date);
    if (!end) continue;
    const daysLeft = daysBetweenUtcMidnight(today, end);
    if (daysLeft < 0 || daysLeft > 21) continue;
    anyWindow = true;
    const nm = row.abono_id ? aboById[row.abono_id]?.name : '';
    const label = nm || row.plan_id;
    lines.push(
      L
        ? `Pass "${label}" status=${row.status}: ends ${fmtDate(row.end_date)} (${daysLeft} day(s) left).`
        : `Abono "${label}" estado=${row.status}: vence ${fmtDate(row.end_date)} (quedan ${daysLeft} día(s)).`,
    );
  }
  if (!anyWindow) {
    lines.push(
      L
        ? 'No pass ending within the next 21 days in listed rows (or end_date not set).'
        : 'Ningún vencimiento en los próximos 21 días entre los abonos listados (o sin fecha de fin).',
    );
  }
  return lines;
}

async function buildFactsText({ orgId, userId, displayName, locale }) {
  const loc = locale === 'en' ? 'en-US' : 'es-AR';
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const fmtDate = (d) => {
    if (!d) return '';
    try {
      return new Date(d).toLocaleDateString(loc, { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return String(d);
    }
  };

  const { data: prof, error: pe } = await supabase
    .from('profiles')
    .select('full_name, username, phone, edad, objetivos, lesiones, observaciones')
    .eq('id', userId)
    .maybeSingle();
  if (pe) throw pe;

  const { data: books, error: be } = await supabase
    .from('class_bookings')
    .select('session_date, plan_key, slot_label, status')
    .eq('organization_id', orgId)
    .eq('user_id', userId)
    .order('session_date', { ascending: false })
    .limit(BOOKINGS_FACTS_LIMIT);
  if (be) throw be;

  const { data: subs, error: se } = await supabase
    .from('user_abonos')
    .select('plan_id, status, start_date, end_date, sessions_total, sessions_used, abono_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(15);
  if (se) throw se;

  const aboIds = [...new Set((subs || []).map((r) => r.abono_id).filter(Boolean))];
  let aboById = {};
  if (aboIds.length) {
    const { data: abos, error: ae } = await supabase
      .from('abonos')
      .select('id, name, organization_id')
      .in('id', aboIds);
    if (ae) throw ae;
    (abos || []).forEach((a) => {
      aboById[a.id] = a;
    });
  }

  const subsInOrg = (subs || []).filter((row) => {
    if (!row.abono_id) return false;
    const a = aboById[row.abono_id];
    return a?.organization_id === orgId;
  });

  const lines = [];
  const L = locale === 'en';
  lines.push(L ? `Member (display): ${displayName}` : `Miembro (nombre en lista): ${displayName}`);
  lines.push(L ? `User id: ${userId}` : `ID usuario: ${userId}`);
  lines.push('');
  lines.push(L ? '--- Profile (self-reported) ---' : '--- Perfil (autorreportado) ---');
  if (prof) {
    lines.push(L ? `Name: ${prof.full_name || '—'}` : `Nombre: ${prof.full_name || '—'}`);
    lines.push(L ? `Username: ${prof.username || '—'}` : `Usuario: ${prof.username || '—'}`);
    lines.push(L ? `Phone: ${prof.phone || '—'}` : `Teléfono: ${prof.phone || '—'}`);
    lines.push(L ? `Age: ${prof.edad != null ? prof.edad : '—'}` : `Edad: ${prof.edad != null ? prof.edad : '—'}`);
    lines.push(L ? `Goals: ${prof.objetivos || '—'}` : `Objetivos: ${prof.objetivos || '—'}`);
    lines.push(L ? `Injuries: ${prof.lesiones || '—'}` : `Lesiones: ${prof.lesiones || '—'}`);
    lines.push(L ? `Notes: ${prof.observaciones || '—'}` : `Observaciones: ${prof.observaciones || '—'}`);
  } else {
    lines.push(L ? 'No profile row.' : 'Sin fila de perfil.');
  }
  lines.push('');
  lines.push(L ? '--- Passes / subscriptions (this gym only) ---' : '--- Abonos / membresía (solo esta sede) ---');
  if (!subsInOrg.length) {
    lines.push(L ? 'No subscription rows linked to this gym.' : 'Sin abonos vinculados a esta sede.');
  } else {
    subsInOrg.forEach((row, i) => {
      const nm = row.abono_id ? aboById[row.abono_id]?.name : null;
      lines.push(
        `${i + 1}) plan_id=${row.plan_id} status=${row.status} ${fmtDate(row.start_date)}–${fmtDate(row.end_date)} sessions=${row.sessions_used ?? '?'}/${row.sessions_total ?? '?'} abono=${nm || row.abono_id || '—'}`,
      );
    });
  }
  lines.push('');
  lines.push(
    L ? '--- Subscription alerts (computed) ---' : '--- Alertas de membresía (calculado) ---',
  );
  subscriptionAlertLines(subsInOrg, aboById, locale, today, fmtDate).forEach((ln) => lines.push(ln));

  lines.push('');
  lines.push(
    L ? '--- Attendance summary (computed) ---' : '--- Resumen de asistencia (calculado) ---',
  );
  attendanceSummaryLines(books, locale).forEach((ln) => lines.push(ln));

  lines.push('');
  lines.push(L ? '--- Class bookings (this gym, most recent first) ---' : '--- Reservas de clase (esta sede, más recientes) ---');
  if (!books?.length) {
    lines.push(L ? 'No booking rows.' : 'Sin reservas.');
  } else {
    books.forEach((b, i) => {
      lines.push(
        `${i + 1}) ${fmtDate(b.session_date)} ${b.plan_key} ${b.slot_label} [${b.status}]`,
      );
    });
  }
  return lines.join('\n');
}

export default function OrgMemberDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const hideInlineBack = useStaffWebHideInlineBack();
  const insets = useSafeAreaInsets();
  const { t } = useThemeContext();
  const { t: tStr, locale } = useLocale();
  const { organization } = useAuth();

  const userId = route.params?.userId;
  const displayName = route.params?.displayName || userId || '';

  const orgId = organization?.id || null;

  const [factsLoading, setFactsLoading] = useState(true);
  const [factsError, setFactsError] = useState(null);
  const [factsText, setFactsText] = useState('');

  const [summary, setSummary] = useState('');
  const [aiBusy, setAiBusy] = useState(false);

  const loadFacts = useCallback(async () => {
    if (!orgId || !userId) {
      setFactsLoading(false);
      setFactsText('');
      setFactsError(!orgId ? 'no_org' : 'no_user');
      return;
    }
    setFactsLoading(true);
    setFactsError(null);
    try {
      const text = await buildFactsText({ orgId, userId, displayName, locale });
      setFactsText(text);
    } catch (e) {
      setFactsError(e?.message || String(e));
      setFactsText('');
    } finally {
      setFactsLoading(false);
    }
  }, [orgId, userId, displayName, locale]);

  useEffect(() => {
    if (!userId) return;
    loadFacts();
  }, [loadFacts, userId]);

  const onGenerateSummary = async () => {
    if (!orgId) {
      Alert.alert(tStr('gym_config_alert_title_error'), tStr('org_member_no_org'));
      return;
    }
    if (!factsText.trim()) {
      Alert.alert(tStr('gym_config_alert_title_error'), tStr('org_member_no_data_for_ai'));
      return;
    }
    setAiBusy(true);
    try {
      const out = await draftMemberSummaryWithAi({
        organizationId: orgId,
        factsText,
        displayName,
        locale,
      });
      const text = String(out?.result?.result_text || '').trim();
      if (!text) throw new Error(tStr('org_member_summary_fail'));
      setSummary(text);
      trackEvent('admin_member_summary_ai_ok', { organization_id: orgId, target_user_id: userId });
    } catch (e) {
      const msg = String(e?.message || '');
      if (msg.toLowerCase().includes('quota')) {
        Alert.alert(tStr('admin_ai_quota_title'), tStr('admin_ai_quota_body'));
      } else {
        Alert.alert(tStr('gym_config_alert_title_error'), msg || tStr('org_member_summary_fail'));
      }
    } finally {
      setAiBusy(false);
    }
  };

  const onCopy = async () => {
    const s = summary.trim();
    if (!s) {
      Alert.alert(tStr('gym_config_alert_title_error'), tStr('org_member_summary_empty'));
      return;
    }
    try {
      await Clipboard.setStringAsync(s);
      Alert.alert(tStr('gym_config_copied_title'), tStr('org_member_summary_copied'));
    } catch (e) {
      Alert.alert(tStr('gym_config_alert_title_error'), e?.message || String(e));
    }
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: MOBILE_SPACING.xl,
          paddingTop: Math.max(insets.top, 12) + 8,
          paddingBottom: 12,
          width: '100%',
          maxWidth: WEB_CONTENT_MAX_WIDTH,
          alignSelf: 'center',
        },
        backBtn: { marginRight: 8, width: 'auto', maxWidth: 180, alignSelf: 'flex-start' },
        title: {
          flex: 1,
          color: t.brandText ?? t.brand,
          fontSize: MOBILE_TYPE.headline,
          fontWeight: '800',
        },
        body: {
          paddingHorizontal: MOBILE_SPACING.xl,
          paddingBottom: 32,
          width: '100%',
          maxWidth: WEB_CONTENT_MAX_WIDTH,
          alignSelf: 'center',
        },
        name: { color: t.text, fontSize: MOBILE_TYPE.lead, fontWeight: '800', marginBottom: 4 },
        subId: { color: t.subText, fontSize: MOBILE_TYPE.caption, marginBottom: MOBILE_SPACING.lg },
        hint: { color: t.subText, fontSize: MOBILE_TYPE.body, lineHeight: 19, marginBottom: MOBILE_SPACING.lg },
        primaryBtn: {
          backgroundColor: t.brand,
          borderRadius: MOBILE_RADII.md,
          paddingVertical: 14,
          paddingHorizontal: MOBILE_SPACING.lg,
          marginBottom: 10,
          alignItems: 'center',
        },
        primaryBtnDisabled: { opacity: 0.55 },
        primaryBtnText: { color: '#fff', fontSize: MOBILE_TYPE.bodyStrong, fontWeight: '800' },
        secondaryBtn: {
          borderWidth: 1,
          borderColor: t.brand,
          borderRadius: MOBILE_RADII.md,
          paddingVertical: 12,
          paddingHorizontal: MOBILE_SPACING.lg,
          marginBottom: 20,
          alignItems: 'center',
        },
        secondaryBtnText: { color: t.brand, fontSize: MOBILE_TYPE.bodyStrong, fontWeight: '700' },
        sectionLabel: { color: t.subText, fontSize: MOBILE_TYPE.caption, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase' },
        summaryBox: {
          backgroundColor: t.boxBg,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          borderRadius: MOBILE_RADII.lg,
          padding: 14,
          marginBottom: 12,
        },
        summaryText: { color: t.text, fontSize: MOBILE_TYPE.bodyStrong, lineHeight: 22 },
        emptySummary: { color: t.placeholder, fontSize: MOBILE_TYPE.body, fontStyle: 'italic' },
        err: { color: t.danger, marginBottom: 12, fontSize: MOBILE_TYPE.body },
        factsPreview: {
          marginTop: 8,
          padding: 12,
          borderRadius: MOBILE_RADII.sm,
          backgroundColor: t.inputBg,
          borderWidth: 1,
          borderColor: t.overlayBorder,
        },
        factsPreviewText: { color: t.placeholder, fontSize: MOBILE_TYPE.meta, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
      }),
    [t, insets.top],
  );

  if (!userId) {
    return (
      <BackgroundWrapper screen="admin">
        <View
          style={{
            padding: 24,
            paddingTop: Math.max(insets.top, 12) + 20,
            width: '100%',
            maxWidth: WEB_CONTENT_MAX_WIDTH,
            alignSelf: 'center',
          }}
        >
          {!hideInlineBack ? (
            <BackNavButton onPress={() => navigation.goBack()} label={tStr('common_back')} style={{ marginBottom: 16 }} />
          ) : null}
          <Text style={{ color: t.subText, fontSize: MOBILE_TYPE.bodyStrong }}>{tStr('org_member_missing')}</Text>
        </View>
      </BackgroundWrapper>
    );
  }

  return (
    <BackgroundWrapper screen="admin">
      <View style={styles.header}>
        {!hideInlineBack ? (
          <BackNavButton onPress={() => navigation.goBack()} label={tStr('common_back')} style={styles.backBtn} />
        ) : null}
        <Text style={styles.title} numberOfLines={1}>
          {tStr('org_member_detail_title')}
        </Text>
      </View>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.name} numberOfLines={2}>
          {displayName}
        </Text>
        <Text style={styles.subId} selectable>
          {userId}
        </Text>
        <Text style={styles.hint}>{tStr('org_member_summary_hint')}</Text>

        {factsError === 'no_org' ? <Text style={styles.err}>{tStr('org_member_no_org')}</Text> : null}
        {factsError && factsError !== 'no_org' ? <Text style={styles.err}>{factsError}</Text> : null}
        {factsError && factsError !== 'no_org' ? (
          <TouchableOpacity style={styles.secondaryBtn} onPress={loadFacts} activeOpacity={0.85}>
            <Text style={styles.secondaryBtnText}>{tStr('org_member_retry')}</Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          style={[styles.primaryBtn, (aiBusy || factsLoading || !factsText) && styles.primaryBtnDisabled]}
          onPress={onGenerateSummary}
          disabled={aiBusy || factsLoading || !factsText}
          activeOpacity={0.9}
        >
          {aiBusy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>{tStr('org_member_summary_btn')}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryBtn} onPress={onCopy} activeOpacity={0.85}>
          <Text style={styles.secondaryBtnText}>{tStr('org_member_summary_copy')}</Text>
        </TouchableOpacity>

        <Text style={styles.sectionLabel}>{locale === 'en' ? 'AI summary' : 'Resumen IA'}</Text>
        <View style={styles.summaryBox}>
          {summary.trim() ? (
            <Text style={styles.summaryText}>{summary}</Text>
          ) : (
            <Text style={styles.emptySummary}>{tStr('org_member_summary_empty')}</Text>
          )}
        </View>

        {factsLoading ? (
          <View style={{ paddingVertical: 16, alignItems: 'center' }}>
            <ActivityIndicator color={t.brand} />
            <Text style={{ color: t.subText, marginTop: 8 }}>{tStr('org_member_facts_loading')}</Text>
          </View>
        ) : factsText ? (
          <View style={styles.factsPreview}>
            <Text style={styles.factsPreviewText} selectable numberOfLines={14}>
              {factsText}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </BackgroundWrapper>
  );
}
