// screens/CalendarioScreen.js — Waitomo Dark Only (brillo unificado en paneles / inputs)
// Funcionalidad preservada: días, horarios, recordatorio apto médico, navegación a TrabajoDelDia

import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Alert,
  Platform,
  useWindowDimensions,
} from 'react-native';
import PropTypes from 'prop-types';
import { useFocusEffect } from '@react-navigation/native';
import { usePlanContext } from '../../contexts/PlanContext';
import { useAuth } from '../../contexts/AuthContext';
import { useTrainingData } from '../../contexts/TrainingDataContext';
import BackgroundWrapper from '../../components/BackgroundWrapper';
import BackNavButton from '../../components/BackNavButton';
import NeoPanel from '../../components/NeoPanel';
import { colors } from '../../theme/colors';
import { useThemeContext } from '../../contexts/ThemeContext';
import { useLocale } from '../../contexts/LocaleContext';
import { supabase } from '../../supabaseClient';
import { formatYmdLocal } from '../../utils/formatYmdLocal';
import { normalizePlanKey } from '../../utils/planKeyNormalize';
import { fetchLatestUserAbono } from '../../utils/userAbonoFetch';
import { normalizeSlotLabel } from '../../utils/freeClassGrantStorage';
import { MOBILE_RADII, MOBILE_SIZES, MOBILE_SPACING, MOBILE_TYPE } from '../../theme/mobileSpec';
import { WEB_CONTENT_MAX_WIDTH, WEB_DESKTOP_BREAKPOINT } from '../../theme/webSpec';
import { resolveFreeClassGrant } from '../../services/booking/trialClassGrant';
import {
  bookClassSlotServer,
  cancelClassSlotServer,
  joinClassWaitlistServer,
  leaveClassWaitlistServer,
} from '../../services/booking/classBooking';
import { evaluateCalendarioAccess, evaluateWorkoutEntitlement } from '../../utils/clientWorkoutEntitlement';
import { adminPlanValueFromCanon } from '../../utils/trainingBlockPlan';
import { WEB_SCROLL_NO_STRETCH } from '../../utils/webViewportCanvas';
import { reportError, trackEvent } from '../../utils/observability';

// ---------- helpers ----------
const { height } = Dimensions.get('window');

const hexToRgba = (hex, alpha = 1) => {
  const clean = String(hex).replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
};

const getNextDays = (start = 0, count = 30, locale = 'es') => {
  const dateLocale = locale === 'en' ? 'en-US' : 'es-AR';
  const days = [];
  const today = new Date();
  for (let i = start; i < start + count; i += 1) {
    const day = new Date(today);
    day.setDate(day.getDate() + i);
    days.push({
      label: day.toLocaleDateString(dateLocale, { weekday: 'short' }),
      number: day.getDate(),
      full: formatYmdLocal(day),
    });
  }
  return days;
};

const getIsoWeekdayFromYmd = (ymd) => {
  const [y, m, d] = String(ymd || '').split('-').map(Number);
  if ([y, m, d].some(Number.isNaN)) return 1;
  return new Date(y, m - 1, d).getDay() || 7;
};

const isYmd = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));

const generarHorarios = (planName) => {
  const desde = 7;
  const hasta = 21;
  const salto = planName === 'Open Box' ? 2 : 1;
  const horarios = [];
  for (let h = desde; h <= hasta; h += salto) {
    horarios.push(`${h.toString().padStart(2, '0')}:00`);
  }
  return horarios;
};

// Plan para fondo y horarios: params (si viniste por navegación) > PlanContext > perfil del usuario
const PLAN_LABELS = {
  cross: 'Cross Training',
  hyrox: 'Hyrox',
  evolucion: 'Evolución',
  stretching: 'Stretching',
  yoga: 'Yoga',
  openbox: 'Open Box',
  oly: 'Oly',
  all_access: 'Pase libre',
};

function planFromProfile(planActual) {
  const raw = String(planActual || '').toLowerCase().trim();
  if (!raw) return null;
  const id = raw.includes('cross') ? 'cross' : raw.includes('open') ? 'openbox' : raw.includes('evol') ? 'evolucion' : raw.includes('stretch') ? 'stretching' : raw.includes('yoga') ? 'yoga' : raw.includes('oly') ? 'oly' : raw.includes('hyrox') ? 'hyrox' : raw;
  const nombre = PLAN_LABELS[id] || raw;
  return { id, nombre, name: nombre, title: nombre };
}

