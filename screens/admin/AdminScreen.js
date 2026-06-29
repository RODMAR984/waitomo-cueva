// screens/AdminScreen.js — Waitomo (modo claro y oscuro)
// - Paneles e inputs con tokens de tema (t.boxBg, t.inputBg) para coach/superadmin
// - Crear, copiar, pegar, mover y EDITAR bloques; selector de fecha con calendario

import React, { useState, useMemo, memo, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Platform,
  Modal,
  Keyboard,
  ActivityIndicator,
  Dimensions,
  useWindowDimensions,
  TouchableWithoutFeedback,
  Pressable,
  DeviceEventEmitter,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, usePreventRemove } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';

import BackgroundWrapper from '../../components/BackgroundWrapper';
import VideoLinksThumbs from '../../components/VideoLinksThumbs';
import { useTrainingData } from '../../contexts/TrainingDataContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../supabaseClient';
import { colors } from '../../theme/colors';
import { useThemeContext } from '../../contexts/ThemeContext';
import { useLocale } from '../../contexts/LocaleContext';
import { normalizeBlockPlanKey, plansMatchForBlocks } from '../../utils/trainingBlockPlan';
import { formatYmdLocal } from '../../utils/formatYmdLocal';
import { extractRmTags, splitTextWithRmTokens, RM_HIGHLIGHT_COLOR } from '../../utils/rmPattern';
import {
  generateRoutineDraft,
  rewriteBlockWithAi,
  draftMessageWithAi,
  normalizeRmPatternWithAi,
  draftCyclePlanWithAi,
} from '../../utils/aiAssistant';
import { analyzeBlocksVolume, formatVolumePreviewShort } from '../../utils/volumeFromBlocks';
import { expandPlanKeysList } from '../../utils/planKeyQuery';
import AdminAiPromptWithVoice from '../../components/AdminAiPromptWithVoice';
import useStaffAdminNavTiles from '../../hooks/useStaffAdminNavTiles';
import {
  ADMIN_SCROLL_LISTS,
  ADMIN_SCROLL_EDITOR,
  emitAdminScrollToEditor,
} from '../../utils/adminScrollBus';
import { WEB_CONTENT_MAX_WIDTH, WEB_DESKTOP_BREAKPOINT } from '../../theme/webSpec';
import { MOBILE_RADII, MOBILE_SIZES, MOBILE_SPACING, MOBILE_TYPE, screenHeaderTopPadding } from '../../theme/mobileSpec';
import NeoPanel from '../../components/NeoPanel';
import { FormKeyboardAvoidingView } from '../../components/AuthWebFormShell';

const PLAN_VALUE_TO_CHAT_PLAN_ID = {
  cross_training: 'cross',
  hyrox: 'hyrox',
  ciclo_evolucion: 'evolucion',
  stretching: 'stretching',
  yoga: 'yoga',
  open_box: 'openbox',
};

// Teal oscuro Waitomo para paneles/inputs (base fija, sin verdes)
const BASE_TEAL = '#021b23';
const BASE_TEAL_SOFT = '#032b36';
/** RN Web (Safari iOS): multiline sin minHeight colapsa y solapa labels. */
const ADMIN_TEXTAREA_MIN_HEIGHT = 108;

const hexToRgbaLocal = (hex, alpha = 1) => {
  const clean = String(hex).replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
};

const PLANS = [
  { label: 'CROSS TRAINING', value: 'cross_training', policy: 'SHARED' },
  { label: 'HYROX', value: 'hyrox', policy: 'SHARED' },
  { label: 'CICLO EVOLUCIÓN', value: 'ciclo_evolucion', policy: 'PARTITIONED' },
  { label: 'STRETCHING', value: 'stretching', policy: 'PARTITIONED' },
  { label: 'YOGA', value: 'yoga', policy: 'PARTITIONED' },
  { label: 'OPEN BOX', value: 'open_box', policy: 'PARTITIONED' },
];

/** Bloques viejos guardaban value tipo cross_training; tabla `plans` usa `code` (ej. cross). */
const LEGACY_BLOCK_PLAN_TO_CODE = {
  cross_training: 'cross',
  hyrox: 'hyrox',
  ciclo_evolucion: 'evolucion',
  stretching: 'stretching',
  yoga: 'yoga',
  open_box: 'openbox',
};

const blockPlanToCode = (stored) => LEGACY_BLOCK_PLAN_TO_CODE[stored] || stored;

const planMatchesSelection = (storedPlan, selectedCode) =>
  plansMatchForBlocks(storedPlan, selectedCode);

const generarHorarios = () => {
  const lista = [];
  for (let h = 6; h <= 22; h += 1) {
    lista.push(`${String(h).padStart(2, '0')}:00`);
    lista.push(`${String(h).padStart(2, '0')}:30`);
  }
  lista.push('23:00');
  return lista;
};

const fechaKeyFrom = (d) => {
  try {
    const x = d instanceof Date ? d : new Date(d);
    return formatYmdLocal(x);
  } catch {
    return '';
  }
};

const sumarDias = (baseDate, delta) => {
  const d = new Date(baseDate);
  d.setDate(d.getDate() + delta);
  return d;
};

const RM_PREVIEW_BASE = (extra = {}) => ({
  fontSize: MOBILE_TYPE.bodyStrong,
  lineHeight: 22,
  ...extra,
  ...(Platform.OS === 'android' ? { textAlignVertical: 'center', includeFontPadding: false } : {}),
});

const addDaysToYmd = (ymd, days) => {
  const base = String(ymd || '').slice(0, 10);
  const d = base ? new Date(`${base}T12:00:00`) : new Date();
  if (Number.isNaN(d.getTime())) return formatYmdLocal(new Date());
  d.setDate(d.getDate() + days);
  return formatYmdLocal(d);
};

const renderPreviewWithRM = (text, styles) => {
  if (!text) return <Text style={styles.previewText}>—</Text>;
  const parts = splitTextWithRmTokens(text);
  /** Un solo `Text` padre + hijos inline: el flujo respeta saltos y posición tal cual lo escribió el coach (sin fila flex centrada). */
  return (
    <Text style={styles.previewText}>
      {parts.map((seg, i) =>
        seg.type === 'text' ? (
          <Text key={`p_${i}`}>{seg.value}</Text>
        ) : (
          <Text key={`rm_${i}`} style={styles.rmText}>
            {seg.full}
          </Text>
        ),
      )}
    </Text>
  );
};

