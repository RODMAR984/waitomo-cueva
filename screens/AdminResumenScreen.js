// Panel resumen admin: agenda del día (rutinas publicadas) + inscriptos por franja (reservas en app)
// + reservas sin franja publicada + cancelaciones del día + cobros pendientes (caja).

import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BackgroundWrapper from '../components/BackgroundWrapper';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { useThemeContext } from '../contexts/ThemeContext';
import { useLocale } from '../contexts/LocaleContext';
import { formatYmdLocal } from '../utils/formatYmdLocal';
import { normalizePlanKey } from '../utils/planKeyNormalize';
import { normalizeSlotLabel } from '../utils/freeClassGrantStorage';
import { isUserAbonoActive, abonoCoversUserPlan } from '../utils/clientWorkoutEntitlement';

function hexToRgbaLocal(hex, alpha = 1) {
  const clean = String(hex || '').replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g0 = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return `rgba(${r},${g0},${b},${alpha})`;
}

function shiftYmd(ymd, deltaDays) {
  const parts = String(ymd || '').split('-').map((x) => Number(x));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return formatYmdLocal();
  const dt = new Date(parts[0], parts[1] - 1, parts[2]);
  dt.setDate(dt.getDate() + deltaDays);
  return formatYmdLocal(dt);
}

function matchKey(planKey, slotLabel) {
  const pk = normalizePlanKey(planKey) || String(planKey || '').toLowerCase().trim() || '—';
  const sl = normalizeSlotLabel(slotLabel) || '—';
  return `${pk}|${sl}`;
}

function latestAbonoByUser(rows) {
  const map = {};
  for (const r of rows || []) {
    const uid = r.user_id;
    if (!uid) continue;
    const prev = map[uid];
    if (!prev || String(r.created_at || '') > String(prev.created_at || '')) map[uid] = r;
  }
  return map;
}

function isPaidStatus(s) {
  const x = String(s || '').toLowerCase().trim();
  return x === 'pagado' || x === 'paid';
}

function statusNorm(s) {
  return String(s || '').toLowerCase().trim();
}