// ---------- screen ----------
export default function CalendarioScreen({ route, navigation }) {
  const { width } = useWindowDimensions();
  const isWebDesktop = Platform.OS === 'web' && width >= WEB_DESKTOP_BREAKPOINT;
  const panelMaxWidth = WEB_CONTENT_MAX_WIDTH;
  const { plan: contextPlan } = usePlanContext();
  const { profile, user, organization } = useAuth();
  const orgId = organization?.id || profile?.organization_id || null;
  const { refreshTrainingBlocksFromServer } = useTrainingData() || {};
  const params = route?.params || {};
  const planParam = params?.plan || null;
  const plan = planParam || contextPlan || planFromProfile(profile?.plan_actual);
  const { t } = useThemeContext();
  const { t: tStr, locale } = useLocale();

  const [diaSeleccionado, setDiaSeleccionado] = useState(
    isYmd(params?.prefillDate) ? params.prefillDate : getNextDays(0, 1, locale)[0].full,
  );
  const [abonoRow, setAbonoRow] = useState(null);
  const [abonoLoading, setAbonoLoading] = useState(true);
  const [freeClassGrant, setFreeClassGrant] = useState(null);
  const [planCfg, setPlanCfg] = useState({
    attendancePolicy: 'dropin',
    defaultCapacity: null,
    nearFullThreshold: 2,
    cancelNoticeHours: 2,
    mode: 'class',
  });
  const [dayBlocks, setDayBlocks] = useState([]);
  const [slotOccupancy, setSlotOccupancy] = useState({});
  const [myScheduledBySlot, setMyScheduledBySlot] = useState({});
  const [myWaitingBySlot, setMyWaitingBySlot] = useState({});
  const [waitCountBySlot, setWaitCountBySlot] = useState({});
  const [weeklySlots, setWeeklySlots] = useState([]);
  const [slotBusy, setSlotBusy] = useState('');
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [blocksByDate, setBlocksByDate] = useState({});
  const weekScrollRef = useRef(null);
  const dayLayoutsRef = useRef({});
  const prefillSlot = useMemo(() => normalizeSlotLabel(params?.prefillSlot), [params?.prefillSlot]);
  const dateLocale = locale === 'en' ? 'en-US' : 'es-AR';
  // Permite revisar historial reciente y próximos días.
  const days = useMemo(() => getNextDays(-14, 45, locale), [locale]);
  const todayYmd = useMemo(() => formatYmdLocal(new Date()), []);
  const selectedDateLabel = useMemo(() => {
    try {
      const [y, m, d] = String(diaSeleccionado || '').split('-').map(Number);
      if ([y, m, d].some(Number.isNaN)) return '';
      const dt = new Date(y, m - 1, d);
      return dt.toLocaleDateString(dateLocale, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      });
    } catch {
      return '';
    }
  }, [diaSeleccionado, dateLocale]);
  const horarios = useMemo(() => generarHorarios(plan?.nombre || 'Cross Training'), [plan?.nombre]);

  const planCanon = useMemo(
    () => normalizePlanKey(params.planKey) || normalizePlanKey(plan?.id) || null,
    [params.planKey, plan?.id],
  );

  const planValueForNav = useMemo(() => adminPlanValueFromCanon(planCanon), [planCanon]);

  useEffect(() => {
    let alive = true;
    if (!orgId || !planCanon || !days.length) {
      setBlocksByDate({});
      return () => {
        alive = false;
      };
    }
    const start = days[0]?.full;
    const end = days[days.length - 1]?.full;
    if (!start || !end) return () => {
      alive = false;
    };
    (async () => {
      try {
        const { data, error } = await supabase
          .from('training_daily_blocks')
          .select('fecha, slot_label, plan_key, titulo')
          .eq('organization_id', orgId)
          .gte('fecha', start)
          .lte('fecha', end);
        if (!alive || error) return;
        const map = {};
        (data || []).forEach((row) => {
          if (normalizePlanKey(row.plan_key) !== planCanon) return;
          const fk = String(row.fecha || '').slice(0, 10);
          if (!fk) return;
          const slot = normalizeSlotLabel(row.slot_label);
          if (!map[fk]) map[fk] = { slots: new Set(), titles: {} };
          if (slot) map[fk].slots.add(slot);
          if (slot && row.titulo) map[fk].titles[slot] = row.titulo;
        });
        const plain = {};
        Object.keys(map).forEach((fk) => {
          plain[fk] = {
            slots: Array.from(map[fk].slots).sort((a, b) => a.localeCompare(b, 'es')),
            titles: map[fk].titles,
          };
        });
        if (alive) setBlocksByDate(plain);
      } catch {
        if (alive) setBlocksByDate({});
      }
    })();
    return () => {
      alive = false;
    };
  }, [orgId, planCanon, days]);

  useEffect(() => {
    const layout = dayLayoutsRef.current[diaSeleccionado];
    if (!layout || !weekScrollRef.current?.scrollTo) return;
    const timer = setTimeout(() => {
      try {
        weekScrollRef.current.scrollTo({
          x: Math.max(0, layout.x - 24),
          animated: true,
        });
      } catch {
        /* noop */
      }
    }, 80);
    return () => clearTimeout(timer);
  }, [diaSeleccionado, days.length]);

  useEffect(() => {
    if (isYmd(params?.prefillDate)) {
      setDiaSeleccionado(params.prefillDate);
    }
  }, [params?.prefillDate]);

  useEffect(() => {
    if (!user?.id) {
      setAbonoLoading(false);
      setAbonoRow(null);
      return undefined;
    }
    let alive = true;
    (async () => {
      setAbonoLoading(true);
      try {
        const row = await fetchLatestUserAbono(user.id);
        if (alive) setAbonoRow(row);
      } catch {
        if (alive) setAbonoRow(null);
      } finally {
        if (alive) setAbonoLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const g = await resolveFreeClassGrant(user?.id);
        if (alive) setFreeClassGrant(g);
      })();
      return () => {
        alive = false;
      };
    }, [user?.id]),
  );

  useFocusEffect(
    useCallback(() => {
      if (typeof refreshTrainingBlocksFromServer === 'function' && orgId) {
        refreshTrainingBlocksFromServer();
      }
    }, [refreshTrainingBlocksFromServer, orgId]),
  );

  useEffect(() => {
    let alive = true;
    if (!orgId || !planCanon) {
      setPlanCfg({
        attendancePolicy: 'dropin',
        defaultCapacity: null,
        nearFullThreshold: 2,
        cancelNoticeHours: 2,
        mode: 'class',
      });
      setWeeklySlots([]);
      return () => {
        alive = false;
      };
    }
    (async () => {
      try {
        const { data: plansData } = await supabase
          .from('plans')
          .select('mode, attendance_policy, default_capacity, near_full_threshold, cancel_notice_hours, code')
          .eq('organization_id', orgId)
          .eq('active', true);
        const rows = Array.isArray(plansData) ? plansData : [];
        const chosen =
          rows.find((r) => String(r.code || '').trim() === planCanon)
          || rows.find((r) => normalizePlanKey(r.code) === planCanon)
          || null;
        if (!alive) return;
        setPlanCfg({
          mode: chosen?.mode || 'class',
          attendancePolicy:
            chosen?.attendance_policy || (chosen?.mode === 'program' ? 'not_applicable' : 'dropin'),
          defaultCapacity: chosen?.default_capacity ?? null,
          nearFullThreshold:
            chosen?.near_full_threshold != null && Number(chosen.near_full_threshold) > 0
              ? Number(chosen.near_full_threshold)
              : 2,
          cancelNoticeHours:
            chosen?.cancel_notice_hours != null && Number(chosen.cancel_notice_hours) >= 0
              ? Number(chosen.cancel_notice_hours)
              : 2,
        });

        const { data: wsData, error: wsErr } = await supabase
          .from('plan_week_slots')
          .select('weekday, slot_label, plan_code')
          .eq('organization_id', orgId);
        if (!alive) return;
        if (!wsErr && Array.isArray(wsData)) {
          const rows = wsData.filter((r) => normalizePlanKey(r.plan_code) === planCanon);
          setWeeklySlots(rows);
        } else {
          setWeeklySlots([]);
        }
      } catch {
        if (!alive) return;
        setPlanCfg({
          attendancePolicy: 'dropin',
          defaultCapacity: null,
          nearFullThreshold: 2,
          cancelNoticeHours: 2,
          mode: 'class',
        });
        setWeeklySlots([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [orgId, planCanon]);

  useEffect(() => {
    let alive = true;
    if (!orgId || !planCanon || !diaSeleccionado) {
      setDayBlocks([]);
      setSlotOccupancy({});
      setMyScheduledBySlot({});
      setMyWaitingBySlot({});
      setWaitCountBySlot({});
      return () => {
        alive = false;
      };
    }
    (async () => {
      const startedAt = Date.now();
      setSlotsLoading(true);
      try {
        const { data: blocksData, error: blocksErr } = await supabase
          .from('training_daily_blocks')
          .select('id, plan_key, slot_label, capacity, titulo')
          .eq('organization_id', orgId)
          .eq('fecha', diaSeleccionado)
          .order('slot_label', { ascending: true });
        if (blocksErr) throw blocksErr;

        const filtered = (blocksData || []).filter(
          (b) => normalizePlanKey(b.plan_key) === planCanon,
        );
        if (!alive) return;
        setDayBlocks(filtered);

        if (planCfg.attendancePolicy !== 'booking_required') {
          setSlotOccupancy({});
          setMyScheduledBySlot({});
          setMyWaitingBySlot({});
          setWaitCountBySlot({});
          return;
        }

        const { data: bookingsData, error: bookingsErr } = await supabase
          .from('class_bookings')
          .select('slot_label, status, plan_key, user_id')
          .eq('organization_id', orgId)
          .eq('session_date', diaSeleccionado)
          .eq('status', 'scheduled');
        if (bookingsErr) {
          setSlotOccupancy({});
          setMyScheduledBySlot({});
          setMyWaitingBySlot({});
          setWaitCountBySlot({});
          return;
        }
        const occ = {};
        const mine = {};
        (bookingsData || []).forEach((r) => {
          if (normalizePlanKey(r.plan_key) !== planCanon) return;
          const s = normalizeSlotLabel(r.slot_label);
          if (!s) return;
          occ[s] = (occ[s] || 0) + 1;
          if (r.user_id && user?.id && r.user_id === user.id) mine[s] = r;
        });
        if (alive) {
          setSlotOccupancy(occ);
          setMyScheduledBySlot(mine);
        }

        const { data: waitData, error: waitErr } = await supabase
          .from('class_booking_waitlist')
          .select('slot_label, plan_key, status, user_id')
          .eq('organization_id', orgId)
          .eq('session_date', diaSeleccionado)
          .eq('status', 'waiting');
        if (waitErr) {
          if (alive) {
            setMyWaitingBySlot({});
            setWaitCountBySlot({});
          }
          return;
        }
        const waitingMine = {};
        const waitingCounts = {};
        (waitData || []).forEach((r) => {
          if (normalizePlanKey(r.plan_key) !== planCanon) return;
          if (r.user_id !== user?.id) return;
          const s = normalizeSlotLabel(r.slot_label);
          if (!s) return;
          waitingMine[s] = r;
        });
        (waitData || []).forEach((r) => {
          if (normalizePlanKey(r.plan_key) !== planCanon) return;
          const s = normalizeSlotLabel(r.slot_label);
          if (!s) return;
          waitingCounts[s] = (waitingCounts[s] || 0) + 1;
        });
        if (alive) {
          setMyWaitingBySlot(waitingMine);
          setWaitCountBySlot(waitingCounts);
        }
        trackEvent('calendario_slots_load_success', {
          durationMs: Date.now() - startedAt,
          organizationId: orgId || null,
          planKey: planCanon || null,
          date: diaSeleccionado,
          publishedBlocks: filtered.length,
          bookings: Object.keys(occ).length,
          waitlistSlots: Object.keys(waitingCounts).length,
        });
      } catch (e) {
        reportError('calendario_slots_load_failed', e, {
          durationMs: Date.now() - startedAt,
          organizationId: orgId || null,
          planKey: planCanon || null,
          date: diaSeleccionado,
        });
        if (alive) {
          setDayBlocks([]);
          setSlotOccupancy({});
          setMyScheduledBySlot({});
          setMyWaitingBySlot({});
          setWaitCountBySlot({});
        }
      } finally {
        if (alive) setSlotsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [orgId, planCanon, diaSeleccionado, planCfg.attendancePolicy, user?.id]);

  const calendarAccess = useMemo(
    () =>
      evaluateCalendarioAccess({
        planCanonKey: planCanon,
        organizationId: orgId,
        abonoRow,
        abonoLoading,
        freeClassGrant,
      }),
    [planCanon, orgId, abonoRow, abonoLoading, freeClassGrant],
  );

  const isBookingRequired =
    planCfg.attendancePolicy === 'booking_required' || planCfg.attendancePolicy === 'dropin_capped';
  const weeklySlotsByWeekday = useMemo(() => {
    const out = {};
    (weeklySlots || []).forEach((r) => {
      const wd = Number(r.weekday);
      const slot = normalizeSlotLabel(r.slot_label);
      if (!slot || wd < 1 || wd > 7) return;
      if (!out[wd]) out[wd] = [];
      if (!out[wd].includes(slot)) out[wd].push(slot);
    });
    Object.keys(out).forEach((k) => out[k].sort((a, b) => a.localeCompare(b, 'es')));
    return out;
  }, [weeklySlots]);
  const offeredWeekdays = useMemo(
    () => new Set(Object.keys(weeklySlotsByWeekday).map((k) => Number(k))),
    [weeklySlotsByWeekday],
  );
  const selectedWeekday = useMemo(() => getIsoWeekdayFromYmd(diaSeleccionado), [diaSeleccionado]);
  const weeklySlotsForDay = useMemo(
    () => weeklySlotsByWeekday[selectedWeekday] || [],
    [weeklySlotsByWeekday, selectedWeekday],
  );
  const publishedSlots = useMemo(() => {
    const uniq = new Set();
    (dayBlocks || []).forEach((b) => {
      const s = normalizeSlotLabel(b.slot_label);
      if (s) uniq.add(s);
    });
    return Array.from(uniq).sort((a, b) => a.localeCompare(b, 'es'));
  }, [dayBlocks]);

  const blockBySlot = useMemo(() => {
    const out = {};
    (dayBlocks || []).forEach((b) => {
      const s = normalizeSlotLabel(b.slot_label);
      if (!s || out[s]) return;
      out[s] = b;
    });
    return out;
  }, [dayBlocks]);

  const visibleSlots = useMemo(() => {
    if (publishedSlots.length) return publishedSlots;
    const fromRange = blocksByDate[diaSeleccionado]?.slots || [];
    if (fromRange.length) return fromRange;
    if (weeklySlotsForDay.length) return weeklySlotsForDay;
    return isBookingRequired ? [] : horarios;
  }, [
    publishedSlots,
    blocksByDate,
    diaSeleccionado,
    weeklySlotsForDay,
    isBookingRequired,
    horarios,
  ]);

  const goTrabajoDia = (hora) => {
    navigation.navigate('TrabajoDelDia', {
      fecha: diaSeleccionado,
      hora,
      horario: hora,
      plan: planValueForNav ? { ...plan, planValue: planValueForNav } : plan,
      planKey: params.planKey || plan?.id,
      planValue: planValueForNav || undefined,
    });
  };

  const handleMedicalBlocked = useCallback(() => {
    Alert.alert(
      tStr('calendario_medical_block_title'),
      tStr('calendario_medical_block_body'),
      [
        { text: tStr('common_cancel'), style: 'cancel' },
        {
          text: tStr('client_my_profile'),
          onPress: () => {
            try {
              navigation.navigate('PerfilUsuario');
            } catch {
              navigation.navigate('Perfil');
            }
          },
        },
      ],
    );
  }, [navigation, tStr]);

  const askMedicalResponsibility = useCallback(
    () =>
      new Promise((resolve) => {
        Alert.alert(
          tStr('calendario_medical_responsibility_title'),
          tStr('calendario_medical_responsibility_body'),
          [
            { text: tStr('common_cancel'), style: 'cancel', onPress: () => resolve(false) },
            { text: tStr('calendario_medical_responsibility_cta'), onPress: () => resolve(true) },
          ],
        );
      }),
    [tStr],
  );

  const handleReserva = async (hora) => {
    if (!user?.id) {
      Alert.alert(tStr('client_trabajo_locked_title'), tStr('client_trabajo_locked_body'));
      return;
    }
    const row = abonoRow ?? (await fetchLatestUserAbono(user.id));
    const g = await resolveFreeClassGrant(user?.id);
    const ent = evaluateWorkoutEntitlement({
      planCanonKey: planCanon,
      organizationId: orgId,
      abonoRow: row,
      abonoLoading: false,
      freeClassGrant: g,
      fechaYmd: diaSeleccionado,
      horarioNormalized: normalizeSlotLabel(hora),
    });
    if (!ent.ok) {
      Alert.alert(tStr('client_trabajo_locked_title'), tStr('client_trabajo_locked_body'));
      return;
    }

    if (!isBookingRequired) {
      goTrabajoDia(hora);
      return;
    }

    const slot = normalizeSlotLabel(hora);
    if (!slot) return;

    const myBooking = myScheduledBySlot[slot];
    const myWaiting = myWaitingBySlot[slot];
    if (myBooking) {
      setSlotBusy(slot);
      const out = await cancelClassSlotServer({
        organizationId: orgId,
        planCanonId: planCanon,
        fechaYmd: diaSeleccionado,
        slotLabel: slot,
        minNoticeHours: planCfg.cancelNoticeHours,
      });
      setSlotBusy('');
      if (!out.ok) {
        if (out.reason === 'too_late_to_cancel') {
          const minHours =
            Number(out?.payload?.min_notice_hours) >= 0
              ? Number(out.payload.min_notice_hours)
              : Number(planCfg.cancelNoticeHours || 2);
          Alert.alert(
            tStr('calendario_cancel_late_title'),
            tStr('calendario_cancel_late_body').replace('{{hours}}', String(minHours)),
          );
        } else {
          Alert.alert(tStr('calendario_cancel_error_title'), tStr('calendario_cancel_error_body'));
        }
        return;
      }
      setMyScheduledBySlot((prev) => {
        const next = { ...prev };
        delete next[slot];
        return next;
      });
      setSlotOccupancy((prev) => ({
        ...prev,
        [slot]: Math.max(0, Number(prev[slot] || 0) - 1),
      }));
      Alert.alert(tStr('calendario_cancel_ok_title'), tStr('calendario_cancel_ok_body'));
      return;
    }

    if (myWaiting) {
      setSlotBusy(slot);
      const out = await leaveClassWaitlistServer({
        organizationId: orgId,
        planCanonId: planCanon,
        fechaYmd: diaSeleccionado,
        slotLabel: slot,
      });
      setSlotBusy('');
      if (!out.ok) {
        Alert.alert(tStr('calendario_waitlist_leave_error_title'), tStr('calendario_waitlist_leave_error_body'));
        return;
      }
      setMyWaitingBySlot((prev) => {
        const next = { ...prev };
        delete next[slot];
        return next;
      });
      Alert.alert(tStr('calendario_waitlist_leave_ok_title'), tStr('calendario_waitlist_leave_ok_body'));
      return;
    }

    setSlotBusy(slot);
    let res = await bookClassSlotServer({
      organizationId: orgId,
      planCanonId: planCanon,
      fechaYmd: diaSeleccionado,
      slotLabel: slot,
    });
    if (!res.ok && res.reason === 'medical_responsibility_required') {
      setSlotBusy('');
      const accepted = await askMedicalResponsibility();
      if (!accepted) return;
      setSlotBusy(slot);
      res = await bookClassSlotServer({
        organizationId: orgId,
        planCanonId: planCanon,
        fechaYmd: diaSeleccionado,
        slotLabel: slot,
        acceptMedicalResponsibility: true,
      });
    }
    setSlotBusy('');

    if (!res.ok) {
      const reason = res.reason || '';
      if (reason === 'full') {
        Alert.alert(
          tStr('calendario_booking_full_title'),
          tStr('calendario_booking_full_body'),
          [
            { text: tStr('common_cancel'), style: 'cancel' },
            {
              text: tStr('calendario_waitlist_join_cta'),
              onPress: async () => {
                setSlotBusy(slot);
                const join = await joinClassWaitlistServer({
                  organizationId: orgId,
                  planCanonId: planCanon,
                  fechaYmd: diaSeleccionado,
                  slotLabel: slot,
                });
                if (!join.ok && join.reason === 'medical_responsibility_required') {
                  setSlotBusy('');
                  const accepted = await askMedicalResponsibility();
                  if (!accepted) return;
                  setSlotBusy(slot);
                  const joinAccepted = await joinClassWaitlistServer({
                    organizationId: orgId,
                    planCanonId: planCanon,
                    fechaYmd: diaSeleccionado,
                    slotLabel: slot,
                    acceptMedicalResponsibility: true,
                  });
                  setSlotBusy('');
                  if (!joinAccepted.ok) {
                    if (joinAccepted.reason === 'medical_blocked') {
                      handleMedicalBlocked();
                    } else {
                      Alert.alert(tStr('calendario_waitlist_join_error_title'), tStr('calendario_waitlist_join_error_body'));
                    }
                    return;
                  }
                  setMyWaitingBySlot((prev) => ({ ...prev, [slot]: { slot_label: slot, user_id: user?.id } }));
                  Alert.alert(tStr('calendario_waitlist_join_ok_title'), tStr('calendario_waitlist_join_ok_body'));
                  return;
                }
                setSlotBusy('');
                if (!join.ok) {
                  if (join.reason === 'slot_available') {
                    Alert.alert(tStr('calendario_waitlist_slot_available_title'), tStr('calendario_waitlist_slot_available_body'));
                  } else if (join.reason === 'medical_blocked') {
                    handleMedicalBlocked();
                  } else {
                    Alert.alert(tStr('calendario_waitlist_join_error_title'), tStr('calendario_waitlist_join_error_body'));
                  }
                  return;
                }
                setMyWaitingBySlot((prev) => ({ ...prev, [slot]: { slot_label: slot, user_id: user?.id } }));
                Alert.alert(tStr('calendario_waitlist_join_ok_title'), tStr('calendario_waitlist_join_ok_body'));
              },
            },
          ],
        );
      } else if (reason === 'slot_not_found') {
        Alert.alert(tStr('calendario_booking_slot_missing_title'), tStr('calendario_booking_slot_missing_body'));
      } else if (reason === 'no_active_membership') {
        Alert.alert(tStr('client_trabajo_locked_title'), tStr('client_trabajo_locked_body'));
      } else if (reason === 'booking_not_enabled') {
        Alert.alert(tStr('calendario_booking_mode_title'), tStr('calendario_booking_mode_body'));
      } else if (reason === 'medical_blocked') {
        handleMedicalBlocked();
      } else {
        Alert.alert(tStr('calendario_booking_error_title'), tStr('calendario_booking_error_body'));
      }
      return;
    }

    const occ = Number(res.data?.occupancy || 0);
    setSlotOccupancy((prev) => ({ ...prev, [slot]: occ }));
    setMyScheduledBySlot((prev) => ({ ...prev, [slot]: { slot_label: slot, user_id: user?.id } }));
    Alert.alert(
      tStr('calendario_booking_ok_title'),
      tStr('calendario_booking_ok_body').replace('{{time}}', slot).replace('{{date}}', diaSeleccionado),
      [{ text: tStr('common_ok'), onPress: () => goTrabajoDia(slot) }],
    );
  };

  const mes = useMemo(
    () =>
      new Date(diaSeleccionado).toLocaleDateString(dateLocale, {
        month: 'long',
        year: 'numeric',
      }),
    [diaSeleccionado, dateLocale],
  );

  const mostrarRecordatorioApto = useMemo(() => {
    const user = params.userData || {};
    if (!user || user.hasMedicalCertificate) return false;
    const creado = new Date(user.createdAt || new Date());
    const ahora = new Date();
    const diffDias = (ahora - creado) / (1000 * 60 * 60 * 24);
    return diffDias >= 15;
  }, [params.userData]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        panel: {
          alignItems: 'stretch',
          borderRadius: MOBILE_RADII.lg,
          marginBottom: 24,
          marginHorizontal: 12,
          marginTop: isWebDesktop ? 28 : 12,
          padding: isWebDesktop ? 28 : 18,
          width: '100%',
          maxWidth: panelMaxWidth,
          alignSelf: 'center',
          backgroundColor: t.boxBg,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          shadowColor: t.brand,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 6,
        },
        mes: {
          color: t.brand,
          fontSize: MOBILE_TYPE.subhead,
          fontWeight: '800',
          marginBottom: 4,
          textAlign: 'center',
          letterSpacing: 0.6,
        },
        fechaSeleccionada: {
          color: t.text,
          fontSize: MOBILE_TYPE.bodyStrong,
          fontWeight: '700',
          marginBottom: 14,
          textAlign: 'center',
          textTransform: 'capitalize',
        },
        contentGrid: {
          width: '100%',
          flexDirection: isWebDesktop && isBookingRequired ? 'row' : 'column',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
        },
        leftCol: {
          width: isWebDesktop && isBookingRequired ? '36%' : '100%',
        },
        rightCol: {
          width: isWebDesktop && isBookingRequired ? '62%' : '100%',
        },

        // alerta apto médico
        alertaApto: {
          backgroundColor: hexToRgba(t.brand, 0.08),
          borderLeftColor: hexToRgba(t.brand, 0.35),
          borderLeftWidth: 5,
          borderRadius: MOBILE_RADII.sm,
          marginBottom: 14,
          padding: 10,
          width: '100%',
        },
        textoAlerta: {
          color: t.text,
          fontSize: MOBILE_TYPE.label,
          fontWeight: '600',
        },

        weekStrip: {
          width: '100%',
          marginBottom: 12,
          borderRadius: MOBILE_RADII.md,
          backgroundColor: hexToRgba(t.brand, 0.06),
          borderWidth: 1,
          borderColor: t.overlayBorder,
          paddingVertical: 8,
          overflow: 'hidden',
        },
        weekScroll: {
          flexGrow: 0,
          width: '100%',
        },
        weekRow: {
          alignItems: 'flex-end',
          flexDirection: 'row',
          gap: 8,
          paddingHorizontal: 10,
          paddingVertical: 4,
        },
        diaContainer: {
          alignItems: 'center',
          minWidth: 52,
          paddingHorizontal: 4,
          paddingVertical: 4,
        },
        diaContainerOff: { opacity: 0.42 },
        diaContainerHas: {},
        diaSeleccionado: {
          backgroundColor: hexToRgba(t.brand, 0.16),
          borderColor: hexToRgba(t.brand, 0.55),
          borderRadius: MOBILE_RADII.md,
          borderWidth: 1.5,
        },
        diaLabel: {
          color: t.subText,
          fontSize: MOBILE_TYPE.caption,
          fontWeight: '700',
          marginBottom: 4,
          textAlign: 'center',
        },
        diaLabelActivo: {
          color: t.brand,
          fontWeight: '800',
        },
        diaLabelHas: {
          color: t.text,
        },
        circuloNumero: {
          alignItems: 'center',
          backgroundColor: t.boxBg,
          borderColor: t.overlayBorder,
          borderRadius: MOBILE_RADII.xl,
          borderWidth: 1.5,
          height: 44,
          justifyContent: 'center',
          width: 44,
        },
        circuloActivo: {
          ...t.buttonPrimary,
          borderWidth: 0,
          transform: [{ scale: 1.06 }],
        },
        circuloHas: {
          borderColor: hexToRgba(t.brand, 0.55),
        },
        circuloHoy: {
          borderColor: hexToRgba(t.brand, 0.85),
          borderWidth: 2,
        },
        diaNumero: {
          color: t.text,
          fontSize: MOBILE_TYPE.bodyStrong,
          fontWeight: '800',
        },
        diaNumeroActivo: {
          ...t.buttonPrimaryText,
        },
        hoyTag: {
          color: t.brand,
          fontSize: MOBILE_TYPE.micro,
          fontWeight: '800',
          marginTop: 4,
          letterSpacing: 0.4,
        },
        punto: {
          backgroundColor: t.brand,
          borderRadius: 3,
          height: 6,
          marginTop: 4,
          width: 6,
        },
        puntoSemanal: {
          backgroundColor: hexToRgba(t.subText, 0.85),
          borderRadius: 3,
          height: 5,
          marginTop: 5,
          width: 5,
        },
        bookingLegend: {
          color: t.subText,
          fontSize: MOBILE_TYPE.caption,
          marginTop: -6,
          marginBottom: 10,
          textAlign: 'center',
          lineHeight: 17,
        },

        // horarios (cajas tipo input)
        subtitulo: {
          color: t.subText,
          fontSize: MOBILE_TYPE.bodyStrong,
          fontWeight: '600',
          marginBottom: 14,
          textAlign: isWebDesktop ? 'left' : 'center',
        },
        horariosContainer: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 10,
          justifyContent: isWebDesktop ? 'flex-start' : 'stretch',
          width: '100%',
        },
        horario: {
          backgroundColor: t.boxBg,
          borderColor: t.overlayBorder,
          borderRadius: MOBILE_RADII.md,
          borderWidth: 1.2,
          flexGrow: 1,
          flexBasis: isWebDesktop ? '30%' : '46%',
          maxWidth: isWebDesktop ? 220 : '48%',
          minWidth: isWebDesktop ? 140 : 128,
          margin: 0,
          paddingHorizontal: 14,
          minHeight: MOBILE_SIZES.controlHeightLg,
          paddingVertical: MOBILE_SPACING.md,
          justifyContent: 'center',
        },
        horarioPrefill: {
          borderColor: t.brand,
          borderWidth: 1.8,
        },
        horarioConRutina: {
          borderColor: hexToRgba(t.brand, 0.75),
          backgroundColor: hexToRgba(t.brand, 0.1),
        },
        horarioTexto: {
          color: t.text,
          fontWeight: 'bold',
          textAlign: 'center',
        },
        horarioMeta: {
          color: t.subText,
          marginTop: 4,
          fontSize: MOBILE_TYPE.caption,
          textAlign: 'center',
        },
        slotStateTag: {
          marginTop: 6,
          alignSelf: 'center',
          borderRadius: MOBILE_RADII.pill,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          paddingHorizontal: 8,
          paddingVertical: 3,
        },
        slotStateTagReserved: {
          backgroundColor: hexToRgba('#16a34a', 0.18),
          borderColor: hexToRgba('#15803d', 0.32),
        },
        slotStateTagWaiting: {
          backgroundColor: hexToRgba('#f59e0b', 0.16),
          borderColor: hexToRgba('#d97706', 0.3),
        },
        slotStateTagOpen: {
          backgroundColor: hexToRgba(t.brand, 0.12),
          borderColor: hexToRgba(t.brand, 0.28),
        },
        slotStateTagNearFull: {
          backgroundColor: hexToRgba('#f59e0b', 0.16),
          borderColor: hexToRgba('#d97706', 0.3),
        },
        slotStateTxt: { fontSize: MOBILE_TYPE.micro, fontWeight: '800', color: t.text, letterSpacing: 0.2 },
        slotStateTxtReserved: { color: '#166534' },
        slotStateTxtWaiting: { color: '#92400e' },
        slotStateTxtOpen: { color: t.brand },
        slotStateTxtNearFull: { color: '#92400e' },

        // volver (compacto arriba; el ancho completo quedó obsoleto en móvil web)
        volverTop: {
          alignSelf: 'flex-start',
          marginBottom: 10,
        },
        scrollContent: {
          // Web escritorio: sin estirar scroll vacío. Móvil web + nativo: flexGrow para que el panel no colapse (pantalla negra).
          ...(Platform.OS === 'web' && isWebDesktop ? WEB_SCROLL_NO_STRETCH : { flexGrow: 1 }),
          paddingBottom: Platform.OS === 'web' ? 32 : 24,
          width: '100%',
        },
        lockText: {
          color: t.subText,
          fontSize: MOBILE_TYPE.body,
          lineHeight: 20,
          marginBottom: 16,
          textAlign: 'center',
        },
        lockCta: {
          alignItems: 'center',
          ...t.buttonPrimary,
          borderRadius: MOBILE_RADII.sm,
          minHeight: MOBILE_SIZES.controlHeight,
          marginTop: 12,
          marginBottom: 4,
          paddingVertical: MOBILE_SPACING.md,
          paddingHorizontal: MOBILE_SPACING.lg,
          justifyContent: 'center',
          width: '100%',
        },
        lockCtaTxt: { ...t.buttonPrimaryText, fontSize: MOBILE_TYPE.bodyStrong },
      }),
    [t, isWebDesktop, panelMaxWidth, isBookingRequired],
  );

  if (user?.id && abonoLoading) {
    return (
      <BackgroundWrapper screen="ClientScreen" plan={plan}>
        <View style={{ flex: 1, minHeight: 0, justifyContent: 'center' }}>
          <NeoPanel style={[styles.panel, { marginTop: height * 0.12, minHeight: 120 }]}>
            <ActivityIndicator size="large" color={t.brand} />
          </NeoPanel>
        </View>
      </BackgroundWrapper>
    );
  }

  const calendarLocked = user?.id && !calendarAccess.ok;

  return (
    <BackgroundWrapper screen="ClientScreen" plan={plan}>
      <View testID="screen-calendario" style={{ flex: 1, minHeight: 0 }}>
        <ScrollView
          style={{ flex: 1, minHeight: 0 }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
        >
      <NeoPanel style={styles.panel}>
        <BackNavButton
          testID="calendario-nav-back"
          onPress={() => navigation.goBack()}
          label={tStr('config_back')}
          style={styles.volverTop}
        />
        <Text style={styles.mes}>{mes.toUpperCase()}</Text>
        {selectedDateLabel ? <Text style={styles.fechaSeleccionada}>{selectedDateLabel}</Text> : null}

        {mostrarRecordatorioApto && (
          <View style={styles.alertaApto}>
            <Text style={styles.textoAlerta}>⚠️ {tStr('calendario_apto_reminder')}</Text>
          </View>
        )}

        {calendarLocked ? (
          <>
            <Text style={styles.subtitulo}>{tStr('client_calendario_locked_title')}</Text>
            <Text style={styles.lockText}>{tStr('client_calendario_locked_body')}</Text>
            <TouchableOpacity
              style={styles.lockCta}
              onPress={() => navigation.navigate('AbonosPases')}
              activeOpacity={0.9}
            >
              <Text style={styles.lockCtaTxt}>{tStr('client_entitlement_go_pay')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.lockCta}
              onPress={() => navigation.navigate('PlanSelector')}
              activeOpacity={0.9}
            >
              <Text style={styles.lockCtaTxt}>{tStr('client_entitlement_go_plans')}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.weekStrip}>
              <ScrollView
                ref={weekScrollRef}
                horizontal
                nestedScrollEnabled
                showsHorizontalScrollIndicator
                style={styles.weekScroll}
                contentContainerStyle={styles.weekRow}
              >
                {days.map((d) => {
                  const weekday = getIsoWeekdayFromYmd(d.full);
                  const publishedOnDay = (blocksByDate[d.full]?.slots?.length || 0) > 0;
                  const tieneHorarioSemanal = offeredWeekdays.has(weekday);
                  const tieneContenido = publishedOnDay || tieneHorarioSemanal;
                  const seleccionado = diaSeleccionado === d.full;
                  const esHoy = d.full === todayYmd;

                  return (
                    <TouchableOpacity
                      key={d.full}
                      onPress={() => setDiaSeleccionado(d.full)}
                      onLayout={(e) => {
                        dayLayoutsRef.current[d.full] = e.nativeEvent.layout;
                      }}
                      accessibilityRole="button"
                      accessibilityState={{ selected: seleccionado }}
                      style={[
                        styles.diaContainer,
                        tieneContenido && styles.diaContainerHas,
                        !tieneContenido && styles.diaContainerOff,
                        seleccionado && styles.diaSeleccionado,
                      ]}
                    >
                      <Text
                        style={[
                          styles.diaLabel,
                          tieneContenido && styles.diaLabelHas,
                          seleccionado && styles.diaLabelActivo,
                        ]}
                      >
                        {d.label.toUpperCase()}
                      </Text>
                      <View
                        style={[
                          styles.circuloNumero,
                          tieneContenido && styles.circuloHas,
                          esHoy && !seleccionado && styles.circuloHoy,
                          seleccionado && styles.circuloActivo,
                        ]}
                      >
                        <Text style={[styles.diaNumero, seleccionado && styles.diaNumeroActivo]}>
                          {d.number}
                        </Text>
                      </View>
                      {esHoy ? (
                        <Text style={styles.hoyTag}>{locale === 'en' ? 'TODAY' : 'HOY'}</Text>
                      ) : publishedOnDay ? (
                        <View style={styles.punto} />
                      ) : tieneHorarioSemanal ? (
                        <View style={styles.puntoSemanal} />
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
            <View style={styles.contentGrid}>
              <View style={styles.leftCol}>
                {isBookingRequired ? (
                  <Text style={styles.lockText}>
                    {offeredWeekdays.size
                      ? tStr('calendario_weekly_hint').replace(
                          '{{days}}',
                          days
                            .filter((d) => offeredWeekdays.has(getIsoWeekdayFromYmd(d.full)))
                            .slice(0, 7)
                            .map((d) => d.label.toUpperCase())
                            .filter((x, i, arr) => arr.indexOf(x) === i)
                            .join(' · '),
                        )
                      : tStr('calendario_weekly_hint_empty')}
                  </Text>
                ) : null}
              </View>
              <View style={styles.rightCol}>
                <Text style={styles.subtitulo}>
                  {isBookingRequired ? tStr('calendario_horarios_reservables') : tStr('calendario_horarios_disponibles')}
                </Text>
                {isBookingRequired ? <Text style={styles.bookingLegend}>{tStr('calendario_days_legend')}</Text> : null}

                {slotsLoading ? (
                  <ActivityIndicator size="small" color={t.brand} />
                ) : visibleSlots.length === 0 ? (
                  <Text style={styles.lockText}>
                    {isBookingRequired && offeredWeekdays.size
                      ? tStr('calendario_weekly_offday')
                      : tStr('calendario_no_slots_published')}
                  </Text>
                ) : (
                  <View style={styles.horariosContainer}>
                    {visibleSlots.map((h) => {
                      const slot = normalizeSlotLabel(h);
                      const busy = slotBusy === slot;
                      const mine = !!myScheduledBySlot[slot];
                      const waiting = !!myWaitingBySlot[slot];
                      const blockForSlot = blockBySlot[slot];
                      const tituloRutina =
                        blockForSlot?.titulo || blocksByDate[diaSeleccionado]?.titles?.[slot] || '';
                      const tieneRutina = Boolean(blockForSlot || tituloRutina);
                      const cap = blockForSlot?.capacity ?? planCfg.defaultCapacity ?? null;
                      const occ = slotOccupancy[slot] || 0;
                      const waitN = waitCountBySlot[slot] || 0;
                      const remaining = cap ? Math.max(0, Number(cap) - Number(occ || 0)) : null;
                      const nearThreshold = Math.max(1, Number(planCfg.nearFullThreshold || 2));
                      const nearFull = !mine && !waiting && cap && remaining > 0 && remaining <= nearThreshold;
                      const stateKey = mine ? 'reserved' : waiting ? 'waiting' : nearFull ? 'near_full' : 'open';
                      const stateTagStyle =
                        stateKey === 'reserved'
                          ? styles.slotStateTagReserved
                          : stateKey === 'waiting'
                            ? styles.slotStateTagWaiting
                            : stateKey === 'near_full'
                              ? styles.slotStateTagNearFull
                            : styles.slotStateTagOpen;
                      const stateTxtStyle =
                        stateKey === 'reserved'
                          ? styles.slotStateTxtReserved
                          : stateKey === 'waiting'
                            ? styles.slotStateTxtWaiting
                            : stateKey === 'near_full'
                              ? styles.slotStateTxtNearFull
                            : styles.slotStateTxtOpen;
                      const stateLabel =
                        stateKey === 'reserved'
                          ? tStr('calendario_state_reserved')
                          : stateKey === 'waiting'
                            ? tStr('calendario_state_waiting')
                            : stateKey === 'near_full'
                              ? tStr('calendario_state_near_full')
                            : tStr('calendario_state_open');
                      return (
                        <TouchableOpacity
                          key={h}
                          style={[
                            styles.horario,
                            tieneRutina && styles.horarioConRutina,
                            prefillSlot && slot === prefillSlot && diaSeleccionado === params?.prefillDate
                              ? styles.horarioPrefill
                              : null,
                          ]}
                          onPress={() => handleReserva(h)}
                          disabled={busy}
                        >
                          <Text style={styles.horarioTexto}>{h}</Text>
                          <Text style={styles.horarioMeta}>
                            {busy
                              ? tStr('calendario_booking_pending')
                              : isBookingRequired
                                ? `${mine ? tStr('calendario_action_cancel') : waiting ? tStr('calendario_action_waiting_leave') : tStr('calendario_action_book')}${cap ? ` · ${occ}/${cap}` : ''}${waitN > 0 ? ` · ${tStr('calendario_waitlist_count_short').replace('{{n}}', String(waitN))}` : ''}`
                                : tituloRutina
                                  ? tituloRutina
                                  : tieneRutina
                                    ? tStr('calendario_slot_routine_ready')
                                    : tStr('calendario_action_view')}
                          </Text>
                          {isBookingRequired ? (
                            <View style={[styles.slotStateTag, stateTagStyle]}>
                              <Text style={[styles.slotStateTxt, stateTxtStyle]}>{stateLabel}</Text>
                            </View>
                          ) : null}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            </View>
          </>
        )}

      </NeoPanel>
        </ScrollView>
      </View>
    </BackgroundWrapper>
  );
}

CalendarioScreen.propTypes = {
  route: PropTypes.shape({
    params: PropTypes.shape({
      prefillDate: PropTypes.string,
      prefillSlot: PropTypes.string,
      userData: PropTypes.shape({
        hasMedicalCertificate: PropTypes.bool,
        createdAt: PropTypes.string,
      }),
    }),
  }),
  navigation: PropTypes.shape({
    navigate: PropTypes.func.isRequired,
    goBack: PropTypes.func.isRequired,
  }).isRequired,
};
