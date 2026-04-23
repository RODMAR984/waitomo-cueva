// screens/CalendarioScreen.js — Waitomo Dark Only (brillo unificado en paneles / inputs)
// Funcionalidad preservada: días, horarios, recordatorio apto médico, navegación a TrabajoDelDia

import React, { useMemo, useState, useEffect, useCallback } from 'react';
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
import { usePlanContext } from '../contexts/PlanContext';
import { useAuth } from '../contexts/AuthContext';
import BackgroundWrapper from '../components/BackgroundWrapper';
import { colors } from '../theme/colors';
import { useThemeContext } from '../contexts/ThemeContext';
import { useLocale } from '../contexts/LocaleContext';
import { supabase } from '../supabaseClient';
import { formatYmdLocal } from '../utils/formatYmdLocal';
import { normalizePlanKey } from '../utils/planKeyNormalize';
import { fetchLatestUserAbono } from '../utils/userAbonoFetch';
import { normalizeSlotLabel } from '../utils/freeClassGrantStorage';
import { resolveFreeClassGrant } from '../utils/trialClassGrantSupabase';
import {
  bookClassSlotServer,
  cancelClassSlotServer,
  joinClassWaitlistServer,
  leaveClassWaitlistServer,
} from '../utils/classBookingSupabase';
import { evaluateCalendarioAccess, evaluateWorkoutEntitlement } from '../utils/clientWorkoutEntitlement';
import { reportError, trackEvent } from '../utils/observability';

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
  const isWebDesktop = Platform.OS === 'web' && width >= 1100;
  const panelMaxWidth = isWebDesktop ? 1180 : 780;
  const { plan: contextPlan } = usePlanContext();
  const { profile, user, organization } = useAuth();
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
  const prefillSlot = useMemo(() => normalizeSlotLabel(params?.prefillSlot), [params?.prefillSlot]);
  const dateLocale = locale === 'en' ? 'en-US' : 'es-AR';
  // Permite revisar historial reciente y próximos días.
  const days = useMemo(() => getNextDays(-14, 45, locale), [locale]);
  const horarios = useMemo(() => generarHorarios(plan?.nombre || 'Cross Training'), [plan?.nombre]);

  const planCanon = useMemo(
    () => normalizePlanKey(params.planKey) || normalizePlanKey(plan?.id) || null,
    [params.planKey, plan?.id],
  );

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

  const orgId = organization?.id || profile?.organization_id || null;

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
          .select('id, plan_key, slot_label, capacity')
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
    if (weeklySlotsForDay.length) return weeklySlotsForDay;
    return isBookingRequired ? [] : horarios;
  }, [publishedSlots, weeklySlotsForDay, isBookingRequired, horarios]);

  const goTrabajoDia = (hora) => {
    navigation.navigate('TrabajoDelDia', {
      fecha: diaSeleccionado,
      hora,
      plan,
      planKey: params.planKey || plan?.id,
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
          alignItems: 'center',
          borderRadius: 24,
          marginBottom: 40,
          marginHorizontal: 16,
          marginTop: isWebDesktop ? 34 : height * 0.18,
          padding: isWebDesktop ? 28 : 24,
          width: '100%',
          maxWidth: panelMaxWidth,
          alignSelf: 'center',
          backgroundColor: t.boxBg,
          borderWidth: 1,
          borderColor: t.overlayBorder,   // unificado
          // sombras sutiles sobre overlay
          shadowColor: t.brand,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 6,
        },
        mes: {
          color: t.brand,
          fontSize: 18,
          fontWeight: 'bold',
          marginBottom: 10,
          textAlign: 'center',
        },
        contentGrid: {
          width: '100%',
          flexDirection: isWebDesktop ? 'row' : 'column',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
        },
        leftCol: {
          width: isWebDesktop ? '36%' : '100%',
        },
        rightCol: {
          width: isWebDesktop ? '62%' : '100%',
        },

        // alerta apto médico
        alertaApto: {
          backgroundColor: hexToRgba(t.brand, 0.08),
          borderLeftColor: hexToRgba(t.brand, 0.35),
          borderLeftWidth: 5,
          borderRadius: 8,
          marginBottom: 14,
          padding: 10,
          width: '100%',
        },
        textoAlerta: {
          color: t.text,
          fontSize: 13,
          fontWeight: '600',
        },

        // tira de días
        weekRow: {
          alignItems: 'center',
          flexDirection: 'row',
          gap: 6,
          marginBottom: 24,
          paddingHorizontal: 10,
        },
        diaContainer: {
          alignItems: 'center',
          marginHorizontal: 4,
        },
        diaContainerOff: { opacity: 0.45 },
        diaContainerHas: {
          paddingHorizontal: 2,
        },
        // sin color literal; la “selección” se marca con circuloActivo y diaLabelActivo
        diaSeleccionado: {},
        diaLabel: {
          color: t.subText,
          fontSize: 11,
          fontWeight: 'bold',
          marginBottom: 2,
          textAlign: 'center',
        },
        diaLabelActivo: {
          color: t.brand,
          fontWeight: 'bold',
        },
        diaLabelHas: {
          color: t.text,
        },
        circuloNumero: {
          alignItems: 'center',
          backgroundColor: t.boxBg,
          borderColor: t.overlayBorder, // unificado
          borderRadius: 20,
          borderWidth: 1,
          height: 40,
          justifyContent: 'center',
          width: 40,
        },
        circuloActivo: {
          ...t.buttonPrimary,
        },
        circuloHas: {
          borderColor: hexToRgba(t.brand, 0.55),
          borderWidth: 1.5,
        },
        diaNumero: {
          color: t.text,
          fontSize: 16,
          fontWeight: 'bold',
        },
        diaNumeroActivo: {
          ...t.buttonPrimaryText,
        },
        punto: {
          backgroundColor: t.brand,
          borderRadius: 3,
          height: 6,
          marginTop: 4,
          width: 6,
        },
        bookingLegend: {
          color: t.subText,
          fontSize: 12,
          marginTop: -6,
          marginBottom: 10,
          textAlign: 'center',
          lineHeight: 17,
        },

        // horarios (cajas tipo input)
        subtitulo: {
          color: t.subText,
          fontSize: 18,
          fontWeight: '600',
          marginBottom: 14,
          textAlign: isWebDesktop ? 'left' : 'center',
        },
        horariosContainer: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 10,
          justifyContent: isWebDesktop ? 'flex-start' : 'center',
        },
        horario: {
          backgroundColor: t.boxBg,
          borderColor: t.overlayBorder, // unificado
          borderRadius: 12,
          borderWidth: 1.2,
          margin: 6,
          paddingHorizontal: 20,
          paddingVertical: 12,
        },
        horarioPrefill: {
          borderColor: t.brand,
          borderWidth: 1.8,
        },
        horarioTexto: {
          color: t.text,
          fontWeight: 'bold',
          textAlign: 'center',
        },
        horarioMeta: {
          color: t.subText,
          marginTop: 4,
          fontSize: 12,
          textAlign: 'center',
        },
        slotStateTag: {
          marginTop: 6,
          alignSelf: 'center',
          borderRadius: 999,
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
        slotStateTxt: { fontSize: 10, fontWeight: '800', color: t.text, letterSpacing: 0.2 },
        slotStateTxtReserved: { color: '#166534' },
        slotStateTxtWaiting: { color: '#92400e' },
        slotStateTxtOpen: { color: t.brand },
        slotStateTxtNearFull: { color: '#92400e' },

        // volver
        volver: {
          alignItems: 'center',
          ...t.buttonPrimary,
          borderRadius: 10,
          marginTop: 30,
          padding: 14,
        },
        volverTxt: t.buttonPrimaryText,
        lockText: {
          color: t.subText,
          fontSize: 14,
          lineHeight: 20,
          marginBottom: 16,
          textAlign: 'center',
        },
        lockCta: {
          alignItems: 'center',
          ...t.buttonPrimary,
          borderRadius: 10,
          marginTop: 10,
          padding: 14,
          width: '100%',
        },
        lockCtaTxt: t.buttonPrimaryText,
      }),
    [t, isWebDesktop, panelMaxWidth],
  );

  if (user?.id && abonoLoading) {
    return (
      <BackgroundWrapper plan={plan}>
        <View style={[styles.panel, { marginTop: height * 0.25, minHeight: 120 }]}>
          <ActivityIndicator size="large" color={t.brand} />
        </View>
      </BackgroundWrapper>
    );
  }

  const calendarLocked = user?.id && !calendarAccess.ok;

  return (
    <BackgroundWrapper plan={plan}>
      <View style={styles.panel}>
        <Text style={styles.mes}>{mes.toUpperCase()}</Text>

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
            <View style={styles.contentGrid}>
              <View style={styles.leftCol}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.weekRow}
                >
                  {days.map((d) => {
                    const weekday = getIsoWeekdayFromYmd(d.full);
                    const tieneContenido = offeredWeekdays.has(weekday);

                    const seleccionado = diaSeleccionado === d.full;

                    return (
                      <TouchableOpacity
                        key={d.full}
                        onPress={() => setDiaSeleccionado(d.full)}
                        style={[
                          styles.diaContainer,
                          tieneContenido && styles.diaContainerHas,
                          !tieneContenido && styles.diaContainerOff,
                          seleccionado && styles.diaSeleccionado,
                        ]}
                      >
                        <Text style={[styles.diaLabel, tieneContenido && styles.diaLabelHas, seleccionado && styles.diaLabelActivo]}>
                          {d.label.toUpperCase()}
                        </Text>
                        <View style={[styles.circuloNumero, tieneContenido && styles.circuloHas, seleccionado && styles.circuloActivo]}>
                          <Text style={[styles.diaNumero, seleccionado && styles.diaNumeroActivo]}>
                            {d.number}
                          </Text>
                        </View>
                        {tieneContenido && <View style={styles.punto} />}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
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

        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.volver}>
          <Text style={styles.volverTxt}>⬅ {tStr('config_back')}</Text>
        </TouchableOpacity>
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
