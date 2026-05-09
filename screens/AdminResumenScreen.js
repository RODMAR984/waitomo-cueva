// Panel resumen admin: agenda del día (rutinas publicadas) + inscriptos por horario (reservas en app)
// + reservas sin bloque publicado + otras + cobros pendientes (caja).

const DEFAULT_CUPO_DEMO = 10;

import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
  Linking,
  TextInput,
  useWindowDimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';

import BackgroundWrapper from '../components/BackgroundWrapper';
import BackNavButton from '../components/BackNavButton';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { useThemeContext } from '../contexts/ThemeContext';
import { useLocale } from '../contexts/LocaleContext';
import { formatYmdLocal } from '../utils/formatYmdLocal';
import { normalizePlanKey } from '../utils/planKeyNormalize';
import { normalizeSlotLabel } from '../utils/freeClassGrantStorage';
import { isUserAbonoActive, abonoCoversUserPlan } from '../utils/clientWorkoutEntitlement';
import { staffCancelClassBookingServer, staffMoveClassBookingServer } from '../utils/classBookingSupabase';
import { reportError, trackEvent } from '../utils/observability';
import useStaffWebHideInlineBack from '../hooks/useStaffWebHideInlineBack';
import { WEB_CONTENT_MAX_WIDTH } from '../theme/webSpec';
import { MOBILE_RADII, MOBILE_SPACING, MOBILE_TYPE } from '../theme/mobileSpec';

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