const CustomDropdown = memo(function CustomDropdown({
  label,
  value,
  onSelect,
  items = [],
  styles,
  t,
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.block}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity onPress={() => setOpen(true)} style={styles.dropdown}>
        <Text style={styles.dropdownValue}>
          {items.find((i) => i.value === value)?.label || '—'}
        </Text>
        <Ionicons name="chevron-down" size={18} color={t.brand} />
      </TouchableOpacity>
      {open && (
        <TouchableWithoutFeedback onPress={() => setOpen(false)}>
          <View style={styles.dropdownBackdrop}>
            <TouchableWithoutFeedback>
              <View style={styles.dropdownList}>
                <ScrollView style={styles.dropdownScroll}>
                  {items.map((it) => (
                    <TouchableOpacity
                      key={it.value}
                      onPress={() => {
                        onSelect(it.value);
                        setOpen(false);
                      }}
                      style={styles.dropdownItem}
                    >
                      <Text style={styles.dropdownItemText}>{it.label}</Text>
                      {value === it.value && (
                        <Ionicons name="checkmark" size={18} color={t.brand} />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      )}
    </View>
  );
});

const MultiHorarioDropdown = memo(function MultiHorarioDropdown({
  horariosSeleccionados,
  onHorariosChange,
  styles,
  t,
  tStr,
}) {
  const [open, setOpen] = useState(false);
  const items = useMemo(() => generarHorarios(), []);

  const toggleHour = (v) => {
    const exist = horariosSeleccionados.includes(v);
    const next = exist
      ? horariosSeleccionados.filter((h) => h !== v)
      : [...horariosSeleccionados, v];
    onHorariosChange(next.sort());
  };

  return (
    <View style={styles.block}>
      <Text style={styles.label}>{tStr('admin_horarios')}</Text>
      <TouchableOpacity onPress={() => setOpen(true)} style={styles.dropdown}>
        <Text style={styles.dropdownValue}>
          {horariosSeleccionados.length
            ? horariosSeleccionados.join(', ')
            : tStr('admin_elegir_horarios')}
        </Text>
        <Ionicons name="time-outline" size={18} color={t.brand} />
      </TouchableOpacity>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.modalHourPickerRoot}>
          <Pressable style={styles.modalHourPickerBackdrop} onPress={() => setOpen(false)} />
          <View style={styles.dropdownListModal}>
            <View style={styles.dropdownListHeader}>
              <Text style={styles.dropdownListHeaderText}>{tStr('admin_horarios')}</Text>
            </View>
            <ScrollView
              style={styles.dropdownHoursScroll}
              contentContainerStyle={styles.dropdownHoursScrollContent}
              showsVerticalScrollIndicator
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              bounces={false}
            >
              {items.map((label) => {
                const selected = horariosSeleccionados.includes(label);
                return (
                  <TouchableOpacity
                    key={label}
                    activeOpacity={0.7}
                    onPress={() => toggleHour(label)}
                    style={[styles.dropdownItem, selected && styles.dropdownItemSelected]}
                  >
                    <Text style={styles.dropdownItemText}>{label}</Text>
                    {selected && <Ionicons name="checkmark" size={18} color={t.brand} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <View style={styles.dropdownActions}>
              <TouchableOpacity onPress={() => setOpen(false)} style={styles.dropdownDoneBtn}>
                <Text style={styles.dropdownDoneText}>{tStr('admin_listo')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
});

export default function AdminScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { t } = useThemeContext();
  const { t: tStr, locale } = useLocale();
  const dateLocale = locale === 'en' ? 'en-US' : 'es-ES';
  const STAFF_WEB_RAIL = 232;
  const isDesktopWeb = Platform.OS === 'web' && windowWidth >= WEB_DESKTOP_BREAKPOINT;
  /** Web ancho: navegación staff fija a la izquierda (negocio en escritorio). */
  const isStaffWebDesktop = isDesktopWeb;
  const panelWidth = isDesktopWeb
    ? Math.min(
        windowWidth - 40 - (isStaffWebDesktop ? STAFF_WEB_RAIL + 14 : 0),
        WEB_CONTENT_MAX_WIDTH,
      )
    : Math.max(320, Math.min(windowWidth - 20, 920));
  const menuColumns = isDesktopWeb ? 3 : windowWidth >= 760 ? 2 : 1;
  const menuGap = 12;
  const menuTileWidth =
    menuColumns === 1
      ? panelWidth - 40
      : (panelWidth - 40 - (menuColumns - 1) * menuGap) / menuColumns;

  const { bloques, saveBloques, refreshTrigger } = useTrainingData();
  const {
    session,
    rolesByUser,
    isSuperAdmin,
    logout,
    profile,
    organization,
    organizationsOwnedByUser,
  } = useAuth();
  const myId = session?.user?.id || profile?.id || null;
  const myRole = rolesByUser?.[myId];
  const isSA = typeof isSuperAdmin === 'function' ? isSuperAdmin() : false;
  const isCoach = myRole === 'coach';
  const coachPlanActual = profile?.plan_actual ? String(profile.plan_actual) : null;

  const orgIdForPlans = useMemo(() => {
    const owned = organizationsOwnedByUser || [];
    if (owned.length === 1) return owned[0].id;
    return organization?.id || profile?.organization_id || null;
  }, [organizationsOwnedByUser, organization?.id, profile?.organization_id]);
  const [orgPlansRows, setOrgPlansRows] = useState([]);

  useEffect(() => {
    if (!orgIdForPlans) {
      setOrgPlansRows([]);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('plans')
          .select('code, title, subtitle, mode, active, order')
          .eq('organization_id', orgIdForPlans)
          .eq('active', true)
          .order('order', { ascending: true });
        if (error) throw error;
        if (alive) setOrgPlansRows(Array.isArray(data) ? data : []);
      } catch (e) {
        console.log('AdminScreen: planes org', e?.message || e);
        if (alive) setOrgPlansRows([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [orgIdForPlans]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (e) {
      console.log('Error logout admin', e);
    } finally {
      navigation.reset({
        index: 0,
        routes: [{ name: 'WelcomeGlobal' }],
      });
    }
  };

  const initialPlan =
    route?.params?.planValue ||
    (isCoach && coachPlanActual ? blockPlanToCode(coachPlanActual) : null) ||
    'cross_training';
  const [planSeleccionado, setPlanSeleccionado] = useState(initialPlan || 'cross_training');

  useEffect(() => {
    if (isCoach && coachPlanActual) {
      setPlanSeleccionado(blockPlanToCode(coachPlanActual));
    }
  }, [isCoach, coachPlanActual]);

  const plansDisponibles = useMemo(() => {
    let list = [];
    if (orgPlansRows.length > 0) {
      list = orgPlansRows.map((p) => ({
        label: p.title || p.code,
        value: p.code,
        policy: p.mode === 'program' ? 'PARTITIONED' : 'SHARED',
      }));
    } else if (orgIdForPlans) {
      if (isCoach && coachPlanActual) {
        const c = blockPlanToCode(coachPlanActual);
        list = [{ label: c, value: c, policy: 'SHARED' }];
      } else {
        list = [];
      }
    } else if (isSA) {
      list = PLANS;
    }
    if (isCoach && coachPlanActual && list.length > 1) {
      const codeWant = blockPlanToCode(coachPlanActual);
      const filtered = list.filter((p) => p.value === codeWant);
      return filtered.length ? filtered : list;
    }
    return list;
  }, [orgPlansRows, orgIdForPlans, isCoach, coachPlanActual, isSA]);

  useEffect(() => {
    if (plansDisponibles.length === 0) return;
    const vals = plansDisponibles.map((p) => p.value);
    if (vals.includes(planSeleccionado)) return;
    const mapped = blockPlanToCode(planSeleccionado);
    if (vals.includes(mapped)) {
      setPlanSeleccionado(mapped);
      return;
    }
    setPlanSeleccionado(vals[0]);
  }, [plansDisponibles]);

  const [fecha, setFecha] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [horariosSeleccionados, setHorariosSeleccionados] = useState([]);

  const [titulo, setTitulo] = useState('');
  const [contenido, setContenido] = useState('');
  const [capacityInput, setCapacityInput] = useState('');
  const [coachNotes, setCoachNotes] = useState('');
  const [videoLinks, setVideoLinks] = useState('');

  const [clipboardBloque, setClipboardBloque] = useState(null);

  const [editingBlockId, setEditingBlockId] = useState(null);
  const isEditing = !!editingBlockId;

  const [moveModalVisible, setMoveModalVisible] = useState(false);
  const [bloqueParaMover, setBloqueParaMover] = useState(null);
  const [moveTargetDate, setMoveTargetDate] = useState(null);
  const [moveTargetHora, setMoveTargetHora] = useState(null);
  const horariosDisponibles = useMemo(() => generarHorarios(), []);
  const [aiModalVisible, setAiModalVisible] = useState(false);
  const [aiMode, setAiMode] = useState('routine');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiOutput, setAiOutput] = useState('');
  const [aiSuggestedTitle, setAiSuggestedTitle] = useState('');
  const [aiCoachNotes, setAiCoachNotes] = useState('');
  const [aiWarnings, setAiWarnings] = useState([]);
  const [aiUsageLine, setAiUsageLine] = useState('');
  const [aiCycleScope, setAiCycleScope] = useState('all');
  const [aiCyclePlanKeys, setAiCyclePlanKeys] = useState([]);
  const [aiCycleMemberId, setAiCycleMemberId] = useState(null);
  const [aiDateFrom, setAiDateFrom] = useState('');
  const [aiDateTo, setAiDateTo] = useState('');
  const [aiVolumeLandmarks, setAiVolumeLandmarks] = useState('');
  const [aiVolumePreview, setAiVolumePreview] = useState('');
  const [aiVolumePreviewBusy, setAiVolumePreviewBusy] = useState(false);
  const [aiMemberOptions, setAiMemberOptions] = useState([]);

  const composerDirty = useMemo(() => {
    if (editingBlockId) {
      const b = (Array.isArray(bloques) ? bloques : []).find((x) => x.id === editingBlockId);
      if (!b) return false;
      const fkCur = fechaKeyFrom(fecha);
      const fkOrig = b.fechaKey || fechaKeyFrom(new Date(b.fecha));
      const horaCur = (horariosSeleccionados && horariosSeleccionados[0]) || '';
      const horaOrig = String(b.hora || '');
      const vidCur = videoLinks
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
        .join('\n');
      const vidOrig = (Array.isArray(b.videoLinks) ? b.videoLinks : []).join('\n');
      const capCur = (capacityInput || '').trim();
      const capOrig = b.capacity != null ? String(b.capacity) : '';
      return (
        (titulo || '').trim() !== (b.titulo || '').trim() ||
        (contenido || '').trim() !== (b.contenido || '').trim() ||
        (coachNotes || '').trim() !== (b.notas || '').trim() ||
        vidCur !== vidOrig ||
        capCur !== capOrig ||
        String(planSeleccionado || '') !== String(b.plan || '') ||
        fkCur !== fkOrig ||
        horaCur !== horaOrig
      );
    }
    return !!(
      (titulo || '').trim() ||
      (contenido || '').trim() ||
      (coachNotes || '').trim() ||
      (videoLinks || '').trim() ||
      (capacityInput || '').trim()
    );
  }, [
    editingBlockId,
    bloques,
    titulo,
    contenido,
    coachNotes,
    videoLinks,
    capacityInput,
    planSeleccionado,
    fecha,
    horariosSeleccionados,
  ]);

  usePreventRemove(
    composerDirty,
    ({ data }) => {
      Alert.alert(tStr('nav_unsaved_discard_title'), tStr('nav_unsaved_discard_body'), [
        { text: tStr('nav_unsaved_stay'), style: 'cancel' },
        {
          text: tStr('nav_unsaved_discard'),
          style: 'destructive',
          onPress: () => navigation.dispatch(data.action),
        },
      ]);
    },
  );

  const policy = useMemo(
    () => plansDisponibles.find((p) => p.value === planSeleccionado)?.policy || 'SHARED',
    [plansDisponibles, planSeleccionado],
  );
  const isPartitioned = policy === 'PARTITIONED';

  const bloquesPlanOrdenados = useMemo(() => {
    let lista = (Array.isArray(bloques) ? [...bloques] : []).filter((b) => {
      if (orgIdForPlans && b.organization_id && b.organization_id !== orgIdForPlans) return false;
      return planMatchesSelection(b?.plan, planSeleccionado);
    });
    if (!isSA && isCoach && isPartitioned && myId) {
      lista = lista.filter((b) => (b.coachId || null) === myId);
    }
    return lista.sort(
      (a, b) => new Date(a.fecha || 0) - new Date(b.fecha || 0),
    );
  }, [bloques, planSeleccionado, refreshTrigger, isSA, isCoach, isPartitioned, myId, orgIdForPlans]);

  const lastWeekBlocks = useMemo(() => {
    const now = new Date();
    const sevenAgo = new Date(now);
    sevenAgo.setDate(now.getDate() - 7);
    return bloquesPlanOrdenados.filter(
      (b) => new Date(b.fecha || 0) >= sevenAgo,
    );
  }, [bloquesPlanOrdenados]);

  const historicBlocks = useMemo(() => {
    const now = new Date();
    const sevenAgo = new Date(now);
    sevenAgo.setDate(now.getDate() - 7);
    return bloquesPlanOrdenados.filter(
      (b) => new Date(b.fecha || 0) < sevenAgo,
    );
  }, [bloquesPlanOrdenados]);

  const chatPlanId =
    normalizeBlockPlanKey(planSeleccionado) ||
    PLAN_VALUE_TO_CHAT_PLAN_ID[planSeleccionado] ||
    planSeleccionado;

  const { groups: adminNavGroups } = useStaffAdminNavTiles(navigation, tStr);
  const scrollViewRef = useRef(null);
  const listsSectionY = useRef(0);
  const editorSectionY = useRef(0);
  const pendingScrollRef = useRef(null);

  const runPendingScroll = useCallback(() => {
    const p = pendingScrollRef.current;
    if (!p || !scrollViewRef.current) return;
    const y = p === 'lists' ? listsSectionY.current : editorSectionY.current;
    if (y <= 0) return;
    scrollViewRef.current.scrollTo({ y: Math.max(0, y - 8), animated: true });
    pendingScrollRef.current = null;
  }, []);

  const scheduleScrollToLists = useCallback(() => {
    pendingScrollRef.current = 'lists';
    requestAnimationFrame(() => runPendingScroll());
  }, [runPendingScroll]);

  const scheduleScrollToEditor = useCallback(() => {
    pendingScrollRef.current = 'editor';
    requestAnimationFrame(() => runPendingScroll());
  }, [runPendingScroll]);

  useEffect(() => {
    const subL = DeviceEventEmitter.addListener(ADMIN_SCROLL_LISTS, scheduleScrollToLists);
    const subE = DeviceEventEmitter.addListener(ADMIN_SCROLL_EDITOR, scheduleScrollToEditor);
    return () => {
      subL.remove();
      subE.remove();
    };
  }, [scheduleScrollToLists, scheduleScrollToEditor]);

  useLayoutEffect(() => {
    const f = route.params?.adminFocus;
    if (f === 'lists') scheduleScrollToLists();
    else if (f === 'editor') scheduleScrollToEditor();
    if (f) {
      navigation.setParams({ adminFocus: undefined });
    }
  }, [route.params?.adminFocus, navigation, scheduleScrollToLists, scheduleScrollToEditor]);

  const irAlChatDelPlan = async () => {
    try {
      const orgChat = organization?.id || profile?.organization_id || null;
      if (!orgChat) {
        Alert.alert(
          tStr('admin_alert_chat_no_channel_title'),
          tStr('chat_hint_no_org'),
        );
        return;
      }
      const { data, error } = await supabase.rpc('ensure_chat_channel_for_org_plan', {
        p_organization_id: orgChat,
        p_plan_id: chatPlanId,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (row?.id) {
        navigation.navigate('Chat', {
          channelId: row.id,
          channelName: row.name || planSeleccionado,
        });
      } else {
        Alert.alert(
          tStr('admin_alert_chat_no_channel_title'),
          tStr('admin_alert_chat_no_channel_body'),
        );
      }
    } catch (e) {
      Alert.alert(tStr('gym_config_alert_title_error'), e?.message || tStr('admin_alert_chat_open_fail'));
    }
  };

  const openAiModal = () => {
    const dateForAi = formatYmdLocal(fecha);
    setAiModalVisible(true);
    setAiOutput('');
    setAiSuggestedTitle('');
    setAiCoachNotes('');
    setAiWarnings([]);
    setAiUsageLine('');
    if (!aiDateTo) setAiDateTo(dateForAi);
    if (!aiDateFrom) setAiDateFrom(addDaysToYmd(dateForAi, -28));
    if (!aiCyclePlanKeys.length && planSeleccionado) {
      setAiCyclePlanKeys([planSeleccionado]);
    }
    const presetLandmarks = String(organization?.features?.ai_volume_landmarks || '').trim();
    if (presetLandmarks) {
      setAiVolumeLandmarks((prev) => (prev.trim() ? prev : presetLandmarks));
    }
    setAiPrompt((prev) => {
      if (prev.trim()) return prev;
      if (aiMode === 'routine' || aiMode === 'cycle_plan') return '';
      return contenido || '';
    });
  };

  useEffect(() => {
    if (!aiModalVisible || !orgIdForPlans) {
      setAiMemberOptions([]);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const { data: mems, error: e1 } = await supabase
          .from('organization_memberships')
          .select('user_id, role, active')
          .eq('organization_id', orgIdForPlans)
          .eq('active', true);
        if (!alive || e1) return;
        const ids = [...new Set((mems || []).map((m) => m.user_id).filter(Boolean))];
        if (!ids.length) {
          setAiMemberOptions([]);
          return;
        }
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, full_name, username')
          .in('id', ids);
        if (!alive) return;
        const opts = (profs || [])
          .map((p) => ({
            id: p.id,
            label: (p.full_name || p.username || p.id).trim(),
          }))
          .sort((a, b) => a.label.localeCompare(b.label, 'es'));
        setAiMemberOptions(opts);
      } catch {
        if (alive) setAiMemberOptions([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [aiModalVisible, orgIdForPlans]);

  useEffect(() => {
    if (!aiModalVisible || aiMode !== 'cycle_plan' || !orgIdForPlans) {
      setAiVolumePreview('');
      setAiVolumePreviewBusy(false);
      return undefined;
    }
    const from = (aiDateFrom || '').trim();
    const to = (aiDateTo || '').trim();
    if (!from || !to) {
      setAiVolumePreview('');
      return undefined;
    }

    let alive = true;
    const timer = setTimeout(async () => {
      setAiVolumePreviewBusy(true);
      try {
        let q = supabase
          .from('training_daily_blocks')
          .select('fecha, titulo, contenido, notas, plan_key, coach_id')
          .eq('organization_id', orgIdForPlans)
          .gte('fecha', from)
          .lte('fecha', to)
          .order('fecha', { ascending: true })
          .limit(120);
        if (aiCycleScope === 'plans' && aiCyclePlanKeys.length) {
          const pk = expandPlanKeysList(aiCyclePlanKeys);
          if (pk.length === 1) q = q.eq('plan_key', pk[0]);
          else if (pk.length > 1) q = q.in('plan_key', pk);
        }
        if (isCoach && myId) q = q.eq('coach_id', myId);
        const { data, error } = await q;
        if (!alive || error) {
          if (alive) setAiVolumePreview('');
          return;
        }
        setAiVolumePreview(formatVolumePreviewShort(analyzeBlocksVolume(data || [])));
      } catch {
        if (alive) setAiVolumePreview('');
      } finally {
        if (alive) setAiVolumePreviewBusy(false);
      }
    }, 450);

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [
    aiModalVisible,
    aiMode,
    orgIdForPlans,
    aiDateFrom,
    aiDateTo,
    aiCycleScope,
    aiCyclePlanKeys,
    isCoach,
    myId,
  ]);

  const toggleAiCyclePlanKey = (planValue) => {
    setAiCyclePlanKeys((prev) => {
      const set = new Set(prev);
      if (set.has(planValue)) set.delete(planValue);
      else set.add(planValue);
      return [...set];
    });
  };

  const buildAiUsageLine = (usage) => {
    const inT = Number(usage?.input_tokens || 0);
    const outT = Number(usage?.output_tokens || 0);
    const cents = Number(usage?.cost_usd_cents || 0);
    return tStr('admin_ai_usage_line')
      .replace('{{in}}', String(inT))
      .replace('{{out}}', String(outT))
      .replace('{{usd}}', (cents / 100).toFixed(4));
  };

  const generateWithAi = async () => {
    if (!orgIdForPlans) {
      Alert.alert(tStr('gym_config_alert_title_error'), tStr('admin_ai_no_org'));
      return;
    }
    const planForAi = planSeleccionado || '';
    const slotForAi = horariosSeleccionados?.[0] || '';
    const dateForAi = formatYmdLocal(fecha);
    const promptText = String(aiPrompt || '').trim();

    if (aiMode !== 'routine' && aiMode !== 'cycle_plan' && !promptText) {
      Alert.alert(tStr('admin_ai_title'), tStr('admin_ai_prompt_required'));
      return;
    }
    if (aiMode === 'cycle_plan') {
      if (aiCycleScope === 'member' && !aiCycleMemberId) {
        Alert.alert(tStr('admin_ai_title'), tStr('admin_ai_cycle_member_required'));
        return;
      }
      if (aiCycleScope === 'plans' && !aiCyclePlanKeys.length) {
        Alert.alert(tStr('admin_ai_title'), tStr('admin_ai_cycle_plans_required'));
        return;
      }
    }

    setAiBusy(true);
    setAiOutput('');
    setAiWarnings([]);
    setAiUsageLine('');
    try {
      let out;
      if (aiMode === 'routine') {
        out = await generateRoutineDraft({
          organizationId: orgIdForPlans,
          targetClientId: null,
          sessionDate: dateForAi,
          slotLabel: slotForAi,
          planKey: planForAi,
          durationMinutes: 45,
          focus: promptText,
          extraNotes: coachNotes,
        });
      } else if (aiMode === 'rewrite') {
        out = await rewriteBlockWithAi({
          organizationId: orgIdForPlans,
          rawText: promptText,
          titleHint: titulo,
          planKey: planForAi,
          slotLabel: slotForAi,
        });
      } else if (aiMode === 'message') {
        out = await draftMessageWithAi({
          organizationId: orgIdForPlans,
          rawText: promptText,
          titleHint: titulo,
          planKey: planForAi,
          slotLabel: slotForAi,
          sessionDate: dateForAi,
          extraNotes: coachNotes,
        });
      } else if (aiMode === 'cycle_plan') {
        out = await draftCyclePlanWithAi({
          organizationId: orgIdForPlans,
          sessionDate: dateForAi,
          slotLabel: slotForAi,
          planKey: planForAi,
          planKeys: aiCycleScope === 'plans' ? aiCyclePlanKeys : null,
          cycleScope: aiCycleScope,
          targetClientId: aiCycleScope === 'member' ? aiCycleMemberId : null,
          dateFrom: (aiDateFrom || '').trim() || addDaysToYmd(dateForAi, -28),
          dateTo: (aiDateTo || '').trim() || dateForAi,
          focus: promptText,
          volumeLandmarks: aiVolumeLandmarks,
          extraNotes: coachNotes,
        });
      } else {
        out = await normalizeRmPatternWithAi({
          organizationId: orgIdForPlans,
          rawText: promptText,
          planKey: planForAi,
        });
      }

      const result = out?.result || {};
      const textOut = String(result?.result_text || '').trim();
      setAiOutput(textOut);
      setAiSuggestedTitle(String(result?.title || '').trim());
      setAiCoachNotes(String(result?.coach_notes || '').trim());
      setAiWarnings(Array.isArray(result?.warnings) ? result.warnings : []);
      setAiUsageLine(buildAiUsageLine(out?.usage || {}));
    } catch (e) {
      const msg = String(e?.message || '');
      if (msg.toLowerCase().includes('quota')) {
        Alert.alert(tStr('admin_ai_quota_title'), tStr('admin_ai_quota_body'));
      } else {
        const hint =
          /non-2xx|edge function|functions\.invoke/i.test(msg)
            ? `\n\n${tStr('admin_ai_error_edge_hint')}`
            : '';
        Alert.alert(tStr('gym_config_alert_title_error'), `${msg || tStr('admin_ai_error')}${hint}`);
      }
    } finally {
      setAiBusy(false);
    }
  };

  const applyAiResult = () => {
    if (!aiOutput.trim()) return;
    if (aiMode === 'routine') {
      if (aiSuggestedTitle) setTitulo(aiSuggestedTitle);
      setContenido(aiOutput);
      if (aiCoachNotes) {
        setCoachNotes((prev) => {
          if (!prev.trim()) return aiCoachNotes;
          if (prev.includes(aiCoachNotes)) return prev;
          return `${prev.trim()}\n\n${aiCoachNotes}`;
        });
      }
    } else if (aiMode === 'message') {
      setCoachNotes((prev) => (prev.trim() ? `${prev.trim()}\n\n${aiOutput}` : aiOutput));
    } else if (aiMode === 'cycle_plan') {
      setCoachNotes((prev) => {
        const hdr = tStr('admin_ai_cycle_applied_header');
        const block = `${hdr}\n${aiOutput.trim()}`;
        if (!prev.trim()) return block;
        if (prev.includes(hdr)) return prev;
        return `${prev.trim()}\n\n${block}`;
      });
    } else {
      setContenido(aiOutput);
    }
    setAiModalVisible(false);
  };

  const copyAiResult = async () => {
    if (!aiOutput.trim()) return;
    try {
      await Clipboard.setStringAsync(aiOutput);
      Alert.alert(tStr('gym_config_copied_title'), tStr('admin_ai_copied'));
    } catch {
      Alert.alert(tStr('gym_config_alert_title_error'), tStr('admin_ai_copy_fail'));
    }
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, backgroundColor: 'transparent' },
        scrollContainer: {
          paddingTop: Platform.OS === 'web' ? 40 : 56,
          paddingBottom: 40,
        },

        panel: {
          alignSelf: 'center',
          backgroundColor: t.boxBg,
          borderColor: t.overlayBorder,
          borderRadius: MOBILE_RADII.lg,
          borderWidth: 1,
          marginBottom: 30,
          padding: 20,
          width: panelWidth,
        },

        chromeHeader: {
          alignSelf: 'center',
          width: panelWidth,
          paddingHorizontal: 20,
          marginBottom: 8,
          backgroundColor: 'transparent',
        },
        headerRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 0,
        },
        headerTitle: {
          color: t.text,
          fontSize: MOBILE_TYPE.body,
          fontWeight: '600',
        },
        headerLogoutBtn: {
          paddingVertical: 8,
          paddingHorizontal: 14,
          borderRadius: MOBILE_RADII.sm,
          ...t.buttonPrimary,
        },
        headerLogout: {
          ...t.buttonPrimaryText,
          fontSize: MOBILE_TYPE.body,
        },

        title: {
          color: t.text,
          fontSize: MOBILE_TYPE.title,
          fontWeight: 'bold',
          marginBottom: 20,
          textAlign: 'center',
        },

        adminNavTilesFooter: {
          color: t.placeholder,
          fontSize: MOBILE_TYPE.meta,
          lineHeight: 16,
          textAlign: 'center',
          marginBottom: 12,
          marginTop: 4,
          paddingHorizontal: 8,
        },
        blockListsSectionTitle: {
          color: t.text,
          fontSize: MOBILE_TYPE.bodyStrong,
          fontWeight: '800',
          marginTop: 12,
          marginBottom: 6,
          textAlign: 'center',
        },
        blockListsSectionSub: {
          color: t.placeholder,
          fontSize: MOBILE_TYPE.caption,
          lineHeight: 18,
          marginBottom: 12,
          textAlign: 'center',
          paddingHorizontal: 8,
        },
        jumpToEditorBtn: {
          alignSelf: 'center',
          marginTop: 2,
          marginBottom: 8,
          paddingVertical: 8,
          paddingHorizontal: 14,
        },
        jumpToEditorText: { color: t.brand, fontSize: MOBILE_TYPE.body, fontWeight: '800' },
        blockEditorSectionTitle: {
          color: t.text,
          fontSize: MOBILE_TYPE.bodyStrong,
          fontWeight: '800',
          marginTop: 16,
          marginBottom: 6,
          textAlign: 'center',
        },
        blockEditorSectionSub: {
          color: t.placeholder,
          fontSize: MOBILE_TYPE.caption,
          lineHeight: 18,
          marginBottom: 14,
          textAlign: 'center',
          paddingHorizontal: 8,
        },

        fs12: { fontSize: MOBILE_TYPE.caption },
        mb8: { marginBottom: 8 },
        mt6: { marginTop: 6 },
        mt12: { marginTop: 12 },
        mt24: { marginTop: 24 },
        pr8: { paddingRight: 8 },
        flex1: { flex: 1 },
        row: { flexDirection: 'row' },
        rowCenter: { flexDirection: 'row', alignItems: 'center' },
        rowWrap: { flexDirection: 'row', flexWrap: 'wrap' },
        rowCol14: { flexDirection: 'row', columnGap: 14 },
        rowSpace: {
          alignItems: 'center',
          flexDirection: 'row',
          justifyContent: 'space-between',
        },
        tacSubtle: { textAlign: 'center', color: t.text },
        tacPlaceholder: { textAlign: 'center', color: t.placeholder },

        block: { marginBottom: 12 },
        label: {
          color: t.text,
          fontSize: MOBILE_TYPE.body,
          fontWeight: '600',
          marginBottom: 8,
        },

        input: {
          backgroundColor: t.inputBg,
          borderColor: t.overlayBorder,
          borderRadius: MOBILE_RADII.sm,
          borderWidth: 1,
          color: t.text,
          marginBottom: 12,
          padding: 12,
        },
        composerGrid: {
          flexDirection: isDesktopWeb ? 'row' : 'column',
          columnGap: isDesktopWeb ? 12 : 0,
          rowGap: 12,
          marginBottom: 8,
          width: '100%',
          alignSelf: 'stretch',
        },
        composerColMain: {
          ...(isDesktopWeb ? { flex: 1, minWidth: 0 } : { width: '100%', alignSelf: 'stretch' }),
        },
        composerColSide: {
          ...(isDesktopWeb ? { flex: 1, minWidth: 0 } : { width: '100%', alignSelf: 'stretch' }),
        },
        textarea: {
          backgroundColor: t.inputBg,
          borderColor: t.overlayBorder,
          borderRadius: MOBILE_RADII.sm,
          borderWidth: 1,
          color: t.text,
          marginBottom: 12,
          minHeight: ADMIN_TEXTAREA_MIN_HEIGHT,
          padding: 12,
          textAlignVertical: 'top',
          ...(Platform.OS === 'web' ? { width: '100%' } : null),
        },

        primaryBtn: {
          alignItems: 'center',
          justifyContent: 'center',
          ...t.buttonPrimary,
          borderRadius: MOBILE_RADII.sm,
          marginBottom: 14,
          marginTop: 4,
          minHeight: MOBILE_SIZES.controlHeight,
          paddingHorizontal: 14,
          paddingVertical: 12,
        },
        actionRow: {
          flexDirection: isDesktopWeb ? 'row' : 'column',
          columnGap: 10,
          rowGap: 10,
          alignItems: 'stretch',
          marginTop: 8,
          width: '100%',
        },
        actionBtnWide: {
          ...(isDesktopWeb ? { flex: 1, marginBottom: 0 } : { width: '100%', alignSelf: 'stretch' }),
        },
        managementGrid: {
          flexDirection: isDesktopWeb ? 'row' : 'column',
          columnGap: 12,
          rowGap: 12,
          marginTop: 8,
        },
        managementCol: {
          flex: 1,
          minWidth: 0,
        },
        sectionCard: {
          borderRadius: MOBILE_RADII.md,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          backgroundColor: t.inputBg,
          padding: 12,
        },
        sectionCardTitle: {
          color: t.text,
          fontSize: MOBILE_TYPE.headline,
          fontWeight: '800',
          marginBottom: 10,
        },
        sectionListScroll: {
          maxHeight: isDesktopWeb ? 520 : undefined,
        },
        sectionListContent: {
          paddingBottom: 4,
        },
        sectionEmptyText: {
          color: t.placeholder,
          textAlign: 'center',
          paddingVertical: 10,
        },
        primaryBtnTextOn: t.buttonPrimaryText,
        aiBtn: {
          alignItems: 'center',
          borderRadius: MOBILE_RADII.sm,
          borderWidth: 1,
          borderColor: t.brand,
          backgroundColor: hexToRgbaLocal(t.brand, 0.12),
          marginBottom: 12,
          padding: 12,
        },
        aiBtnText: { color: t.brand, fontWeight: '700' },
        aiModesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
        aiModePill: {
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.18)',
          borderRadius: MOBILE_RADII.pill,
          paddingHorizontal: 10,
          paddingVertical: 6,
          backgroundColor: BASE_TEAL,
        },
        aiModePillOn: {
          borderColor: t.brand,
          backgroundColor: hexToRgbaLocal(t.brand, 0.22),
        },
        aiModeTxt: { color: t.subText, fontSize: MOBILE_TYPE.caption, fontWeight: '700' },
        aiModeTxtOn: { color: t.brand },
        aiPromptRow: {
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 8,
          marginBottom: 12,
        },
        aiPromptInput: {
          flex: 1,
          backgroundColor: BASE_TEAL,
          borderColor: 'rgba(255,255,255,0.16)',
          borderRadius: MOBILE_RADII.sm,
          borderWidth: 1,
          color: t.text,
          padding: 12,
          minHeight: 84,
        },
        aiVoiceMicBtn: {
          width: 48,
          minHeight: MOBILE_SIZES.controlHeight,
          marginTop: 2,
          borderRadius: MOBILE_RADII.sm,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.16)',
          backgroundColor: BASE_TEAL,
          alignItems: 'center',
          justifyContent: 'center',
        },
        aiVoiceMicBtnOn: {
          borderColor: t.brand,
          backgroundColor: hexToRgbaLocal(t.brand, 0.18),
        },
        aiVoiceHint: {
          color: t.subText,
          fontSize: MOBILE_TYPE.caption,
          marginBottom: 8,
          marginTop: -8,
        },
        aiOutputBox: {
          alignSelf: 'stretch',
          backgroundColor: BASE_TEAL,
          borderColor: 'rgba(255,255,255,0.16)',
          borderWidth: 1,
          borderRadius: MOBILE_RADII.sm,
          padding: 10,
          minHeight: 100,
          marginTop: 10,
        },
        aiOutputText: { color: t.text, fontSize: MOBILE_TYPE.body, lineHeight: 20 },
        aiWarnLine: { color: t.subText, fontSize: MOBILE_TYPE.caption, marginTop: 6 },
        aiActionsRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
        aiActionBtn: {
          flex: 1,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.16)',
          borderRadius: MOBILE_RADII.sm,
          alignItems: 'center',
          paddingVertical: 10,
          backgroundColor: BASE_TEAL,
        },
        aiActionTxt: { color: t.text, fontSize: MOBILE_TYPE.body, fontWeight: '700' },

        financeBtn: {
          alignSelf: 'flex-end',
          ...t.buttonPrimary,
          borderRadius: MOBILE_RADII.compact,
          marginBottom: 10,
          paddingHorizontal: 12,
          paddingVertical: 8,
        },
        financeBtnText: t.buttonPrimaryText,

        group: {
          marginBottom: 14,
        },
        groupTitle: {
          color: t.subText,
          fontSize: MOBILE_TYPE.micro,
          fontWeight: '700',
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          marginBottom: 6,
          marginLeft: 4,
        },
        menuGrid: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          columnGap: menuGap,
          rowGap: menuGap,
          // `space-between` con 2 columnas en Android a veces deja una franja vertical más oscura (hueco + fondo del panel).
          justifyContent: 'flex-start',
          marginBottom: 6,
          marginTop: 2,
        },
        menuTile: {
          width: menuTileWidth,
          minHeight: 88,
          padding: 10,
          borderRadius: MOBILE_RADII.md,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          backgroundColor: t.inputBg,
        },
        menuTileIconWrap: {
          width: 36,
          height: 36,
          borderRadius: MOBILE_RADII.sm,
          backgroundColor: hexToRgbaLocal(t.brand, 0.14),
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 6,
        },
        menuTileTitle: {
          color: t.text,
          fontSize: MOBILE_TYPE.body,
          fontWeight: '700',
        },
        menuTileSub: {
          color: t.subText,
          fontSize: MOBILE_TYPE.micro,
          marginTop: 2,
          lineHeight: 14,
        },

        dropdown: {
          alignItems: 'center',
          backgroundColor: t.inputBg,
          borderColor: t.overlayBorder,
          borderRadius: MOBILE_RADII.sm,
          borderWidth: 1,
          flexDirection: 'row',
          justifyContent: 'space-between',
          padding: 12,
        },
        dropdownValue: { color: t.text },

        dropdownBackdrop: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: 'rgba(0,0,0,0.62)',
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 18,
          paddingVertical: 24,
          zIndex: 50,
        },
        /** Modal de horarios: fuera del ScrollView padre para que el scroll no se trabe */
        modalHourPickerRoot: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 18,
        },
        modalHourPickerBackdrop: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: 'rgba(0,0,0,0.62)',
        },
        dropdownListModal: {
          backgroundColor: t.boxBg,
          borderColor: t.overlayBorder,
          borderRadius: MOBILE_RADII.lg,
          borderWidth: 1,
          width: Math.min(windowWidth * 0.92, 420),
          maxHeight: Math.min(Dimensions.get('window').height * 0.72, 460),
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOpacity: 0.35,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 6 },
          elevation: 24,
        },
        dropdownList: {
          backgroundColor: t.boxBg,
          borderColor: t.overlayBorder,
          borderRadius: MOBILE_RADII.lg,
          borderWidth: 1,
          width: '90%',
          height: 400,
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOpacity: 0.35,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 6 },
          elevation: 22,
        },
        dropdownListHeader: {
          paddingVertical: 12,
          paddingHorizontal: MOBILE_SPACING.lg,
          borderBottomWidth: 1,
          borderBottomColor: t.overlayBorder,
          backgroundColor: hexToRgbaLocal(t.brand, 0.1),
        },
        dropdownListHeaderText: {
          color: t.brand,
          fontSize: MOBILE_TYPE.bodyStrong,
          fontWeight: '700',
        },

        dropdownScroll: { maxHeight: 220 },
        dropdownHoursScroll: {
          maxHeight: Math.min(Dimensions.get('window').height * 0.44, 340),
        },
        dropdownHoursScrollContent: {
          paddingBottom: 16,
        },
        dropdownItem: {
          alignItems: 'center',
          borderBottomColor: hexToRgbaLocal('#ffffff', 0.1),
          borderBottomWidth: 1,
          flexDirection: 'row',
          justifyContent: 'space-between',
          padding: 14,
        },
        dropdownItemSelected: {
          backgroundColor: hexToRgbaLocal(t.brand, 0.22),
        },
        dropdownItemText: { color: t.text, fontSize: MOBILE_TYPE.subhead },

        dropdownActions: {
          paddingHorizontal: 12,
          paddingVertical: 10,
          alignItems: 'flex-end',
          backgroundColor: t.inputBg,
        },
        dropdownDoneBtn: {
          paddingHorizontal: MOBILE_SPACING.lg,
          paddingVertical: 8,
          borderRadius: MOBILE_RADII.pill,
          ...t.buttonPrimary,
        },
        dropdownDoneText: {
          fontSize: MOBILE_TYPE.body,
          fontWeight: '600',
          ...t.buttonPrimaryText,
        },

        previewWrap: {
          backgroundColor: hexToRgbaLocal(t.brand, 0.14),
          borderRadius: MOBILE_RADII.compact,
          marginTop: 10,
          marginBottom: 4,
          padding: 10,
          alignSelf: 'stretch',
        },
        previewTitle: { color: t.text, fontWeight: '600' },
        /** Misma base tipográfica que el texto: evita desalineación %RM con el resto. */
        previewRowBase: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'baseline',
        },
        previewText: { color: t.text, ...RM_PREVIEW_BASE() },
        rmText: {
          ...RM_PREVIEW_BASE(),
          backgroundColor: hexToRgbaLocal(RM_HIGHLIGHT_COLOR, 0.14),
          borderRadius: MOBILE_RADII.xxs,
          color: RM_HIGHLIGHT_COLOR,
          fontWeight: '700',
          paddingHorizontal: 2,
        },

        bloqueCard: {
          backgroundColor: t.inputBg,
          borderColor: t.overlayBorder,
          borderRadius: MOBILE_RADII.sm,
          borderWidth: 1,
          marginBottom: 14,
          padding: 12,
        },
        bloqueTitle: { color: t.text, fontWeight: 'bold' },
        bloqueMeta: { color: t.text, fontSize: MOBILE_TYPE.caption, opacity: 0.85 },
        bloqueCoach: { color: t.text, fontSize: MOBILE_TYPE.meta, opacity: 0.75 },

        iconButton: { alignItems: 'center' },
        iconText: { color: t.text, fontSize: MOBILE_TYPE.caption, marginTop: 2 },

        noteBox: {
          marginTop: 6,
          padding: 8,
          backgroundColor: hexToRgbaLocal(t.brand, 0.14),
          borderRadius: MOBILE_RADII.compact,
          borderWidth: 1,
          borderColor: t.overlayBorder,
        },
        noteTitle: { color: t.text, fontWeight: '600' },
        noteText: { color: t.text },

        videoThumbRow: {
          marginTop: 8,
        },
        videoThumb: {
          alignItems: 'center',
          borderColor: t.overlayBorder,
          borderRadius: MOBILE_RADII.sm,
          borderWidth: 1,
          marginRight: 8,
          overflow: 'hidden',
          width: 88,
        },
        videoImage: {
          height: 50,
          width: '100%',
        },
        videoLabel: {
          color: t.text,
          fontSize: MOBILE_TYPE.micro,
          paddingHorizontal: 4,
          paddingVertical: 3,
        },

        chatContainer: {
          backgroundColor: t.inputBg,
          borderColor: t.overlayBorder,
          borderRadius: MOBILE_RADII.sm,
          borderWidth: 1,
          marginTop: 6,
          padding: 10,
        },
        chatScroll: { maxHeight: 260 },
        chatMessage: {
          borderBottomColor: hexToRgbaLocal(t.brand, 0.12),
          borderBottomWidth: 1,
          paddingVertical: 8,
        },
        messageUser: {
          color: t.text,
          fontSize: MOBILE_TYPE.caption,
          fontWeight: 'bold',
          marginBottom: 4,
        },
        messageText: { color: t.text, fontSize: MOBILE_TYPE.body },
        messageTime: {
          color: t.text,
          fontSize: MOBILE_TYPE.micro,
          marginTop: 4,
          textAlign: 'right',
          opacity: 0.8,
        },
        emptyChatContainer: { alignItems: 'center', padding: 20 },
        emptyChatText: { color: t.placeholder, fontStyle: 'italic' },

        sendButton: {
          backgroundColor: hexToRgbaLocal(t.brand, 0.08),
          borderColor: t.brand,
          borderRadius: MOBILE_RADII.sm,
          borderWidth: 1,
          marginLeft: 8,
          padding: 10,
        },

        togglesRow: {
          flexDirection: 'row',
          gap: 10,
          justifyContent: 'center',
          marginBottom: 8,
        },
        togglePill: {
          backgroundColor: hexToRgbaLocal(t.brand, 0.06),
          borderColor: t.brand,
          borderRadius: MOBILE_RADII.xl,
          borderWidth: 1,
          paddingHorizontal: MOBILE_SPACING.lg,
          paddingVertical: 8,
        },
        togglePillActive: { backgroundColor: t.brand },
        toggleText: { color: t.text, fontWeight: '600' },

        /* Siempre velo oscuro: con t.text claro (tema oscuro) hexToRgbaLocal(t.text,0.7) volvía todo blanco. */
        modalOverlay: {
          alignItems: 'center',
          backgroundColor: 'rgba(0,0,0,0.58)',
          flex: 1,
          justifyContent: 'center',
        },
        modalContent: {
          backgroundColor: t.boxBg,
          borderColor: t.overlayBorder,
          borderRadius: MOBILE_RADII.sheet,
          borderWidth: 1,
          padding: 20,
        },
        /** Solo modal “mover bloque”; el modal IA usa ScrollView externo sin tope rígido en la tarjeta. */
        modalContentMoveMax: {
          maxHeight: '90%',
        },
        /** Panel IA: fondo opaco (t.boxBg suele ser translúcido y se “mezcla” con el gym de fondo). */
        modalContentAi: {
          width: '92%',
          maxWidth: 440,
          alignSelf: 'center',
          backgroundColor: BASE_TEAL_SOFT,
          borderColor: 'rgba(255,255,255,0.14)',
          elevation: 14,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.45,
          shadowRadius: 16,
        },
        aiModalLayer: {
          ...StyleSheet.absoluteFillObject,
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 10,
        },
        aiModalScroll: {
          maxHeight: Dimensions.get('window').height * 0.88,
          width: '100%',
        },
        /* Sin flexGrow/center: si no, el contenido largo no scrollea y “se traba” el modal IA. */
        aiModalScrollContent: {
          alignItems: 'center',
          paddingTop: 12,
          paddingBottom: 32,
        },
        aiModesTitle: {
          alignSelf: 'stretch',
          color: t.subText,
          fontSize: MOBILE_TYPE.caption,
          fontWeight: '700',
          marginBottom: 6,
        },
        aiModeHintLine: {
          alignSelf: 'stretch',
          color: t.text,
          fontSize: MOBILE_TYPE.caption,
          lineHeight: 17,
          marginBottom: 10,
          opacity: 0.95,
        },
        aiCycleLabel: {
          alignSelf: 'stretch',
          color: t.subText,
          fontSize: MOBILE_TYPE.caption,
          fontWeight: '700',
          marginBottom: 6,
          marginTop: 4,
        },
        aiDateRow: {
          alignSelf: 'stretch',
          flexDirection: 'row',
          gap: 8,
          marginBottom: 10,
        },
        aiDateInput: {
          flex: 1,
          backgroundColor: BASE_TEAL,
          borderColor: 'rgba(255,255,255,0.16)',
          borderRadius: MOBILE_RADII.sm,
          borderWidth: 1,
          color: t.text,
          padding: 10,
          fontSize: MOBILE_TYPE.caption,
        },
        aiVolumeInput: {
          alignSelf: 'stretch',
          backgroundColor: BASE_TEAL,
          borderColor: 'rgba(255,255,255,0.16)',
          borderRadius: MOBILE_RADII.sm,
          borderWidth: 1,
          color: t.text,
          padding: 12,
          minHeight: 72,
          marginBottom: 12,
          fontSize: MOBILE_TYPE.caption,
        },
        aiVolumePreviewRow: {
          alignSelf: 'stretch',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          marginBottom: 10,
        },
        aiVolumePreviewText: {
          alignSelf: 'stretch',
          color: t.subText,
          fontSize: MOBILE_TYPE.caption,
          lineHeight: 17,
          marginBottom: 10,
        },
        modalTitle: {
          color: t.text,
          fontSize: MOBILE_TYPE.headline,
          fontWeight: 'bold',
          textAlign: 'center',
        },
        aiModalHeaderRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 4,
        },
        aiModalHeaderSpacer: {
          width: 36,
          height: 36,
        },
        aiModalCloseBtn: {
          width: 36,
          height: 36,
          borderRadius: MOBILE_RADII.controlCircle,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.16)',
          backgroundColor: BASE_TEAL,
          alignItems: 'center',
          justifyContent: 'center',
        },
        modalItem: {
          alignItems: 'center',
          borderBottomColor: hexToRgbaLocal(t.brand, 0.12),
          borderBottomWidth: 1,
          flexDirection: 'row',
          justifyContent: 'space-between',
          padding: 16,
        },
        modalItemSelected: { backgroundColor: hexToRgbaLocal(t.brand, 0.12) },

        dateRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        },
        dateCenter: {
          flex: 1,
          marginHorizontal: 8,
        },

      }),
    [t, panelWidth, menuColumns, menuGap, menuTileWidth, windowWidth, isDesktopWeb, STAFF_WEB_RAIL],
  );

  const updateBloquesArray = async (modifier) => {
    const arr = Array.isArray(bloques) ? [...bloques] : [];
    const updated = modifier(arr);
    await saveBloques(updated);
  };

  const crearBloques = async () => {
    Keyboard.dismiss();
    if (!titulo.trim() || !contenido.trim()) {
      Alert.alert(tStr('admin_alert_block_missing_title'), tStr('admin_alert_block_missing_body'));
      return;
    }

    if (!editingBlockId && plansDisponibles.length === 0) {
      Alert.alert(tStr('admin_nav_plans'), tStr('admin_sin_planes_bloques'));
      return;
    }

    const parsedCapacity = (() => {
      const n = parseInt(String(capacityInput || '').trim(), 10);
      return Number.isFinite(n) && n > 0 ? n : null;
    })();

    if (editingBlockId) {
      await updateBloquesArray((arr) =>
        arr.map((b) =>
          b.id === editingBlockId
            ? {
                ...b,
                titulo: titulo.trim(),
                contenido: contenido.trim(),
                capacity: parsedCapacity,
                notas: coachNotes.trim(),
                videoLinks: videoLinks
                  .split('\n')
                  .map((s) => s.trim())
                  .filter(Boolean),
                rmTags: extractRmTags(contenido),
              }
            : b,
        ),
      );
      Alert.alert(tStr('admin_alert_updated_title'), tStr('admin_alert_updated_block'));
      setEditingBlockId(null);
      setCoachNotes('');
      setVideoLinks('');
      setContenido('');
      setCapacityInput('');
      setTitulo('');
      setHorariosSeleccionados([]);
      return;
    }

    if (!horariosSeleccionados.length) {
      Alert.alert(tStr('admin_horarios'), tStr('admin_alert_horarios'));
      return;
    }
    const fk = fechaKeyFrom(fecha);
    const nuevos = horariosSeleccionados.map((h) => {
      const [hh, mm] = h.split(':');
      const d = new Date(fecha);
      d.setHours(parseInt(hh, 10), parseInt(mm, 10), 0, 0);
      return {
        coachId: myId || undefined,
        id: `b_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        organization_id: orgIdForPlans || undefined,

        plan: planSeleccionado,
        fecha: d.toISOString(),
        fechaKey: fk,
        hora: h,
        titulo: titulo.trim(),
        contenido: contenido.trim(),
        capacity: parsedCapacity,
        notas: coachNotes.trim(),
        videoLinks: videoLinks
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        rmTags: extractRmTags(contenido),
      };
    });
    await updateBloquesArray((arr) => [...arr, ...nuevos]);
    Alert.alert(tStr('admin_listo'), tStr('admin_creados_ok').replace('%d', String(nuevos.length)));
    setTitulo('');
    setContenido('');
    setCapacityInput('');
    setCoachNotes('');
    setVideoLinks('');
    // NO limpiamos horariosSeleccionados acá para poder seguir creando bloques en el mismo/los mismos horarios
  };

  const guardiaPropietario = (b, accion = 'editar') => {
    if (isSA) return true;
    if (!isPartitioned) return true;
    if ((b.coachId || null) === myId) return true;
    Alert.alert(
      tStr('admin_not_authorized_title'),
      tStr('admin_not_authorized_body').replace('{{action}}', tStr(`admin_action_${accion}`) || accion),
    );
    return false;
  };

  const copiarBloque = (b) => {
    if (guardiaPropietario(b, 'copiar')) {
      setClipboardBloque(b);
      Alert.alert(tStr('admin_copied_title'), tStr('admin_copied_body'));
    }
  };

  const pegarEnHorarios = async () => {
    if (!clipboardBloque) {
      Alert.alert(tStr('admin_nothing_to_paste_title'), tStr('admin_nothing_to_paste_body'));
      return;
    }
    if (!horariosSeleccionados.length) {
      Alert.alert(tStr('admin_horarios'), tStr('admin_alert_horarios_destino'));
      return;
    }
    const fk = fechaKeyFrom(fecha);
    const clones = horariosSeleccionados.map((h) => {
      const [hh, mm] = h.split(':');
      const d = new Date(fecha);
      d.setHours(parseInt(hh, 10), parseInt(mm, 10), 0, 0);
      return {
        ...clipboardBloque,
        id: `b_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        organization_id: orgIdForPlans || clipboardBloque.organization_id,
        plan: planSeleccionado,
        fecha: d.toISOString(),
        fechaKey: fk,
        hora: h,
        coachId: myId || clipboardBloque.coachId,
      };
    });
    await updateBloquesArray((arr) => [...arr, ...clones]);
    Alert.alert(
      tStr('admin_pasted_title'),
      tStr('admin_pasted_body').replace('{{count}}', String(clones.length)),
    );
  };

  const empezarEdicion = (b) => {
    if (!guardiaPropietario(b, 'editar')) return;
    setEditingBlockId(b.id);
    setPlanSeleccionado(b.plan || planSeleccionado);
    setFecha(new Date(b.fecha));
    setHorariosSeleccionados([b.hora]);
    setTitulo(b.titulo || '');
    setContenido(b.contenido || '');
    setCapacityInput(b.capacity != null ? String(b.capacity) : '');
    setCoachNotes(b.notas || '');
    setVideoLinks((b.videoLinks || []).join('\n'));
  };

  const pedirMover = (b) => {
    if (!guardiaPropietario(b, 'mover')) return;
    setBloqueParaMover(b);
    setMoveTargetDate(null);
    setMoveTargetHora(null);
    setMoveModalVisible(true);
  };

  const confirmarMover = async () => {
    if (!bloqueParaMover || !moveTargetHora) return;
    const base = moveTargetDate
      ? new Date(moveTargetDate)
      : new Date(bloqueParaMover.fecha);
    const [hh, mm] = moveTargetHora.split(':');
    base.setHours(parseInt(hh, 10), parseInt(mm, 10), 0, 0);
    const iso = base.toISOString();
    const fk = formatYmdLocal(base);
    await updateBloquesArray((arr) =>
      arr.map((x) =>
        x.id === bloqueParaMover.id
          ? { ...x, hora: moveTargetHora, fecha: iso, fechaKey: fk }
          : x,
      ),
    );
    setMoveModalVisible(false);
  };


  const BloqueCard = ({ b }) => (
    <View key={b.id} style={styles.bloqueCard}>
      <View style={styles.rowSpace}>
        <View style={[styles.flex1, styles.pr8]}>
          <Text style={styles.bloqueTitle}>{b.titulo || tStr('admin_sin_titulo')}</Text>
          <Text style={styles.bloqueMeta}>
            {new Date(b.fecha).toLocaleDateString(dateLocale)} — {b.hora}
          </Text>
          {b.capacity ? (
            <Text style={styles.bloqueMeta}>{tStr('admin_capacity_meta').replace('{{n}}', String(b.capacity))}</Text>
          ) : null}
          {!!b.coachId && (
            <Text style={styles.bloqueCoach}>
              {tStr('admin_coach')}{' '}
              {b.coachDisplayName ||
                (b.coachId === myId ? profile?.full_name || profile?.username || '' : '') ||
                tStr('admin_coach_fallback')}
            </Text>
          )}
        </View>
        <View style={styles.rowCol14}>
          <TouchableOpacity
            onPress={() => empezarEdicion(b)}
            style={styles.iconButton}
          >
            <Ionicons name="create-outline" size={20} color={t.brand} />
            <Text style={styles.iconText}>{tStr('admin_editar')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => copiarBloque(b)} style={styles.iconButton}>
            <Ionicons name="copy-outline" size={20} color={t.brand} />
            <Text style={styles.iconText}>{tStr('admin_copiar')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => pedirMover(b)} style={styles.iconButton}>
            <Ionicons name="swap-vertical-outline" size={20} color={t.brand} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              if (!guardiaPropietario(b, 'eliminar')) return;
              Alert.alert(tStr('admin_eliminar'), tStr('admin_eliminar_confirm'), [
                { text: tStr('common_cancel'), style: 'cancel' },
                {
                  text: tStr('admin_eliminar'),
                  style: 'destructive',
                  onPress: async () => {
                    await updateBloquesArray((arr) =>
                      arr.filter((x) => x.id !== b.id),
                    );
                  },
                },
              ]);
            }}
            style={styles.iconButton}
          >
            <Ionicons name="trash-outline" size={20} color={t.danger} />
          </TouchableOpacity>
        </View>
      </View>

      {!!b.contenido && (
        <View style={styles.mt6}>{renderPreviewWithRM(b.contenido, styles)}</View>
      )}
      {!!b.notas && (
        <View style={styles.noteBox}>
          <Text style={styles.noteTitle}>{tStr('admin_notas_coach_label')}</Text>
          <Text style={styles.noteText}>{b.notas}</Text>
        </View>
      )}
      {Array.isArray(b.videoLinks) && b.videoLinks.length > 0 ? (
        <VideoLinksThumbs links={b.videoLinks} themeStyles={styles} placeholderColor={t.placeholder} />
      ) : null}
    </View>
  );

  return (
    <BackgroundWrapper screen="admin">
      <FormKeyboardAvoidingView
        testID="admin-dashboard-root"
        style={[
          styles.screen,
          Platform.OS !== 'web'
            ? { paddingTop: screenHeaderTopPadding(insets.top), paddingBottom: insets.bottom }
            : null,
        ]}
      >
        <ScrollView
              ref={scrollViewRef}
              contentContainerStyle={styles.scrollContainer}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === 'web' ? 'none' : 'on-drag'}
            >
              <View style={styles.chromeHeader}>
                <View style={styles.headerRow}>
                  <Text style={styles.headerTitle}>{tStr('admin_panel')}</Text>
                  {!isStaffWebDesktop ? (
                    <TouchableOpacity style={styles.headerLogoutBtn} onPress={handleLogout}>
                      <Text style={styles.headerLogout}>{tStr('admin_salir')}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
              <NeoPanel style={styles.panel}>
                <Text style={styles.title} testID="admin-main-title">
                  {tStr('admin_title')}
                </Text>

                {!isStaffWebDesktop ? (
                  <>
                    {adminNavGroups.map((group) => (
                      <View key={group.key} style={styles.group}>
                        <Text style={styles.groupTitle}>{group.title}</Text>
                        <View style={styles.menuGrid}>
                          {group.tiles.map((tile) => (
                            <TouchableOpacity
                              key={tile.key}
                              testID={`staff-hub-tile-${tile.key}`}
                              style={styles.menuTile}
                              onPress={tile.onPress}
                              activeOpacity={0.88}
                            >
                              <View style={styles.menuTileIconWrap}>
                                <Ionicons name={tile.ion} size={20} color={t.brand} />
                              </View>
                              <Text style={styles.menuTileTitle}>{tile.title}</Text>
                              <Text style={styles.menuTileSub} numberOfLines={2}>
                                {tile.sub}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    ))}
                  </>
                ) : null}

                {!isStaffWebDesktop ? (
                  <Text style={styles.adminNavTilesFooter}>{tStr('admin_nav_tiles_footer')}</Text>
                ) : null}

                <View
                  onLayout={(e) => {
                    listsSectionY.current = e.nativeEvent.layout.y;
                    if (pendingScrollRef.current === 'lists') runPendingScroll();
                  }}
                >
                  <Text style={styles.blockListsSectionTitle}>{tStr('admin_lists_section_title')}</Text>
                  <Text style={styles.blockListsSectionSub}>{tStr('admin_lists_section_sub')}</Text>

                  <View style={styles.managementGrid}>
                    <View style={styles.managementCol}>
                      <View style={styles.sectionCard}>
                        <Text style={styles.sectionCardTitle}>{tStr('admin_ultimos_dias')}</Text>
                        {lastWeekBlocks.length === 0 ? (
                          <Text style={styles.sectionEmptyText}>{tStr('admin_sin_bloques')}</Text>
                        ) : (
                          <ScrollView
                            style={styles.sectionListScroll}
                            contentContainerStyle={styles.sectionListContent}
                            nestedScrollEnabled
                            showsVerticalScrollIndicator={isDesktopWeb}
                          >
                            {lastWeekBlocks.map((b) => (
                              <BloqueCard key={b.id} b={b} />
                            ))}
                          </ScrollView>
                        )}
                      </View>
                    </View>

                    <View style={styles.managementCol}>
                      <View style={styles.sectionCard}>
                        <Text style={styles.sectionCardTitle}>{tStr('admin_historico')}</Text>
                        {historicBlocks.length === 0 ? (
                          <Text style={styles.sectionEmptyText}>{tStr('admin_sin_historico')}</Text>
                        ) : (
                          <ScrollView
                            style={styles.sectionListScroll}
                            contentContainerStyle={styles.sectionListContent}
                            nestedScrollEnabled
                            showsVerticalScrollIndicator={isDesktopWeb}
                          >
                            {historicBlocks.map((b) => (
                              <BloqueCard key={b.id} b={b} />
                            ))}
                          </ScrollView>
                        )}
                      </View>
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={() => emitAdminScrollToEditor()}
                    style={styles.jumpToEditorBtn}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.jumpToEditorText}>{tStr('admin_jump_to_publish_form')}</Text>
                  </TouchableOpacity>
                </View>

                <View
                  onLayout={(e) => {
                    editorSectionY.current = e.nativeEvent.layout.y;
                    if (pendingScrollRef.current === 'editor') runPendingScroll();
                  }}
                >
                  <Text style={styles.blockEditorSectionTitle}>{tStr('admin_editor_section_title')}</Text>
                  <Text style={styles.blockEditorSectionSub}>{tStr('admin_editor_section_sub')}</Text>
                </View>

            {isCoach && !coachPlanActual ? (
              <View style={styles.block}>
                <Text style={styles.label}>{tStr('admin_plan')}</Text>
                <Text style={[styles.fs12, styles.tacSubtle, { color: t.placeholder, marginTop: 4 }]}>
                  {tStr('admin_sin_plan')}
                </Text>
              </View>
            ) : plansDisponibles.length === 0 && orgIdForPlans ? (
              <View style={styles.block}>
                <Text style={{ color: t.subText, fontSize: MOBILE_TYPE.body, textAlign: 'center', lineHeight: 20 }}>
                  {tStr('admin_sin_planes_bloques')}
                </Text>
              </View>
            ) : (
              <CustomDropdown
                label={tStr('admin_plan')}
                value={planSeleccionado}
                onSelect={setPlanSeleccionado}
                items={plansDisponibles.map(({ label, value }) => ({ label, value }))}
                styles={styles}
                t={t}
              />
            )}
            <Text style={[styles.fs12, styles.mb8, styles.tacSubtle]}>
              {tStr('admin_politica')}{' '}
              {isPartitioned
                ? tStr('admin_politica_partitioned')
                : tStr('admin_politica_shared')}
            </Text>

            <Text style={styles.label}>{tStr('admin_fecha')}</Text>
            <View style={styles.dateRow}>
              <TouchableOpacity
                onPress={() => setFecha((prev) => sumarDias(prev, -1))}
                style={styles.iconButton}
              >
                <Ionicons name="chevron-back" size={20} color={t.brand} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.dropdown, styles.dateCenter]}
                onPress={() => setShowDatePicker(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.dropdownValue}>
                  {new Date(fecha).toLocaleDateString(dateLocale)}
                </Text>
                <Ionicons name="calendar-outline" size={18} color={t.brand} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setFecha((prev) => sumarDias(prev, 1))}
                style={styles.iconButton}
              >
                <Ionicons name="chevron-forward" size={20} color={t.brand} />
              </TouchableOpacity>
            </View>

            {showDatePicker && (
              <DateTimePicker
                value={fecha instanceof Date ? fecha : new Date(fecha)}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, selectedDate) => {
                  if (Platform.OS === 'android') setShowDatePicker(false);
                  if (selectedDate) setFecha(selectedDate);
                }}
              />
            )}
            {showDatePicker && Platform.OS === 'ios' && (
              <TouchableOpacity
                onPress={() => setShowDatePicker(false)}
                style={[styles.dropdownDoneBtn, { marginTop: 8, alignSelf: 'flex-end' }]}
              >
                <Text style={styles.dropdownDoneText}>{tStr('admin_listo')}</Text>
              </TouchableOpacity>
            )}

            <MultiHorarioDropdown
              horariosSeleccionados={horariosSeleccionados}
              onHorariosChange={setHorariosSeleccionados}
              styles={styles}
              t={t}
              tStr={tStr}
            />

            <Text style={styles.label}>{tStr('admin_capacity_label')}</Text>
            <TextInput
              value={capacityInput}
              onChangeText={setCapacityInput}
              placeholder={tStr('admin_capacity_placeholder')}
              placeholderTextColor={t.placeholder}
              style={styles.input}
              keyboardType="number-pad"
            />

            <Text style={styles.label}>{tStr('admin_titulo')}</Text>
            <TextInput
              value={titulo}
              onChangeText={setTitulo}
              placeholder={tStr('admin_placeholder_titulo')}
              placeholderTextColor={t.placeholder}
              style={styles.input}
            />

            <Text style={styles.label}>{tStr('admin_contenido')}</Text>
            <View style={styles.composerGrid}>
              <View style={styles.composerColMain}>
                <TextInput
                  value={contenido}
                  onChangeText={setContenido}
                  placeholder={tStr('admin_placeholder_contenido')}
                  placeholderTextColor={t.placeholder}
                  style={styles.textarea}
                  multiline
                />

                <View style={styles.previewWrap}>
                  <Text style={styles.previewTitle}>{tStr('admin_preview_rm')}</Text>
                  {renderPreviewWithRM(contenido, styles)}
                </View>
              </View>

              <View style={styles.composerColSide}>
                <Text style={styles.label}>{tStr('admin_notas_coach')}</Text>
                <TextInput
                  value={coachNotes}
                  onChangeText={setCoachNotes}
                  placeholder={tStr('admin_placeholder_notas')}
                  placeholderTextColor={t.placeholder}
                  style={styles.textarea}
                  multiline
                />

                <Text style={styles.label}>{tStr('admin_links_video')}</Text>
                <TextInput
                  value={videoLinks}
                  onChangeText={setVideoLinks}
                  placeholder={tStr('admin_placeholder_links')}
                  placeholderTextColor={t.placeholder}
                  style={styles.textarea}
                  multiline
                />
                {videoLinks.trim() ? (
                  <VideoLinksThumbs
                    links={videoLinks.split('\n').map((s) => s.trim()).filter(Boolean)}
                    themeStyles={styles}
                    placeholderColor={t.placeholder}
                  />
                ) : null}
                <TouchableOpacity onPress={openAiModal} style={styles.aiBtn} activeOpacity={0.88}>
                  <Text style={styles.aiBtnText}>{tStr('admin_ai_cta')}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity onPress={crearBloques} style={[styles.primaryBtn, styles.actionBtnWide]}>
                <Text style={styles.primaryBtnTextOn}>
                  {isEditing ? tStr('admin_actualizar_bloque') : tStr('admin_crear_bloques')}
                </Text>
              </TouchableOpacity>

              {clipboardBloque && !isEditing && (
                <TouchableOpacity
                  onPress={pegarEnHorarios}
                  style={[styles.primaryBtn, styles.actionBtnWide]}
                >
                  <Text style={styles.primaryBtnTextOn}>
                    {tStr('admin_pegar_horarios')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={[styles.sectionCard, styles.mt24]}>
              <Text style={styles.sectionCardTitle}>{tStr('admin_chat_plan')}</Text>
              <TouchableOpacity
                onPress={irAlChatDelPlan}
                style={[styles.primaryBtn, { marginTop: 4, marginBottom: 0 }]}
              >
                <Text style={styles.primaryBtnTextOn}>
                  {tStr('admin_ir_chat')} — {plansDisponibles.find((p) => p.value === planSeleccionado)?.label || planSeleccionado}
                </Text>
              </TouchableOpacity>
            </View>
              </NeoPanel>
            </ScrollView>
      </FormKeyboardAvoidingView>

      <Modal visible={aiModalVisible} transparent animationType="fade" onRequestClose={() => setAiModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setAiModalVisible(false)}
            accessibilityRole="button"
            accessibilityLabel={tStr('admin_ai_close_backdrop')}
          />
          <View style={styles.aiModalLayer} pointerEvents="box-none">
            <ScrollView
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              style={styles.aiModalScroll}
              contentContainerStyle={styles.aiModalScrollContent}
              showsVerticalScrollIndicator={true}
            >
              <View style={[styles.modalContent, styles.modalContentAi]}>
                <View style={styles.aiModalHeaderRow}>
                  <View style={styles.aiModalHeaderSpacer} />
                  <Text style={styles.modalTitle}>{tStr('admin_ai_title')}</Text>
                  <TouchableOpacity
                    onPress={() => setAiModalVisible(false)}
                    style={styles.aiModalCloseBtn}
                    accessibilityRole="button"
                    accessibilityLabel={tStr('admin_ai_close_backdrop')}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="close" size={20} color={t.text} />
                  </TouchableOpacity>
                </View>
                <Text
                  style={[
                    styles.fs12,
                    styles.tacSubtle,
                    { marginTop: 6, marginBottom: 10, color: t.subText },
                  ]}
                >
                  {tStr('admin_ai_hint')}
                </Text>

                <Text style={styles.aiModesTitle}>{tStr('admin_ai_modes_title')}</Text>
                <View style={styles.aiModesRow}>
                  {[
                    ['routine', tStr('admin_ai_mode_routine')],
                    ['cycle_plan', tStr('admin_ai_mode_cycle')],
                    ['rewrite', tStr('admin_ai_mode_rewrite')],
                    ['rm_format', tStr('admin_ai_mode_rm')],
                    ['message', tStr('admin_ai_mode_message')],
                  ].map(([id, lbl]) => {
                    const on = aiMode === id;
                    return (
                      <TouchableOpacity
                        key={id}
                        style={[styles.aiModePill, on && styles.aiModePillOn]}
                        onPress={() => setAiMode(id)}
                        activeOpacity={0.85}
                      >
                        <Text style={[styles.aiModeTxt, on && styles.aiModeTxtOn]}>{lbl}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={styles.aiModeHintLine}>{tStr(`admin_ai_mode_hint_${aiMode}`)}</Text>

                {aiMode === 'cycle_plan' ? (
                  <>
                    <Text style={styles.aiCycleLabel}>{tStr('admin_ai_cycle_scope_title')}</Text>
                    <View style={styles.aiModesRow}>
                      {[
                        ['all', tStr('admin_ai_cycle_scope_all')],
                        ['plans', tStr('admin_ai_cycle_scope_plans')],
                        ['member', tStr('admin_ai_cycle_scope_member')],
                      ].map(([id, lbl]) => {
                        const on = aiCycleScope === id;
                        return (
                          <TouchableOpacity
                            key={id}
                            style={[styles.aiModePill, on && styles.aiModePillOn]}
                            onPress={() => setAiCycleScope(id)}
                            activeOpacity={0.85}
                          >
                            <Text style={[styles.aiModeTxt, on && styles.aiModeTxtOn]}>{lbl}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    <View style={styles.aiDateRow}>
                      <TextInput
                        style={styles.aiDateInput}
                        value={aiDateFrom}
                        onChangeText={setAiDateFrom}
                        placeholder={tStr('admin_ai_cycle_date_from_ph')}
                        placeholderTextColor={t.placeholder}
                        autoCapitalize="none"
                      />
                      <TextInput
                        style={styles.aiDateInput}
                        value={aiDateTo}
                        onChangeText={setAiDateTo}
                        placeholder={tStr('admin_ai_cycle_date_to_ph')}
                        placeholderTextColor={t.placeholder}
                        autoCapitalize="none"
                      />
                    </View>
                    {aiVolumePreviewBusy ? (
                      <View style={styles.aiVolumePreviewRow}>
                        <ActivityIndicator size="small" color={t.brand} />
                        <Text style={styles.aiVolumePreviewText}>{tStr('admin_ai_cycle_volume_parsing')}</Text>
                      </View>
                    ) : aiVolumePreview ? (
                      <Text style={styles.aiVolumePreviewText}>{aiVolumePreview}</Text>
                    ) : null}
                    {aiCycleScope === 'plans' ? (
                      <>
                        <Text style={styles.aiCycleLabel}>{tStr('admin_ai_cycle_plans_hint')}</Text>
                        <View style={styles.aiModesRow}>
                          {plansDisponibles.map((p) => {
                            const on = aiCyclePlanKeys.includes(p.value);
                            return (
                              <TouchableOpacity
                                key={p.value}
                                style={[styles.aiModePill, on && styles.aiModePillOn]}
                                onPress={() => toggleAiCyclePlanKey(p.value)}
                                activeOpacity={0.85}
                              >
                                <Text style={[styles.aiModeTxt, on && styles.aiModeTxtOn]}>{p.label}</Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </>
                    ) : null}
                    {aiCycleScope === 'member' ? (
                      <>
                        <Text style={styles.aiCycleLabel}>{tStr('admin_ai_cycle_member_hint')}</Text>
                        <View style={styles.aiModesRow}>
                          {aiMemberOptions.slice(0, 40).map((m) => {
                            const on = aiCycleMemberId === m.id;
                            return (
                              <TouchableOpacity
                                key={m.id}
                                style={[styles.aiModePill, on && styles.aiModePillOn]}
                                onPress={() => setAiCycleMemberId(m.id)}
                                activeOpacity={0.85}
                              >
                                <Text style={[styles.aiModeTxt, on && styles.aiModeTxtOn]} numberOfLines={1}>
                                  {m.label}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </>
                    ) : null}
                    <Text style={styles.aiCycleLabel}>{tStr('admin_ai_cycle_volume_label')}</Text>
                    <Text style={[styles.aiModeHintLine, { marginBottom: 6 }]}>
                      {tStr('admin_ai_cycle_volume_preset_hint')}
                    </Text>
                    <TextInput
                      style={styles.aiVolumeInput}
                      value={aiVolumeLandmarks}
                      onChangeText={setAiVolumeLandmarks}
                      placeholder={tStr('admin_ai_cycle_volume_ph')}
                      placeholderTextColor={t.placeholder}
                      multiline
                    />
                  </>
                ) : null}

                {aiModalVisible ? (
                  <AdminAiPromptWithVoice
                    aiPrompt={aiPrompt}
                    setAiPrompt={setAiPrompt}
                    aiBusy={aiBusy}
                    tStr={tStr}
                    locale={locale}
                    modalVisible={aiModalVisible}
                    styles={styles}
                    placeholderColor={t.placeholder}
                    brandColor={t.brand}
                    subTextColor={t.subText}
                    placeholderKey={
                      aiMode === 'cycle_plan' ? 'admin_ai_cycle_prompt_ph' : 'admin_ai_prompt_ph'
                    }
                  />
                ) : null}

                <TouchableOpacity
                  onPress={generateWithAi}
                  style={[styles.primaryBtn, { opacity: aiBusy ? 0.7 : 1 }]}
                  disabled={aiBusy}
                >
                  <Text style={styles.primaryBtnTextOn}>
                    {aiBusy ? tStr('admin_ai_generating') : tStr('admin_ai_generate')}
                  </Text>
                </TouchableOpacity>

                <View style={styles.aiOutputBox}>
                  {aiOutput.trim() ? (
                    renderPreviewWithRM(aiOutput, styles)
                  ) : (
                    <Text style={styles.aiOutputText}>{tStr('admin_ai_empty')}</Text>
                  )}
                </View>
                {aiSuggestedTitle ? (
                  <Text style={styles.aiWarnLine}>
                    {tStr('admin_ai_title_suggested').replace('{{title}}', aiSuggestedTitle)}
                  </Text>
                ) : null}
                {aiCoachNotes ? (
                  <Text style={styles.aiWarnLine}>
                    {tStr('admin_ai_coach_notes').replace('{{notes}}', aiCoachNotes)}
                  </Text>
                ) : null}
                {aiWarnings.map((w, i) => (
                  <Text key={`aiw-${i}`} style={styles.aiWarnLine}>
                    • {String(w)}
                  </Text>
                ))}
                {aiUsageLine ? <Text style={styles.aiWarnLine}>{aiUsageLine}</Text> : null}

                <View style={styles.aiActionsRow}>
                  <TouchableOpacity style={styles.aiActionBtn} onPress={copyAiResult}>
                    <Text style={styles.aiActionTxt}>{tStr('admin_ai_copy')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.aiActionBtn} onPress={applyAiResult}>
                    <Text style={styles.aiActionTxt}>{tStr('admin_ai_apply')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={moveModalVisible} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => setMoveModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.modalContent, styles.modalContentMoveMax]}>
                <Text style={styles.modalTitle}>{tStr('admin_mover_bloque')}</Text>

                <Text style={styles.label}>{tStr('admin_fecha_destino')}</Text>
                <TouchableOpacity
                  onPress={() =>
                    setMoveTargetDate((prev) => (prev ? null : new Date()))
                  }
                  style={styles.dropdown}
                >
                  <Text style={styles.dropdownValue}>
                    {moveTargetDate
                      ? new Date(moveTargetDate).toLocaleDateString(dateLocale)
                      : tStr('admin_usar_misma_fecha')}
                  </Text>
                  <Ionicons
                    name="calendar-outline"
                    size={18}
                    color={t.brand}
                  />
                </TouchableOpacity>

                <ScrollView style={styles.dropdownHoursScroll}>
                  {horariosDisponibles.map((h) => {
                    const selected = moveTargetHora === h;
                    return (
                      <TouchableOpacity
                        key={h}
                        onPress={() => setMoveTargetHora(h)}
                        style={[
                          styles.modalItem,
                          selected && styles.modalItemSelected,
                        ]}
                      >
                        <Text style={styles.dropdownItemText}>{h}</Text>
                        {selected && (
                          <Ionicons
                            name="checkmark"
                            size={18}
                            color={t.brand}
                          />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <TouchableOpacity
                  onPress={confirmarMover}
                  style={[styles.primaryBtn, styles.mt12]}
                >
                  <Text style={styles.primaryBtnTextOn}>{tStr('admin_listo')}</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </BackgroundWrapper>
  );
}