export default function AdminResumenScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { t } = useThemeContext();
  const { t: tStr, locale } = useLocale();
  const { organization, profile } = useAuth() || {};
  const orgId = organization?.id ?? profile?.organization_id ?? null;

  const [ymd, setYmd] = useState(() => formatYmdLocal());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [grantsScheduled, setGrantsScheduled] = useState([]);
  const [grantsOther, setGrantsOther] = useState([]);
  const [planByCode, setPlanByCode] = useState({});
  const [coachById, setCoachById] = useState({});
  const [profilesById, setProfilesById] = useState({});
  const [abonoByUser, setAbonoByUser] = useState({});
  const [pendingPayments, setPendingPayments] = useState([]);
  const [expandedSlots, setExpandedSlots] = useState({});
  /** Tarjeta colapsada = solo franja + pastilla (como el mock). */
  const [slotListOpen, setSlotListOpen] = useState({});

  const dateLocale = locale === 'en' ? 'en-US' : 'es-ES';

  useEffect(() => {
    setExpandedSlots({});
    setSlotListOpen({});
  }, [ymd]);

  const longDateLabel = useMemo(() => {
    try {
      const [y, m, da] = ymd.split('-').map(Number);
      if ([y, m, da].some((n) => Number.isNaN(n))) return ymd;
      return new Date(y, m - 1, da).toLocaleDateString(dateLocale, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return ymd;
    }
  }, [ymd, dateLocale]);

  const isSlotListOpen = useCallback(
    (slotKey, trialsLen) => {
      if (slotListOpen[slotKey] !== undefined) return slotListOpen[slotKey];
      return trialsLen === 0;
    },
    [slotListOpen],
  );

  const toggleSlotList = useCallback((slotKey, trialsLen) => {
    setSlotListOpen((prev) => {
      const cur = prev[slotKey] !== undefined ? prev[slotKey] : trialsLen === 0;
      return { ...prev, [slotKey]: !cur };
    });
  }, []);

  const load = useCallback(async () => {
    if (!orgId) {
      setBlocks([]);
      setGrantsScheduled([]);
      setGrantsOther([]);
      setPlanByCode({});
      setCoachById({});
      setProfilesById({});
      setAbonoByUser({});
      setPendingPayments([]);
      setError(null);
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const [blocksRes, grantsRes, plansRes, payRes] = await Promise.all([
        supabase
          .from('training_daily_blocks')
          .select('id,plan_key,slot_label,titulo,coach_id,fecha,updated_at')
          .eq('organization_id', orgId)
          .eq('fecha', ymd)
          .order('slot_label', { ascending: true })
          .order('plan_key', { ascending: true }),
        supabase
          .from('trial_class_grants')
          .select('id,user_id,plan_key,session_date,slot_label,status')
          .eq('organization_id', orgId)
          .eq('session_date', ymd)
          .order('slot_label', { ascending: true })
          .order('plan_key', { ascending: true }),
        supabase.from('plans').select('code,title').eq('organization_id', orgId).eq('active', true),
        supabase
          .from('billing_payments')
          .select('id,member_user_id,client_id,status,monto,moneda')
          .eq('organization_id', orgId)
          .limit(800),
      ]);

      if (blocksRes.error) throw blocksRes.error;
      if (grantsRes.error) throw grantsRes.error;
      if (plansRes.error) throw plansRes.error;
      if (payRes.error) throw payRes.error;

      const blockList = Array.isArray(blocksRes.data) ? blocksRes.data : [];
      const grantList = Array.isArray(grantsRes.data) ? grantsRes.data : [];

      setBlocks(blockList);

      const sched = [];
      const other = [];
      for (const g of grantList) {
        if (statusNorm(g.status) === 'scheduled') sched.push(g);
        else other.push(g);
      }
      setGrantsScheduled(sched);
      setGrantsOther(other);

      const planMap = {};
      for (const pl of plansRes.data || []) {
        const code = String(pl.code || '').trim();
        if (!code) continue;
        const title = String(pl.title || code).trim();
        planMap[code] = title;
        const nk = normalizePlanKey(code);
        if (nk) planMap[nk] = title;
      }
      setPlanByCode(planMap);

      const coachIds = [...new Set(blockList.map((b) => b.coach_id).filter(Boolean))];
      const trialUids = [...new Set(sched.map((r) => r.user_id).filter(Boolean))];
      const otherUids = [...new Set(other.map((r) => r.user_id).filter(Boolean))];

      const pend = !payRes.error && Array.isArray(payRes.data) ? payRes.data.filter((r) => !isPaidStatus(r.status)) : [];
      setPendingPayments(pend);
      const debtUids = [...new Set(pend.map((p) => p.member_user_id).filter(Boolean))];

      const needProf = [...new Set([...trialUids, ...otherUids, ...debtUids, ...coachIds])];
      const profMap = {};
      if (needProf.length) {
        const { data: profs, error: pErr } = await supabase
          .from('profiles')
          .select('id, full_name, username')
          .in('id', needProf);
        if (!pErr && Array.isArray(profs)) {
          profs.forEach((p) => {
            const label = (p.full_name || p.username || p.id || '').trim() || p.id;
            profMap[p.id] = label;
          });
        }
      }
      setProfilesById(profMap);

      const coachMap = {};
      coachIds.forEach((cid) => {
        coachMap[cid] = profMap[cid] || cid;
      });
      setCoachById(coachMap);

      let abonoMap = {};
      if (trialUids.length) {
        const { data: abRows, error: aErr } = await supabase
          .from('user_abonos')
          .select('user_id, plan_id, status, start_date, end_date, sessions_total, sessions_used, created_at, abono_id')
          .in('user_id', trialUids);
        if (!aErr && Array.isArray(abRows)) {
          abonoMap = latestAbonoByUser(abRows);
        }
      }
      setAbonoByUser(abonoMap);
    } catch (e) {
      setError(e?.message || String(e));
      setBlocks([]);
      setGrantsScheduled([]);
      setGrantsOther([]);
      setPlanByCode({});
      setCoachById({});
      setProfilesById({});
      setAbonoByUser({});
      setPendingPayments([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orgId, ymd]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const planDisplay = useCallback(
    (planKey) => {
      const raw = String(planKey || '').trim();
      if (!raw) return '—';
      const nk = normalizePlanKey(raw);
      return planByCode[raw] || planByCode[nk] || nk || raw;
    },
    [planByCode],
  );

  const pendingByUserId = useMemo(() => {
    const m = {};
    for (const p of pendingPayments || []) {
      const uid = p.member_user_id;
      if (uid && !m[uid]) m[uid] = p;
    }
    return m;
  }, [pendingPayments]);

  const scheduleRows = useMemo(() => {
    const grantMap = new Map();
    for (const g of grantsScheduled) {
      const k = matchKey(g.plan_key, g.slot_label);
      if (!grantMap.has(k)) grantMap.set(k, []);
      grantMap.get(k).push(g);
    }

    const byKey = new Map();
    for (const b of blocks) {
      const k = matchKey(b.plan_key, b.slot_label);
      if (!byKey.has(k)) {
        byKey.set(k, {
          matchKey: k,
          planKey: b.plan_key,
          slotLabel: b.slot_label,
          blocks: [],
          trials: grantMap.get(k) || [],
        });
        grantMap.delete(k);
      }
      byKey.get(k).blocks.push(b);
    }

    const rows = [...byKey.values()].map((row) => {
      const b0 = row.blocks[0];
      const coachId = b0?.coach_id;
      const coachName = coachById[coachId] || profMapFallback(coachId);
      const extra = row.blocks.length > 1 ? ` (+${row.blocks.length - 1})` : '';
      return {
        ...row,
        titulo: row.blocks.map((x) => String(x.titulo || '').trim()).filter(Boolean).join(' · ') || '—',
        coachName: coachName ? `${coachName}${extra}` : extra || '—',
        planTitle: planDisplay(b0?.plan_key),
      };
    });

    rows.sort((a, b) => {
      const sa = normalizeSlotLabel(a.slotLabel);
      const sb = normalizeSlotLabel(b.slotLabel);
      if (sa !== sb) return String(sa).localeCompare(String(sb), 'es');
      return String(a.planTitle || '').localeCompare(String(b.planTitle || ''), 'es');
    });

    const orphans = [];
    for (const [k, trials] of grantMap) {
      if (!trials.length) continue;
      const g0 = trials[0];
      orphans.push({
        matchKey: k,
        planKey: g0.plan_key,
        slotLabel: g0.slot_label,
        planTitle: planDisplay(g0.plan_key),
        titulo: '—',
        coachName: '—',
        blocks: [],
        trials,
      });
    }
    orphans.sort((a, b) => {
      const sa = normalizeSlotLabel(a.slotLabel);
      const sb = normalizeSlotLabel(b.slotLabel);
      if (sa !== sb) return String(sa).localeCompare(String(sb), 'es');
      return String(a.planTitle || '').localeCompare(String(b.planTitle || ''), 'es');
    });

    return { rows, orphans };
  }, [blocks, grantsScheduled, coachById, planDisplay, profilesById]);

  function profMapFallback(id) {
    return profilesById[id] || id || '—';
  }

  const stats = useMemo(() => {
    let nAbono = 0;
    let nTrial = 0;
    let nDebt = 0;
    for (const g of grantsScheduled) {
      const uid = g.user_id;
      const ab = abonoByUser[uid];
      const planK = g.plan_key;
      const hasAbono = isUserAbonoActive(ab) && abonoCoversUserPlan(ab, planK);
      const debt = !!pendingByUserId[uid];
      if (hasAbono) nAbono += 1;
      else if (debt) nDebt += 1;
      else nTrial += 1;
    }
    return {
      nAbono,
      nTrial,
      nDebt,
      nTrials: grantsScheduled.length,
      nBlocks: blocks.length,
      nOther: grantsOther.length,
    };
  }, [grantsScheduled, abonoByUser, pendingByUserId, blocks.length, grantsOther.length]);

  const badgeForGrant = (g) => {
    const uid = g.user_id;
    const ab = abonoByUser[uid];
    const planK = g.plan_key;
    if (isUserAbonoActive(ab) && abonoCoversUserPlan(ab, planK)) return 'abono';
    if (pendingByUserId[uid]) return 'debt';
    return 'trial';
  };

  const badgeLabel = (kind) => {
    if (kind === 'abono') return tStr('admin_resumen_badge_abono');
    if (kind === 'debt') return tStr('admin_resumen_badge_debt');
    return tStr('admin_resumen_badge_trial');
  };

  const toggleSlotExpand = useCallback((slotKey) => {
    setExpandedSlots((prev) => ({ ...prev, [slotKey]: !prev[slotKey] }));
  }, []);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1 },
        topBar: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 12,
          paddingTop: Math.max(insets.top, 10) + 4,
          paddingBottom: 4,
        },
        backBtn: { padding: 10, marginLeft: -4 },
        iconBtn: { padding: 10 },
        hero: {
          paddingHorizontal: 20,
          paddingBottom: 14,
        },
        heroDateRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 4,
          marginBottom: 6,
        },
        dateNav: { padding: 8 },
        longDate: {
          flex: 1,
          textAlign: 'center',
          color: t.subText,
          fontSize: 14,
          fontWeight: '600',
          paddingHorizontal: 6,
        },
        heroTitle: {
          color: t.text,
          fontSize: 28,
          fontWeight: '800',
          letterSpacing: -0.3,
          marginBottom: 12,
        },
        heroDivider: {
          height: StyleSheet.hairlineWidth,
          backgroundColor: t.overlayBorder,
          marginBottom: 10,
        },
        heroMeta: {
          color: t.placeholder,
          fontSize: 12,
          lineHeight: 18,
        },
        heroFoot: {
          color: t.placeholder,
          fontSize: 11,
          lineHeight: 16,
          marginTop: 6,
        },
        screenTitle: {
          color: t.text,
          fontSize: 28,
          fontWeight: '800',
          paddingHorizontal: 20,
          marginBottom: 8,
        },
        sectionTitle: {
          color: t.text,
          fontSize: 16,
          fontWeight: '800',
          marginHorizontal: 20,
          marginBottom: 10,
          marginTop: 18,
        },
        sectionHint: {
          color: t.placeholder,
          fontSize: 12,
          marginHorizontal: 20,
          marginTop: -6,
          marginBottom: 10,
          lineHeight: 17,
        },
        slotCard: {
          marginHorizontal: 20,
          marginBottom: 14,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          backgroundColor: t.boxBg,
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOpacity: 0.12,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 3 },
          elevation: 3,
        },
        slotHead: {
          paddingHorizontal: 16,
          paddingVertical: 14,
          backgroundColor: t.boxBg,
        },
        slotTopLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
        slotTitleMain: { color: t.text, fontSize: 17, fontWeight: '800', flex: 1 },
        countPill: {
          minWidth: 40,
          alignItems: 'center',
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: t.overlayBorder,
        },
        countPillZero: { backgroundColor: hexToRgbaLocal(t.subText || '#94a3b8', 0.12) },
        countPillHas: { backgroundColor: hexToRgbaLocal(t.brand || '#22d3ee', 0.2) },
        countPillText: { color: t.text, fontSize: 13, fontWeight: '800' },
        slotHeadLine2: { color: t.subText, fontSize: 13, marginTop: 8, lineHeight: 18 },
        slotHeadLine3: { color: t.placeholder, fontSize: 12, marginTop: 4 },
        personRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: t.overlayBorder,
        },
        personName: { color: t.text, fontSize: 15, flex: 1, marginRight: 10 },
        badge: {
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: t.overlayBorder,
        },
        badgeAbono: { backgroundColor: hexToRgbaLocal(t.brand || '#22d3ee', 0.18) },
        badgeTrial: { backgroundColor: t.overlayBg || hexToRgbaLocal(t.subText || '#94a3b8', 0.15) },
        badgeDebt: { backgroundColor: hexToRgbaLocal(t.danger || '#ef4444', 0.2) },
        badgeText: { fontSize: 11, fontWeight: '800', color: t.text },
        mutedRow: {
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: t.overlayBorder,
        },
        mutedText: { color: t.placeholder, fontSize: 13, fontStyle: 'italic' },
        rowActions: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 12,
        },
        moreCount: { color: t.subText, fontSize: 14, fontWeight: '600' },
        linkBtn: {
          paddingVertical: 6,
          paddingHorizontal: 4,
        },
        linkTxt: { color: t.brand, fontSize: 15, fontWeight: '700' },
        empty: { paddingVertical: 22, paddingHorizontal: 24, alignItems: 'center' },
        emptyText: { color: t.placeholder, textAlign: 'center', fontSize: 14, lineHeight: 20 },
        err: { color: t.danger, marginHorizontal: 20, marginBottom: 10, fontSize: 14 },
        payRow: {
          marginHorizontal: 20,
          marginBottom: 8,
          padding: 12,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          backgroundColor: t.boxBg,
        },
        payLine: { color: t.text, fontSize: 14 },
        paySub: { color: t.subText, fontSize: 12, marginTop: 4 },
        cancelRow: {
          marginHorizontal: 20,
          marginBottom: 6,
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderRadius: 10,
          backgroundColor: t.overlayBg,
          borderWidth: 1,
          borderColor: t.overlayBorder,
        },
        cancelLine: { color: t.subText, fontSize: 13 },
      }),
    [t, insets.top],
  );

  const displayName = (uid) => profilesById[uid] || uid || '—';

  const renderTrialRows = (trials, slotKey) => {
    if (!trials.length) {
      return (
        <View style={styles.mutedRow}>
          <Text style={styles.mutedText}>{tStr('admin_resumen_no_bookings_slot')}</Text>
        </View>
      );
    }
    const expanded = !!expandedSlots[slotKey];
    const visibleTrials = expanded ? trials : trials.slice(0, 3);
    const hiddenCount = expanded ? 0 : Math.max(0, trials.length - visibleTrials.length);

    return (
      <>
        {visibleTrials.map((g) => {
      const kind = badgeForGrant(g);
      const badgeStyle =
        kind === 'abono' ? styles.badgeAbono : kind === 'debt' ? styles.badgeDebt : styles.badgeTrial;
      return (
        <View key={g.id} style={styles.personRow}>
          <Text style={styles.personName} numberOfLines={2}>
            {displayName(g.user_id)}
          </Text>
          <View style={[styles.badge, badgeStyle]}>
            <Text style={styles.badgeText}>{badgeLabel(kind)}</Text>
          </View>
        </View>
      );
        })}
        {hiddenCount > 0 ? (
          <View style={styles.rowActions}>
            <Text style={styles.moreCount}>{tStr('admin_resumen_more_people').replace('{{count}}', String(hiddenCount))}</Text>
            <TouchableOpacity style={styles.linkBtn} onPress={() => toggleSlotExpand(slotKey)} activeOpacity={0.85}>
              <Text style={styles.linkTxt}>{tStr('admin_resumen_view_all')}</Text>
            </TouchableOpacity>
          </View>
        ) : trials.length > 3 ? (
          <View style={styles.rowActions}>
            <View />
            <TouchableOpacity style={styles.linkBtn} onPress={() => toggleSlotExpand(slotKey)} activeOpacity={0.85}>
              <Text style={styles.linkTxt}>{tStr('admin_resumen_view_less')}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </>
    );
  };

  if (!orgId) {
    return (
      <BackgroundWrapper screen="admin">
        <View style={styles.root}>
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
              <Ionicons name="arrow-back" size={26} color={t.text} />
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
          </View>
          <Text style={styles.screenTitle}>{tStr('admin_resumen_title')}</Text>
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{tStr('admin_resumen_no_org')}</Text>
          </View>
        </View>
      </BackgroundWrapper>
    );
  }

  const { rows: agendaRows, orphans } = scheduleRows;

  const statsLine = tStr('admin_resumen_stats')
    .replace('{{blocks}}', String(stats.nBlocks))
    .replace('{{trials}}', String(stats.nTrials))
    .replace('{{abono}}', String(stats.nAbono))
    .replace('{{trial}}', String(stats.nTrial))
    .replace('{{debt}}', String(stats.nDebt))
    .replace('{{other}}', String(stats.nOther));

  return (
    <BackgroundWrapper screen="admin">
      <View style={styles.root}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={26} color={t.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <TouchableOpacity
            onPress={onRefresh}
            style={styles.iconBtn}
            accessibilityLabel={tStr('common_refresh')}
          >
            <Ionicons name="refresh" size={22} color={t.brand} />
          </TouchableOpacity>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroDateRow}>
            <TouchableOpacity style={styles.dateNav} onPress={() => setYmd((d) => shiftYmd(d, -1))}>
              <Ionicons name="chevron-back" size={24} color={t.brand} />
            </TouchableOpacity>
            <Text style={styles.longDate} numberOfLines={2}>
              {longDateLabel}
            </Text>
            <TouchableOpacity style={styles.dateNav} onPress={() => setYmd((d) => shiftYmd(d, 1))}>
              <Ionicons name="chevron-forward" size={24} color={t.brand} />
            </TouchableOpacity>
          </View>
          <Text style={styles.heroTitle}>{tStr('admin_resumen_title')}</Text>
          <View style={styles.heroDivider} />
          <Text style={styles.heroMeta}>{statsLine}</Text>
          <Text style={styles.heroFoot}>{tStr('admin_resumen_footnote')}</Text>
        </View>

        {loading ? (
          <View style={styles.empty}>
            <ActivityIndicator size="large" color={t.brand} />
          </View>
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 20) + 24 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.brand} />}
            showsVerticalScrollIndicator={false}
          >
            {error ? <Text style={styles.err}>{error}</Text> : null}

            {agendaRows.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>{tStr('admin_resumen_empty_schedule')}</Text>
              </View>
            ) : (
              agendaRows.map((row) => {
                const slotOpen = isSlotListOpen(row.matchKey, row.trials.length);
                return (
                  <View key={row.matchKey} style={styles.slotCard}>
                    <TouchableOpacity
                      activeOpacity={0.9}
                      onPress={() => toggleSlotList(row.matchKey, row.trials.length)}
                    >
                      <View style={styles.slotHead}>
                        <View style={styles.slotTopLine}>
                          <Text style={styles.slotTitleMain}>
                            {tStr('admin_resumen_slot_header')
                              .replace('{{slot}}', String(row.slotLabel || '—'))
                              .replace('{{plan}}', row.planTitle)}
                          </Text>
                          <View
                            style={[
                              styles.countPill,
                              row.trials.length ? styles.countPillHas : styles.countPillZero,
                            ]}
                          >
                            <Text style={styles.countPillText}>{String(row.trials.length)}</Text>
                          </View>
                          <Ionicons
                            name={slotOpen ? 'chevron-up' : 'chevron-down'}
                            size={22}
                            color={t.subText}
                          />
                        </View>
                        {slotOpen ? (
                          <>
                            {row.titulo && row.titulo !== '—' ? (
                              <Text style={styles.slotHeadLine2} numberOfLines={2}>
                                {row.titulo}
                              </Text>
                            ) : null}
                            <Text style={styles.slotHeadLine3}>
                              {tStr('admin_resumen_coach_line').replace('{{coach}}', row.coachName)}
                            </Text>
                          </>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                    {slotOpen ? renderTrialRows(row.trials, row.matchKey) : null}
                  </View>
                );
              })
            )}

            {orphans.length ? (
              <>
                <Text style={styles.sectionTitle}>{tStr('admin_resumen_section_orphan')}</Text>
                <Text style={styles.sectionHint}>{tStr('admin_resumen_orphan_hint')}</Text>
                {orphans.map((row) => {
                  const oKey = `orphan-${row.matchKey}`;
                  const slotOpen = isSlotListOpen(oKey, row.trials.length);
                  return (
                    <View key={oKey} style={styles.slotCard}>
                      <TouchableOpacity
                        activeOpacity={0.9}
                        onPress={() => toggleSlotList(oKey, row.trials.length)}
                      >
                        <View style={styles.slotHead}>
                          <View style={styles.slotTopLine}>
                            <Text style={styles.slotTitleMain}>
                              {tStr('admin_resumen_slot_header')
                                .replace('{{slot}}', String(row.slotLabel || '—'))
                                .replace('{{plan}}', row.planTitle)}
                            </Text>
                            <View
                              style={[
                                styles.countPill,
                                row.trials.length ? styles.countPillHas : styles.countPillZero,
                              ]}
                            >
                              <Text style={styles.countPillText}>{String(row.trials.length)}</Text>
                            </View>
                            <Ionicons
                              name={slotOpen ? 'chevron-up' : 'chevron-down'}
                              size={22}
                              color={t.subText}
                            />
                          </View>
                        </View>
                      </TouchableOpacity>
                      {slotOpen ? renderTrialRows(row.trials, oKey) : null}
                    </View>
                  );
                })}
              </>
            ) : null}

            {grantsOther.length ? (
              <>
                <Text style={[styles.sectionTitle, { marginTop: 16 }]}>{tStr('admin_resumen_section_other')}</Text>
                {grantsOther.map((g) => (
                  <View key={g.id} style={styles.cancelRow}>
                    <Text style={styles.cancelLine}>
                      {displayName(g.user_id)}
                      {' · '}
                      {planDisplay(g.plan_key)}
                      {' · '}
                      {String(g.slot_label || '')}
                      {' · '}
                      {String(g.status || '')}
                    </Text>
                  </View>
                ))}
              </>
            ) : null}

            <Text style={[styles.sectionTitle, { marginTop: 16 }]}>{tStr('admin_resumen_section_billing')}</Text>
            {pendingPayments.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>{tStr('admin_resumen_empty_billing')}</Text>
              </View>
            ) : (
              pendingPayments.slice(0, 40).map((p) => {
                const uid = p.member_user_id;
                const label = uid ? displayName(uid) : String(p.client_id || '—');
                const amount = p.monto != null ? Number(p.monto) : 0;
                const mon = p.moneda || 'ARS';
                return (
                  <View key={p.id || `${p.client_id}-${p.status}`} style={styles.payRow}>
                    <Text style={styles.payLine}>{label}</Text>
                    <Text style={styles.paySub}>
                      {mon} {amount.toLocaleString(dateLocale)}
                      {' · '}
                      {String(p.status || '')}
                    </Text>
                  </View>
                );
              })
            )}
          </ScrollView>
        )}
      </View>
    </BackgroundWrapper>
  );
}