function ymdInTimeZone(timeZone) {
  const tz = String(timeZone || '').trim() || 'UTC';
  try {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = fmt.formatToParts(new Date());
    const y = parts.find((p) => p.type === 'year')?.value;
    const m = parts.find((p) => p.type === 'month')?.value;
    const d = parts.find((p) => p.type === 'day')?.value;
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch {}
  return formatYmdLocal();
}

function monthBoundsFromYmd(ymd) {
  const [y, m] = String(ymd || '').split('-').map(Number);
  if ([y, m].some(Number.isNaN)) {
    const now = new Date();
    const yy = now.getFullYear();
    const mm = now.getMonth() + 1;
    const first = `${yy}-${String(mm).padStart(2, '0')}-01`;
    return { monthStart: first, monthEnd: shiftYmd(first, 31) };
  }
  const first = `${y}-${String(m).padStart(2, '0')}-01`;
  const nextMonth = m === 12 ? new Date(y + 1, 0, 1) : new Date(y, m, 1);
  const last = formatYmdLocal(new Date(nextMonth.getTime() - 24 * 60 * 60 * 1000));
  return { monthStart: first, monthEnd: last };
}

/** 1=lunes … 7=domingo (igual que plan_week_slots / Calendario). */
function getIsoWeekdayFromYmd(ymd) {
  const [y, m, d] = String(ymd || '').split('-').map(Number);
  if ([y, m, d].some(Number.isNaN)) return 1;
  return new Date(y, m - 1, d).getDay() || 7;
}

function weekSlotMatchesYmd(ymd, planKey, slotLabel, weekSlots) {
  const wd = getIsoWeekdayFromYmd(ymd);
  const pk = normalizePlanKey(planKey);
  const sl = normalizeSlotLabel(slotLabel);
  if (!pk || !sl) return false;
  for (const ws of weekSlots || []) {
    if (Number(ws.weekday) !== wd) continue;
    if (normalizePlanKey(ws.plan_code) !== pk) continue;
    if (normalizeSlotLabel(ws.slot_label) !== sl) continue;
    return true;
  }
  return false;
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
  const hideInlineBack = useStaffWebHideInlineBack();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { t } = useThemeContext();
  const { t: tStr, locale } = useLocale();
  const { organization, profile } = useAuth() || {};
  const orgId = organization?.id ?? profile?.organization_id ?? null;

  const [ymd, setYmd] = useState(() => ymdInTimeZone(organization?.timezone));
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [grantsScheduled, setGrantsScheduled] = useState([]);
  const [grantsOther, setGrantsOther] = useState([]);
  const [classScheduled, setClassScheduled] = useState([]);
  const [classOther, setClassOther] = useState([]);
  const [planByCode, setPlanByCode] = useState({});
  const [planCapacityByCode, setPlanCapacityByCode] = useState({});
  const [coachById, setCoachById] = useState({});
  const [profilesById, setProfilesById] = useState({});
  const [abonoByUser, setAbonoByUser] = useState({});
  const [pendingPayments, setPendingPayments] = useState([]);
  const [aiAlerts, setAiAlerts] = useState([]);
  const [newMembersMonthCount, setNewMembersMonthCount] = useState(0);
  const [abonosDue7dCount, setAbonosDue7dCount] = useState(0);
  const [templateRecipient, setTemplateRecipient] = useState('');
  const [assistantHistory, setAssistantHistory] = useState([]);
  const [expandedSlots, setExpandedSlots] = useState({});
  const [staffActionBusyId, setStaffActionBusyId] = useState('');
  /** Tarjeta colapsada = cabecera (horario) + pastilla de cupo, sin lista. */
  const [slotListOpen, setSlotListOpen] = useState({});
  /** Franjas habituales del plan para el día de la semana de `ymd` (sin exigir bloque publicado). */
  const [weekSlots, setWeekSlots] = useState([]);

  const dateLocale = locale === 'en' ? 'en-US' : 'es-ES';
  const isDesktopWeb = Platform.OS === 'web' && width >= 1200;
  const historyKey = orgId ? `admin_resumen_ai_history:${orgId}` : null;

  useEffect(() => {
    let mounted = true;
    if (!historyKey) {
      setAssistantHistory([]);
      return;
    }
    AsyncStorage.getItem(historyKey)
      .then((raw) => {
        if (!mounted) return;
        const arr = JSON.parse(String(raw || '[]'));
        setAssistantHistory(Array.isArray(arr) ? arr.slice(0, 8) : []);
      })
      .catch(() => {
        if (mounted) setAssistantHistory([]);
      });
    return () => {
      mounted = false;
    };
  }, [historyKey]);

  useEffect(() => {
    setExpandedSlots({});
    setSlotListOpen({});
  }, [ymd]);

  useEffect(() => {
    setYmd(ymdInTimeZone(organization?.timezone));
  }, [orgId, organization?.timezone]);

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

  const isSlotListOpen = useCallback((slotKey) => {
    if (slotListOpen[slotKey] !== undefined) return slotListOpen[slotKey];
    return true;
  }, [slotListOpen]);

  const toggleSlotList = useCallback((slotKey) => {
    setSlotListOpen((prev) => {
      const cur = prev[slotKey] !== undefined ? prev[slotKey] : true;
      return { ...prev, [slotKey]: !cur };
    });
  }, []);

  const formatOccupancyPill = useCallback(
    (n, cap = DEFAULT_CUPO_DEMO) => {
      const a = Math.max(0, n);
      const b = Math.max(1, Number(cap || DEFAULT_CUPO_DEMO));
      let s = tStr('admin_resumen_pill_occupancy').replace('{{a}}', String(a)).replace('{{b}}', String(b));
      if (a >= b) s += ' ' + tStr('admin_resumen_pill_full');
      return s;
    },
    [tStr],
  );

  const load = useCallback(async () => {
    if (!orgId) {
      setBlocks([]);
      setGrantsScheduled([]);
      setGrantsOther([]);
      setClassScheduled([]);
      setClassOther([]);
      setPlanByCode({});
      setPlanCapacityByCode({});
      setCoachById({});
      setProfilesById({});
      setAbonoByUser({});
      setPendingPayments([]);
      setAiAlerts([]);
      setNewMembersMonthCount(0);
      setAbonosDue7dCount(0);
      setWeekSlots([]);
      setError(null);
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const wd = getIsoWeekdayFromYmd(ymd);
      const { monthStart, monthEnd } = monthBoundsFromYmd(ymd);
      const plus7 = shiftYmd(ymd, 7);
      const [blocksRes, grantsRes, classRes, plansRes, payRes, weekSlotsRes, alertsRes, membersRes, dueRes] = await Promise.all([
        supabase
          .from('training_daily_blocks')
          .select('id,plan_key,slot_label,titulo,coach_id,fecha,updated_at,capacity')
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
        supabase
          .from('class_bookings')
          .select('id,user_id,plan_key,session_date,slot_label,status')
          .eq('organization_id', orgId)
          .eq('session_date', ymd)
          .order('slot_label', { ascending: true })
          .order('plan_key', { ascending: true }),
        supabase.from('plans').select('code,title,default_capacity').eq('organization_id', orgId).eq('active', true),
        supabase
          .from('billing_payments')
          .select('id,member_user_id,client_id,status,monto,moneda')
          .eq('organization_id', orgId)
          .limit(800),
        supabase
          .from('plan_week_slots')
          .select('weekday,plan_code,slot_label')
          .eq('organization_id', orgId)
          .eq('weekday', wd),
        supabase
          .from('admin_ai_alerts')
          .select('id, alert_type, severity, title, body, cta_label, cta_route, observed_at')
          .eq('organization_id', orgId)
          .eq('status', 'open')
          .order('observed_at', { ascending: false })
          .limit(6),
        supabase
          .from('organization_memberships')
          .select('id, role, active, created_at')
          .eq('organization_id', orgId)
          .eq('active', true)
          .gte('created_at', `${monthStart}T00:00:00.000Z`)
          .lte('created_at', `${monthEnd}T23:59:59.999Z`)
          .limit(1500),
        supabase
          .from('user_abonos')
          .select('id, end_date, status')
          .eq('organization_id', orgId)
          .gte('end_date', ymd)
          .lte('end_date', plus7)
          .in('status', ['active', 'vigente'])
          .limit(1500),
      ]);

      if (blocksRes.error) throw blocksRes.error;
      if (grantsRes.error) throw grantsRes.error;
      if (classRes.error) throw classRes.error;
      if (plansRes.error) throw plansRes.error;
      if (payRes.error) throw payRes.error;
      if (weekSlotsRes.error) throw weekSlotsRes.error;
      // Si la tabla admin_ai_alerts aún no fue migrada, no romper toda la pantalla.
      const alertsMissingTable =
        !!alertsRes.error &&
        (alertsRes.error.code === '42P01' ||
          String(alertsRes.error.message || '').toLowerCase().includes('admin_ai_alerts'));
      if (alertsRes.error && !alertsMissingTable) throw alertsRes.error;
      if (membersRes.error) throw membersRes.error;
      if (dueRes.error) throw dueRes.error;

      const blockList = Array.isArray(blocksRes.data) ? blocksRes.data : [];
      const grantList = Array.isArray(grantsRes.data) ? grantsRes.data : [];
      const classList = Array.isArray(classRes.data) ? classRes.data : [];

      setBlocks(blockList);
      setWeekSlots(Array.isArray(weekSlotsRes.data) ? weekSlotsRes.data : []);

      const sched = [];
      const other = [];
      for (const g of grantList) {
        if (statusNorm(g.status) === 'scheduled') sched.push(g);
        else other.push(g);
      }
      setGrantsScheduled(sched);
      setGrantsOther(other);

      const classSched = [];
      const classEtc = [];
      for (const g of classList) {
        if (statusNorm(g.status) === 'scheduled') classSched.push(g);
        else classEtc.push(g);
      }
      setClassScheduled(classSched);
      setClassOther(classEtc.map((x) => ({ ...x, source: 'class' })));

      const planMap = {};
      const planCapMap = {};
      for (const pl of plansRes.data || []) {
        const code = String(pl.code || '').trim();
        if (!code) continue;
        const title = String(pl.title || code).trim();
        planMap[code] = title;
        const nk = normalizePlanKey(code);
        if (nk) planMap[nk] = title;
        const cap = pl.default_capacity != null ? Number(pl.default_capacity) : null;
        if (cap && cap > 0) {
          planCapMap[code] = cap;
          if (nk) planCapMap[nk] = cap;
        }
      }
      setPlanByCode(planMap);
      setPlanCapacityByCode(planCapMap);

      const coachIds = [...new Set(blockList.map((b) => b.coach_id).filter(Boolean))];
      const trialUids = [...new Set(sched.map((r) => r.user_id).filter(Boolean))];
      const otherUids = [...new Set(other.map((r) => r.user_id).filter(Boolean))];
      const classUids = [...new Set(classSched.map((r) => r.user_id).filter(Boolean))];
      const classOtherUids = [...new Set(classEtc.map((r) => r.user_id).filter(Boolean))];

      const pend = !payRes.error && Array.isArray(payRes.data) ? payRes.data.filter((r) => !isPaidStatus(r.status)) : [];
      setPendingPayments(pend);
      setAiAlerts(Array.isArray(alertsRes.data) ? alertsRes.data : []);
      const membersList = Array.isArray(membersRes.data) ? membersRes.data : [];
      const newClients = membersList.filter((m) => {
        const role = String(m?.role || '').toLowerCase();
        return !['coach', 'admin', 'owner', 'superadmin'].includes(role);
      }).length;
      setNewMembersMonthCount(newClients);
      const dueList = Array.isArray(dueRes.data) ? dueRes.data : [];
      setAbonosDue7dCount(dueList.length);
      const debtUids = [...new Set(pend.map((p) => p.member_user_id).filter(Boolean))];

      const needProf = [...new Set([...trialUids, ...otherUids, ...classUids, ...classOtherUids, ...debtUids, ...coachIds])];
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
      reportError('admin_resumen_load_failed', e, {
        organizationId: orgId || null,
        ymd,
      });
      setError(e?.message || String(e));
      setBlocks([]);
      setGrantsScheduled([]);
      setGrantsOther([]);
      setClassScheduled([]);
      setClassOther([]);
      setPlanByCode({});
      setPlanCapacityByCode({});
      setCoachById({});
      setProfilesById({});
      setAbonoByUser({});
      setPendingPayments([]);
      setAiAlerts([]);
      setNewMembersMonthCount(0);
      setAbonosDue7dCount(0);
      setWeekSlots([]);
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

  const runAiInsights = useCallback(async () => {
    if (!orgId || aiAnalyzing) return;
    setAiAnalyzing(true);
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke('admin-ai-insights', {
        body: { organization_id: orgId },
      });
      if (invokeErr) throw invokeErr;
      if (!data?.ok) throw new Error(data?.error || tStr('admin_resumen_ai_run_fail'));
      trackEvent('admin_resumen_ai_alerts_run_ok', { organization_id: orgId });
      const entry = {
        id: `${Date.now()}-insights`,
        label: tStr('admin_resumen_history_insights_run'),
        ts: new Date().toISOString(),
      };
      setAssistantHistory((prev) => {
        const next = [entry, ...(Array.isArray(prev) ? prev : [])].slice(0, 8);
        if (historyKey) AsyncStorage.setItem(historyKey, JSON.stringify(next)).catch(() => {});
        return next;
      });
      await load();
    } catch (e) {
      reportError('admin_resumen_ai_alerts_run_failed', e, { organizationId: orgId || null });
      Alert.alert(tStr('gym_config_alert_title_error'), e?.message || tStr('admin_resumen_ai_run_fail'));
    } finally {
      setAiAnalyzing(false);
    }
  }, [aiAnalyzing, load, orgId, tStr, historyKey]);

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
    const participantMap = new Map();
    for (const g of grantsScheduled) {
      const k = matchKey(g.plan_key, g.slot_label);
      if (!participantMap.has(k)) participantMap.set(k, []);
      participantMap.get(k).push({ ...g, source: 'trial' });
    }
    for (const c of classScheduled) {
      const k = matchKey(c.plan_key, c.slot_label);
      if (!participantMap.has(k)) participantMap.set(k, []);
      participantMap.get(k).push({ ...c, source: 'class' });
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
          trials: participantMap.get(k) || [],
        });
        participantMap.delete(k);
      }
      byKey.get(k).blocks.push(b);
    }

    const fromBlocks = [...byKey.values()].map((row) => {
      const b0 = row.blocks[0];
      const coachId = b0?.coach_id;
      const coachName = coachById[coachId] || profMapFallback(coachId);
      const extra = row.blocks.length > 1 ? ` (+${row.blocks.length - 1})` : '';
      return {
        ...row,
        titulo: row.blocks.map((x) => String(x.titulo || '').trim()).filter(Boolean).join(' · ') || '—',
        coachName: coachName ? `${coachName}${extra}` : extra || '—',
        planTitle: planDisplay(b0?.plan_key),
        capacity:
          row.blocks.find((x) => Number.isFinite(Number(x.capacity)) && Number(x.capacity) > 0)?.capacity
          || planCapacityByCode[normalizePlanKey(row.planKey)]
          || planCapacityByCode[row.planKey]
          || DEFAULT_CUPO_DEMO,
        syntheticHabitual: false,
      };
    });

    const habitualRows = [];
    for (const [k, trials] of [...participantMap.entries()]) {
      if (!trials?.length) continue;
      const g0 = trials[0];
      if (!weekSlotMatchesYmd(ymd, g0.plan_key, g0.slot_label, weekSlots)) continue;
      habitualRows.push({
        matchKey: k,
        planKey: g0.plan_key,
        slotLabel: g0.slot_label,
        blocks: [],
        trials,
        titulo: tStr('admin_resumen_habitual_no_block_title'),
        coachName: '—',
        planTitle: planDisplay(g0.plan_key),
        capacity:
          planCapacityByCode[normalizePlanKey(g0.plan_key)]
          || planCapacityByCode[g0.plan_key]
          || DEFAULT_CUPO_DEMO,
        syntheticHabitual: true,
      });
      participantMap.delete(k);
    }

    const rows = [...fromBlocks, ...habitualRows];
    rows.sort((a, b) => {
      const sa = normalizeSlotLabel(a.slotLabel);
      const sb = normalizeSlotLabel(b.slotLabel);
      if (sa !== sb) return String(sa).localeCompare(String(sb), 'es');
      return String(a.planTitle || '').localeCompare(String(b.planTitle || ''), 'es');
    });

    const orphans = [];
    for (const [k, trials] of participantMap) {
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
        capacity:
          planCapacityByCode[normalizePlanKey(g0.plan_key)]
          || planCapacityByCode[g0.plan_key]
          || DEFAULT_CUPO_DEMO,
      });
    }
    orphans.sort((a, b) => {
      const sa = normalizeSlotLabel(a.slotLabel);
      const sb = normalizeSlotLabel(b.slotLabel);
      if (sa !== sb) return String(sa).localeCompare(String(sb), 'es');
      return String(a.planTitle || '').localeCompare(String(b.planTitle || ''), 'es');
    });

    return { rows, orphans };
  }, [
    blocks,
    grantsScheduled,
    classScheduled,
    coachById,
    planDisplay,
    profilesById,
    planCapacityByCode,
    weekSlots,
    ymd,
    tStr,
  ]);

  function profMapFallback(id) {
    return profilesById[id] || id || '—';
  }

  const badgeForGrant = (g) => {
    if (g?.source === 'class') return 'abono';
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
        contentMax: {
          width: '100%',
          alignSelf: 'center',
          maxWidth: Platform.OS === 'web' ? WEB_CONTENT_MAX_WIDTH : undefined,
          flex: 1,
          minHeight: 0,
        },
        mainLayout: {
          flexDirection: isDesktopWeb ? 'row' : 'column',
          columnGap: 14,
        },
        mainColPrimary: {
          flex: isDesktopWeb ? 1.55 : 1,
          minWidth: 0,
        },
        mainColSecondary: {
          flex: isDesktopWeb ? 1 : 1,
          minWidth: 0,
        },
        topBar: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: MOBILE_SPACING.md,
          paddingTop: Math.max(insets.top, 10) + 4,
          paddingBottom: 4,
        },
        backBtn: { marginLeft: 0, width: 'auto', maxWidth: 180, alignSelf: 'flex-start' },
        iconBtn: { padding: 10 },
        hero: {
          paddingHorizontal: MOBILE_SPACING.xl,
          paddingBottom: 14,
          borderRadius: MOBILE_RADII.lg,
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
          fontSize: MOBILE_TYPE.body,
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
        heroHint: {
          color: t.placeholder,
          fontSize: MOBILE_TYPE.body,
          lineHeight: 19,
        },
        screenTitle: {
          color: t.text,
          fontSize: 28,
          fontWeight: '800',
          paddingHorizontal: MOBILE_SPACING.xl,
          marginBottom: 8,
        },
        mainSheet: {
          marginHorizontal: 12,
          marginBottom: 8,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          backgroundColor: t.inputBg,
          paddingVertical: isDesktopWeb ? 12 : 10,
          paddingHorizontal: isDesktopWeb ? 12 : 8,
        },
        sectionCard: {
          marginHorizontal: 12,
          marginBottom: 10,
          borderRadius: MOBILE_RADII.lg,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          backgroundColor: t.inputBg,
          paddingVertical: isDesktopWeb ? 12 : 10,
          paddingHorizontal: isDesktopWeb ? 12 : 8,
        },
        sectionTitle: {
          color: t.text,
          fontSize: MOBILE_TYPE.bodyStrong,
          fontWeight: '800',
          marginHorizontal: isDesktopWeb ? 14 : 20,
          marginBottom: 10,
          marginTop: 18,
        },
        sectionHint: {
          color: t.placeholder,
          fontSize: MOBILE_TYPE.caption,
          marginHorizontal: isDesktopWeb ? 14 : 20,
          marginTop: -6,
          marginBottom: 10,
          lineHeight: 17,
        },
        agendaGrid: {
          flexDirection: isDesktopWeb ? 'row' : 'column',
          flexWrap: isDesktopWeb ? 'wrap' : 'nowrap',
          justifyContent: 'space-between',
          rowGap: 12,
          columnGap: 12,
          paddingHorizontal: 4,
        },
        slotCard: {
          marginHorizontal: 0,
          marginBottom: 0,
          borderRadius: MOBILE_RADII.lg,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          backgroundColor: t.overlayBg || hexToRgbaLocal(t.subText || '#94a3b8', 0.08),
          overflow: 'hidden',
          width: isDesktopWeb ? '49.2%' : '100%',
        },
        slotHead: {
          paddingHorizontal: 14,
          paddingVertical: 12,
          backgroundColor: 'transparent',
        },
        slotTopLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
        slotTitleMain: { color: t.text, fontSize: MOBILE_TYPE.bodyStrong, fontWeight: '800', flex: 1, paddingRight: 4 },
        countPill: {
          flexShrink: 0,
          alignSelf: 'center',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 10,
          paddingVertical: 5,
          minHeight: 30,
          borderRadius: MOBILE_RADII.sm,
          borderWidth: 1,
          borderColor: t.overlayBorder,
        },
        countPillZero: { backgroundColor: hexToRgbaLocal(t.subText || '#94a3b8', 0.12) },
        countPillHas: { backgroundColor: hexToRgbaLocal('#16a34a', 0.16) },
        countPillFull: {
          backgroundColor: hexToRgbaLocal('#b45309', 0.18),
          borderColor: hexToRgbaLocal('#b45309', 0.35),
        },
        countPillText: { fontSize: MOBILE_TYPE.caption, fontWeight: '800', lineHeight: 16 },
        countPillTextZero: { color: t.subText },
        countPillTextOk: { color: '#14532d' },
        countPillTextFull: { color: '#92400e' },
        slotListDivider: {
          height: StyleSheet.hairlineWidth,
          backgroundColor: t.overlayBorder,
          marginHorizontal: 14,
        },
        slotListInner: {
          backgroundColor: hexToRgbaLocal(t.text, 0.03),
          paddingBottom: 4,
        },
        slotHeadLine2: { color: t.subText, fontSize: MOBILE_TYPE.body, marginTop: 8, lineHeight: 18 },
        slotHeadLine3: { color: t.placeholder, fontSize: MOBILE_TYPE.caption, marginTop: 4 },
        personRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: 44,
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: t.overlayBorder,
        },
        personName: {
          color: t.text,
          fontSize: MOBILE_TYPE.bodyStrong,
          lineHeight: 20,
          flex: 1,
          marginRight: 10,
        },
        badge: {
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderRadius: MOBILE_RADII.pill,
          borderWidth: 1,
          borderColor: 'transparent',
        },
        badgeAbono: { backgroundColor: hexToRgbaLocal('#15803d', 0.2) },
        badgeTrial: { backgroundColor: hexToRgbaLocal('#a8a29e', 0.22) },
        badgeDebt: { backgroundColor: hexToRgbaLocal('#b45309', 0.2) },
        badgeTextAbono: { fontSize: MOBILE_TYPE.caption, fontWeight: '800', color: '#166534' },
        badgeTextTrial: { fontSize: MOBILE_TYPE.caption, fontWeight: '800', color: '#57534e' },
        badgeTextDebt: { fontSize: MOBILE_TYPE.caption, fontWeight: '800', color: '#92400e' },
        personRight: { alignItems: 'flex-end' },
        staffActionsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 8 },
        staffActionBtn: {
          paddingHorizontal: 8,
          paddingVertical: 2,
          borderRadius: MOBILE_RADII.pill,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          backgroundColor: t.boxBg,
        },
        staffActionTxt: { color: t.brand, fontSize: MOBILE_TYPE.caption, fontWeight: '700' },
        staffActionTxtMuted: { color: t.subText, fontSize: MOBILE_TYPE.caption, fontWeight: '700' },
        mutedRow: {
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: t.overlayBorder,
        },
        mutedText: { color: t.placeholder, fontSize: MOBILE_TYPE.body, fontStyle: 'italic' },
        rowActions: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: MOBILE_SPACING.lg,
          paddingVertical: 12,
        },
        moreCount: { color: t.subText, fontSize: MOBILE_TYPE.body, fontWeight: '600' },
        linkBtn: {
          paddingVertical: 6,
          paddingHorizontal: 4,
        },
        linkTxt: { color: t.brand, fontSize: MOBILE_TYPE.bodyStrong, fontWeight: '700' },
        empty: { paddingVertical: 22, paddingHorizontal: MOBILE_SPACING.xxl, alignItems: 'center' },
        emptyText: { color: t.placeholder, textAlign: 'center', fontSize: MOBILE_TYPE.body, lineHeight: 20 },
        err: { color: t.danger, marginHorizontal: 20, marginBottom: 10, fontSize: MOBILE_TYPE.body },
        payRow: {
          marginHorizontal: 20,
          marginBottom: 8,
          padding: 12,
          borderRadius: MOBILE_RADII.md,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          backgroundColor: t.boxBg,
        },
        payLine: { color: t.text, fontSize: MOBILE_TYPE.body },
        paySub: { color: t.subText, fontSize: MOBILE_TYPE.caption, marginTop: 4 },
        cancelRow: {
          marginHorizontal: 20,
          marginBottom: 6,
          paddingVertical: 8,
          paddingHorizontal: MOBILE_SPACING.md,
          borderRadius: MOBILE_RADII.sm,
          backgroundColor: t.overlayBg,
          borderWidth: 1,
          borderColor: t.overlayBorder,
        },
        cancelLine: { color: t.subText, fontSize: MOBILE_TYPE.body },
        alertCard: {
          marginHorizontal: 8,
          marginBottom: 8,
          padding: 12,
          borderRadius: MOBILE_RADII.md,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          backgroundColor: t.boxBg,
        },
        alertTitle: { color: t.text, fontSize: MOBILE_TYPE.body, fontWeight: '800' },
        alertBody: { color: t.subText, fontSize: MOBILE_TYPE.body, marginTop: 4, lineHeight: 18 },
        alertMeta: { color: t.placeholder, fontSize: MOBILE_TYPE.caption, marginTop: 6 },
        alertCtaBtn: {
          alignSelf: 'flex-start',
          marginTop: 8,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          borderRadius: MOBILE_RADII.pill,
          paddingHorizontal: 10,
          paddingVertical: 4,
          backgroundColor: t.inputBg,
        },
        alertCtaTxt: { color: t.brand, fontSize: MOBILE_TYPE.caption, fontWeight: '700' },
        tplBtnRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 8,
          marginTop: 8,
        },
        tplInput: {
          marginTop: 8,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          borderRadius: MOBILE_RADII.sm,
          paddingHorizontal: 10,
          paddingVertical: 8,
          color: t.text,
          backgroundColor: t.inputBg,
        },
        historyLine: {
          color: t.placeholder,
          fontSize: MOBILE_TYPE.caption,
          marginTop: 4,
          lineHeight: 16,
        },
      }),
    [t, insets.top, width, isDesktopWeb],
  );

  const displayName = (uid) => profilesById[uid] || uid || '—';

  const suggestTargetSlot = useCallback(
    (planKey, currentSlot, currentMatchKey) => {
      const pk = normalizePlanKey(planKey);
      const curr = normalizeSlotLabel(currentSlot);
      const candidates = scheduleRows.rows
        .filter((r) => normalizePlanKey(r.planKey) === pk && r.matchKey !== currentMatchKey)
        .map((r) => ({
          slot: normalizeSlotLabel(r.slotLabel),
          free: Math.max(0, Number(r.capacity || DEFAULT_CUPO_DEMO) - Number(r.trials?.length || 0)),
        }))
        .filter((r) => !!r.slot && r.free > 0)
        .sort((a, b) => a.slot.localeCompare(b.slot, 'es'));
      const forward = candidates.find((c) => c.slot > curr);
      return (forward || candidates[0] || null)?.slot || null;
    },
    [scheduleRows.rows],
  );

  const handleStaffCancelClass = useCallback(
    async (bookingId) => {
      if (!bookingId) return;
      setStaffActionBusyId(bookingId);
      const out = await staffCancelClassBookingServer({ bookingId });
      setStaffActionBusyId('');
      if (!out.ok) {
        reportError('admin_resumen_staff_cancel_failed', new Error(String(out.reason || 'cancel_failed')), {
          bookingId,
        });
        Alert.alert(tStr('gym_config_alert_title_error'), tStr('admin_resumen_staff_cancel_fail'));
        return;
      }
      trackEvent('admin_resumen_staff_cancel_success', { bookingId });
      await onRefresh();
    },
    [onRefresh, tStr],
  );

  const handleStaffMoveClass = useCallback(
    async (booking, currentMatchKey) => {
      const bookingId = booking?.id;
      if (!bookingId) return;
      const newSlot = suggestTargetSlot(booking.plan_key, booking.slot_label, currentMatchKey);
      if (!newSlot) {
        Alert.alert(tStr('admin_resumen_staff_move_no_slot_title'), tStr('admin_resumen_staff_move_no_slot_body'));
        return;
      }
      setStaffActionBusyId(bookingId);
      const out = await staffMoveClassBookingServer({ bookingId, newSlotLabel: newSlot });
      setStaffActionBusyId('');
      if (!out.ok) {
        reportError('admin_resumen_staff_move_failed', new Error(String(out.reason || 'move_failed')), {
          bookingId,
          targetSlot: newSlot,
        });
        const reason = out.reason || '';
        if (reason === 'full') {
          Alert.alert(tStr('admin_resumen_staff_move_full_title'), tStr('admin_resumen_staff_move_full_body'));
        } else {
          Alert.alert(tStr('gym_config_alert_title_error'), tStr('admin_resumen_staff_move_fail'));
        }
        return;
      }
      trackEvent('admin_resumen_staff_move_success', { bookingId, targetSlot: newSlot });
      await onRefresh();
    },
    [onRefresh, suggestTargetSlot, tStr],
  );

  const renderTrialRows = (trials, slotKey, matchKey) => {
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
      const badgeLabelStyle =
        kind === 'abono' ? styles.badgeTextAbono : kind === 'debt' ? styles.badgeTextDebt : styles.badgeTextTrial;
      return (
        <View key={g.id} style={styles.personRow}>
          <Text style={styles.personName} numberOfLines={2}>
            {displayName(g.user_id)}
          </Text>
          <View style={styles.personRight}>
            <View style={[styles.badge, badgeStyle]}>
              <Text style={badgeLabelStyle}>{badgeLabel(kind)}</Text>
            </View>
            {g.source === 'class' ? (
              <View style={styles.staffActionsRow}>
                <TouchableOpacity
                  style={styles.staffActionBtn}
                  onPress={() => handleStaffMoveClass(g, matchKey)}
                  disabled={staffActionBusyId === g.id}
                  activeOpacity={0.85}
                >
                  <Text style={styles.staffActionTxt}>{tStr('admin_resumen_staff_move')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.staffActionBtn}
                  onPress={() => handleStaffCancelClass(g.id)}
                  disabled={staffActionBusyId === g.id}
                  activeOpacity={0.85}
                >
                  <Text style={styles.staffActionTxtMuted}>
                    {staffActionBusyId === g.id
                      ? tStr('calendario_booking_pending')
                      : tStr('admin_resumen_staff_cancel')}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}
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
            {!hideInlineBack ? (
              <BackNavButton onPress={() => navigation.goBack()} label={tStr('common_back')} style={styles.backBtn} />
            ) : null}
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
  const occupancyInsightRows = (() => {
    const bySlot = new Map();
    for (const row of agendaRows || []) {
      if (row?.syntheticHabitual) continue;
      const slot = String(row?.slotLabel || '').trim();
      if (!slot) continue;
      const occ = Array.isArray(row?.trials) ? row.trials.length : 0;
      const cap = Math.max(1, Number(row?.capacity || DEFAULT_CUPO_DEMO));
      const prev = bySlot.get(slot) || { occ: 0, cap: 0 };
      bySlot.set(slot, { occ: prev.occ + occ, cap: prev.cap + cap });
    }
    return [...bySlot.entries()]
      .map(([slot, x]) => ({ slot, occ: x.occ, cap: x.cap, rate: x.cap > 0 ? x.occ / x.cap : 0 }))
      .sort((a, b) => a.rate - b.rate)
      .slice(0, 3);
  })();

  const countPillStylesForN = (n, cap = DEFAULT_CUPO_DEMO) => {
    const n0 = n || 0;
    const c0 = Math.max(1, Number(cap || DEFAULT_CUPO_DEMO));
    if (n0 === 0) return [styles.countPill, styles.countPillZero];
    if (n0 >= c0) return [styles.countPill, styles.countPillFull];
    return [styles.countPill, styles.countPillHas];
  };

  const countPillTextStyleForN = (n, cap = DEFAULT_CUPO_DEMO) => {
    const n0 = n || 0;
    const c0 = Math.max(1, Number(cap || DEFAULT_CUPO_DEMO));
    if (n0 === 0) return [styles.countPillText, styles.countPillTextZero];
    if (n0 >= c0) return [styles.countPillText, styles.countPillTextFull];
    return [styles.countPillText, styles.countPillTextOk];
  };

  const buildQuickTemplateText = useCallback(
    (kind) => {
      const gymName = String(organization?.name || 'el gym').trim();
      const lowSlot = occupancyInsightRows[0]?.slot || '';
      const recipient = String(templateRecipient || '').trim() || tStr('admin_resumen_tpl_recipient_default');
      let text = '';
      if (kind === 'payment') {
        text = tStr('admin_resumen_tpl_payment_text')
          .replace('{{name}}', recipient)
          .replace('{{gym}}', gymName)
          .replace('{{due_count}}', String(abonosDue7dCount));
      } else if (kind === 'schedule') {
        text = tStr('admin_resumen_tpl_schedule_text')
          .replace('{{name}}', recipient)
          .replace('{{gym}}', gymName)
          .replace('{{slot}}', lowSlot || tStr('admin_resumen_tpl_slot_generic'));
      } else if (kind === 'winback') {
        text = tStr('admin_resumen_tpl_winback_text')
          .replace('{{name}}', recipient)
          .replace('{{gym}}', gymName)
          .replace('{{new_count}}', String(newMembersMonthCount));
      }
      return String(text || '').trim();
    },
    [organization?.name, occupancyInsightRows, abonosDue7dCount, newMembersMonthCount, templateRecipient, tStr],
  );

  const copyQuickTemplate = useCallback(
    async (kind) => {
      const text = buildQuickTemplateText(kind);
      if (!text) return;
      await Clipboard.setStringAsync(text);
      Alert.alert(tStr('gym_config_copied_title'), tStr('admin_resumen_tpl_copied'));
      const entry = {
        id: `${Date.now()}-${kind}`,
        label: `${tStr('admin_resumen_history_template_prefix')} ${tStr(`admin_resumen_tpl_${kind === 'winback' ? 'winback' : kind}`)}`,
        ts: new Date().toISOString(),
      };
      setAssistantHistory((prev) => {
        const next = [entry, ...(Array.isArray(prev) ? prev : [])].slice(0, 8);
        if (historyKey) AsyncStorage.setItem(historyKey, JSON.stringify(next)).catch(() => {});
        return next;
      });
    },
    [buildQuickTemplateText, tStr, historyKey],
  );

  const copyAndOpenWhatsAppWebTemplate = useCallback(
    async (kind) => {
      const text = buildQuickTemplateText(kind);
      if (!text) return;
      await Clipboard.setStringAsync(text);
      const waUrl = `https://web.whatsapp.com/?text=${encodeURIComponent(text)}`;
      const can = await Linking.canOpenURL(waUrl);
      if (can) {
        await Linking.openURL(waUrl);
      }
      Alert.alert(tStr('gym_config_copied_title'), tStr('admin_resumen_tpl_copied_open_wa'));
      const entry = {
        id: `${Date.now()}-${kind}-wa`,
        label: `${tStr('admin_resumen_history_wa_prefix')} ${tStr(`admin_resumen_tpl_${kind === 'winback' ? 'winback' : kind}`)}`,
        ts: new Date().toISOString(),
      };
      setAssistantHistory((prev) => {
        const next = [entry, ...(Array.isArray(prev) ? prev : [])].slice(0, 8);
        if (historyKey) AsyncStorage.setItem(historyKey, JSON.stringify(next)).catch(() => {});
        return next;
      });
    },
    [buildQuickTemplateText, tStr, historyKey],
  );

  return (
    <BackgroundWrapper screen="admin">
      <View style={styles.root}>
        <View style={styles.contentMax}>
        <View style={styles.topBar}>
          {!hideInlineBack ? (
            <BackNavButton onPress={() => navigation.goBack()} label={tStr('common_back')} style={styles.backBtn} />
          ) : null}
          <View style={{ flex: 1 }} />
          <TouchableOpacity
            onPress={onRefresh}
            style={styles.iconBtn}
            accessibilityLabel={tStr('common_refresh')}
          >
            <Ionicons name="refresh" size={22} color={t.brand} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={runAiInsights}
            style={styles.iconBtn}
            accessibilityLabel={tStr('admin_resumen_ai_run_now')}
            disabled={aiAnalyzing}
          >
            {aiAnalyzing ? (
              <ActivityIndicator size="small" color={t.brand} />
            ) : (
              <Ionicons name="sparkles-outline" size={22} color={t.brand} />
            )}
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
          <Text style={styles.heroHint}>{tStr('admin_resumen_hero_hint')}</Text>
        </View>

        {loading ? (
          <View style={styles.empty}>
            <ActivityIndicator size="large" color={t.brand} />
          </View>
        ) : (
          <ScrollView
            style={{ flex: 1, minHeight: 0 }}
            contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 20) + 24 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.brand} />}
            showsVerticalScrollIndicator={false}
          >
            {error ? <Text style={styles.err}>{error}</Text> : null}
            <View style={styles.mainLayout}>
              <View style={styles.mainColPrimary}>
                <View style={styles.mainSheet}>
                  {agendaRows.length === 0 ? (
                    <View style={styles.slotCard}>
                      <View style={styles.slotHead}>
                        <Text style={styles.slotTitleMain}>{tStr('admin_resumen_title')}</Text>
                      </View>
                      <View style={styles.slotListDivider} />
                      <View style={styles.slotListInner}>
                        <View style={styles.mutedRow}>
                          <Text style={styles.mutedText}>{tStr('admin_resumen_empty_schedule_in_card')}</Text>
                        </View>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.agendaGrid}>
                      {agendaRows.map((row) => {
                      const nTri = row.trials.length;
                      const cap = Number(row.capacity || DEFAULT_CUPO_DEMO);
                      const slotOpen = isSlotListOpen(row.matchKey);
                      return (
                        <View key={row.matchKey} style={styles.slotCard}>
                          <TouchableOpacity
                            activeOpacity={0.9}
                            onPress={() => toggleSlotList(row.matchKey)}
                          >
                            <View style={styles.slotHead}>
                              <View style={styles.slotTopLine}>
                                <Text style={styles.slotTitleMain} numberOfLines={2}>
                                  {tStr('admin_resumen_slot_header')
                                    .replace('{{slot}}', String(row.slotLabel || '—'))
                                    .replace('{{plan}}', row.planTitle)}
                                </Text>
                                <View style={countPillStylesForN(nTri, cap)}>
                                  <Text style={countPillTextStyleForN(nTri, cap)} numberOfLines={1}>
                                    {formatOccupancyPill(nTri, cap)}
                                  </Text>
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
                          {slotOpen ? (
                            <>
                              <View style={styles.slotListDivider} />
                              <View style={styles.slotListInner}>
                                {renderTrialRows(row.trials, row.matchKey, row.matchKey)}
                              </View>
                            </>
                          ) : null}
                        </View>
                      );
                    })}
                    </View>
                  )}
                </View>

                {orphans.length ? (
                  <>
                    <Text style={styles.sectionTitle}>{tStr('admin_resumen_section_orphan')}</Text>
                    <Text style={styles.sectionHint}>{tStr('admin_resumen_orphan_hint')}</Text>
                    <View style={styles.mainSheet}>
                      <View style={styles.agendaGrid}>
                        {orphans.map((row) => {
                        const oKey = `orphan-${row.matchKey}`;
                        const oN = row.trials.length;
                        const cap = Number(row.capacity || DEFAULT_CUPO_DEMO);
                        const slotOpen = isSlotListOpen(oKey);
                        return (
                          <View key={oKey} style={styles.slotCard}>
                            <TouchableOpacity
                              activeOpacity={0.9}
                              onPress={() => toggleSlotList(oKey)}
                            >
                              <View style={styles.slotHead}>
                                <View style={styles.slotTopLine}>
                                  <Text style={styles.slotTitleMain} numberOfLines={2}>
                                    {tStr('admin_resumen_slot_header')
                                      .replace('{{slot}}', String(row.slotLabel || '—'))
                                      .replace('{{plan}}', row.planTitle)}
                                  </Text>
                                  <View style={countPillStylesForN(oN, cap)}>
                                    <Text style={countPillTextStyleForN(oN, cap)} numberOfLines={1}>
                                      {formatOccupancyPill(oN, cap)}
                                    </Text>
                                  </View>
                                  <Ionicons
                                    name={slotOpen ? 'chevron-up' : 'chevron-down'}
                                    size={22}
                                    color={t.subText}
                                  />
                                </View>
                              </View>
                            </TouchableOpacity>
                            {slotOpen ? (
                              <>
                                <View style={styles.slotListDivider} />
                                <View style={styles.slotListInner}>
                                  {renderTrialRows(row.trials, oKey, row.matchKey)}
                                </View>
                              </>
                            ) : null}
                          </View>
                        );
                      })}
                      </View>
                    </View>
                  </>
                ) : null}
              </View>

              <View style={styles.mainColSecondary}>
                {(grantsOther.length || classOther.length) ? (
                  <View style={styles.sectionCard}>
                    <Text style={[styles.sectionTitle, { marginHorizontal: 12, marginTop: 4 }]}>
                      {tStr('admin_resumen_section_other')}
                    </Text>
                    {[...grantsOther, ...classOther].map((g) => (
                      <View key={g.id} style={[styles.cancelRow, { marginHorizontal: 8 }]}>
                        <Text style={styles.cancelLine}>
                          {displayName(g.user_id)}
                          {' · '}
                          {planDisplay(g.plan_key)}
                          {' · '}
                          {String(g.slot_label || '')}
                          {' · '}
                          {String(g.status || '')}
                          {g.source === 'class' ? ' · abono' : ''}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                <View style={styles.sectionCard}>
                  <Text style={[styles.sectionTitle, { marginHorizontal: 12, marginTop: 4 }]}>
                    {tStr('admin_resumen_section_data_assistant')}
                  </Text>
                  <View style={[styles.alertCard, { marginBottom: 8 }]}>
                    <Text style={styles.alertTitle}>{tStr('admin_resumen_data_new_members_title')}</Text>
                    <Text style={styles.alertBody}>
                      {tStr('admin_resumen_data_new_members_body').replace('{{count}}', String(newMembersMonthCount))}
                    </Text>
                  </View>
                  <View style={[styles.alertCard, { marginBottom: 8 }]}>
                    <Text style={styles.alertTitle}>{tStr('admin_resumen_data_due_abonos_title')}</Text>
                    <Text style={styles.alertBody}>
                      {tStr('admin_resumen_data_due_abonos_body').replace('{{count}}', String(abonosDue7dCount))}
                    </Text>
                  </View>
                  <View style={styles.alertCard}>
                    <Text style={styles.alertTitle}>{tStr('admin_resumen_data_occupancy_title')}</Text>
                    {occupancyInsightRows.length === 0 ? (
                      <Text style={styles.alertBody}>{tStr('admin_resumen_data_occupancy_empty')}</Text>
                    ) : (
                      occupancyInsightRows.map((r) => (
                        <Text key={r.slot} style={styles.alertBody}>
                          {'• '}
                          {tStr('admin_resumen_data_occupancy_line')
                            .replace('{{slot}}', String(r.slot))
                            .replace('{{a}}', String(r.occ))
                            .replace('{{b}}', String(r.cap))}
                        </Text>
                      ))
                    )}
                  </View>
                  <View style={[styles.alertCard, { marginTop: 2 }]}>
                    <Text style={styles.alertTitle}>{tStr('admin_resumen_tpl_title')}</Text>
                    <Text style={styles.alertBody}>{tStr('admin_resumen_tpl_hint')}</Text>
                    <TextInput
                      style={styles.tplInput}
                      value={templateRecipient}
                      onChangeText={setTemplateRecipient}
                      placeholder={tStr('admin_resumen_tpl_recipient_ph')}
                      placeholderTextColor={t.placeholder}
                    />
                    <View style={styles.tplBtnRow}>
                      <TouchableOpacity style={styles.alertCtaBtn} onPress={() => copyQuickTemplate('payment')} activeOpacity={0.85}>
                        <Text style={styles.alertCtaTxt}>{tStr('admin_resumen_tpl_payment')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.alertCtaBtn} onPress={() => copyQuickTemplate('schedule')} activeOpacity={0.85}>
                        <Text style={styles.alertCtaTxt}>{tStr('admin_resumen_tpl_schedule')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.alertCtaBtn} onPress={() => copyQuickTemplate('winback')} activeOpacity={0.85}>
                        <Text style={styles.alertCtaTxt}>{tStr('admin_resumen_tpl_winback')}</Text>
                      </TouchableOpacity>
                    </View>
                    {Platform.OS === 'web' ? (
                      <View style={styles.tplBtnRow}>
                        <TouchableOpacity style={styles.alertCtaBtn} onPress={() => copyAndOpenWhatsAppWebTemplate('payment')} activeOpacity={0.85}>
                          <Text style={styles.alertCtaTxt}>{tStr('admin_resumen_tpl_payment_wa')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.alertCtaBtn} onPress={() => copyAndOpenWhatsAppWebTemplate('schedule')} activeOpacity={0.85}>
                          <Text style={styles.alertCtaTxt}>{tStr('admin_resumen_tpl_schedule_wa')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.alertCtaBtn} onPress={() => copyAndOpenWhatsAppWebTemplate('winback')} activeOpacity={0.85}>
                          <Text style={styles.alertCtaTxt}>{tStr('admin_resumen_tpl_winback_wa')}</Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}
                    <Text style={[styles.alertBody, { marginTop: 10 }]}>{tStr('admin_resumen_history_title')}</Text>
                    {assistantHistory.length === 0 ? (
                      <Text style={styles.historyLine}>{tStr('admin_resumen_history_empty')}</Text>
                    ) : (
                      assistantHistory.map((h) => (
                        <Text key={h.id} style={styles.historyLine}>
                          {`• ${h.label} · ${String(h.ts || '').slice(0, 16).replace('T', ' ')}`}
                        </Text>
                      ))
                    )}
                  </View>
                </View>

                <View style={styles.sectionCard}>
                  <Text style={[styles.sectionTitle, { marginHorizontal: 12, marginTop: 4 }]}>
                    {tStr('admin_resumen_section_ai_alerts')}
                  </Text>
                  {aiAlerts.length === 0 ? (
                    <View style={[styles.empty, { paddingVertical: 14 }]}>
                      <Text style={styles.emptyText}>{tStr('admin_resumen_empty_ai_alerts')}</Text>
                    </View>
                  ) : (
                    aiAlerts.map((a) => {
                      const sev = String(a.severity || '').toLowerCase();
                      const color = sev === 'critical' ? '#dc2626' : sev === 'warning' ? '#b45309' : '#2563eb';
                      const obs = String(a.observed_at || '').slice(0, 16).replace('T', ' ');
                      return (
                        <View key={a.id || `${a.alert_type}-${obs}`} style={styles.alertCard}>
                          <Text style={[styles.alertTitle, { color }]}>{a.title || tStr('admin_resumen_ai_alert_generic')}</Text>
                          <Text style={styles.alertBody}>{a.body || ''}</Text>
                          <Text style={styles.alertMeta}>{obs}</Text>
                          {a.cta_route ? (
                            <TouchableOpacity
                              style={styles.alertCtaBtn}
                              onPress={() => navigation.navigate(String(a.cta_route), { from: 'ai_alert' })}
                              activeOpacity={0.85}
                            >
                              <Text style={styles.alertCtaTxt}>
                                {a.cta_label || tStr('admin_resumen_ai_alert_view')}
                              </Text>
                            </TouchableOpacity>
                          ) : null}
                        </View>
                      );
                    })
                  )}
                </View>

                <View style={styles.sectionCard}>
                  <Text style={[styles.sectionTitle, { marginHorizontal: 12, marginTop: 4 }]}>
                    {tStr('admin_resumen_section_billing')}
                  </Text>
                  {pendingPayments.length === 0 ? (
                    <View style={[styles.empty, { paddingVertical: 14 }]}>
                      <Text style={styles.emptyText}>{tStr('admin_resumen_empty_billing')}</Text>
                    </View>
                  ) : (
                    pendingPayments.slice(0, 40).map((p) => {
                      const uid = p.member_user_id;
                      const label = uid ? displayName(uid) : String(p.client_id || '—');
                      const amount = p.monto != null ? Number(p.monto) : 0;
                      const mon = p.moneda || 'ARS';
                      return (
                        <View key={p.id || `${p.client_id}-${p.status}`} style={[styles.payRow, { marginHorizontal: 8 }]}>
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
                </View>
              </View>
            </View>
          </ScrollView>
        )}
        </View>
      </View>
    </BackgroundWrapper>
  );
}
