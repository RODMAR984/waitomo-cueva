// screens/TrabajoDelDiaScreen.js — Waitomo Dark Only (COMPLETO)
// - Solo colors.dark + colors.brand (sin isDark ni literales)
// - Sin estilos inline ni cadenas fuera de <Text>
// - Overlays/bordes: hexToRgba(colors.brand.primary, 0.10 / 0.25)
// - Estilos via useMemo + StyleSheet.create
// - Funcionalidad 100% preservada + mejoras solicitadas:
//   • Fondo con rotación SOLO al entrar en esta pantalla (seed en focus)
//   • Bloques: por defecto PLEGADOS (solo título/horario). Se expanden al tocarlos.
//   • Preferencias de acordeón para RMs y Notas (persisten en userNotes)
//   • RM/Epley, notas (guardar/editar/borrar), chat (merge+dedup), refresh, modal RM

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  TouchableWithoutFeedback,
  Keyboard,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTrainingData } from '../../contexts/TrainingDataContext';
import { plansMatchForBlocks } from '../../utils/trainingBlockPlan';
import { RM_HIGHLIGHT_COLOR, formatRmWeightKg } from '../../utils/rmPattern';
import RoutineBlockContent from '../../components/RoutineBlockContent';
import RmCalculatorPanel from '../../components/RmCalculatorPanel';
import {
  fetchTrabajoDiaFeedMessages,
  insertTrabajoDiaFeedMessage,
  rowToFeedPayload,
} from '../../utils/trabajoDiaFeedSupabase';
import BackgroundWrapper from '../../components/BackgroundWrapper';
import BackNavButton from '../../components/BackNavButton';
import VideoLinksThumbs from '../../components/VideoLinksThumbs';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { useAuth } from '../../contexts/AuthContext';
import { useThemeContext } from '../../contexts/ThemeContext';
import { useLocale } from '../../contexts/LocaleContext';
import { formatYmdLocal } from '../../utils/formatYmdLocal';
import { normalizePlanKey } from '../../utils/planKeyNormalize';
import { fetchLatestUserAbono } from '../../utils/userAbonoFetch';
import { resolveFreeClassGrant } from '../../services/booking/trialClassGrant';
import { evaluateWorkoutEntitlement } from '../../utils/clientWorkoutEntitlement';
import { WEB_CONTENT_MAX_WIDTH, WEB_DESKTOP_BREAKPOINT } from '../../theme/webSpec';
import { MOBILE_RADII, MOBILE_SPACING, MOBILE_TYPE } from '../../theme/mobileSpec';
import NeoPanel from '../../components/NeoPanel';

// ---------- helpers ----------
const hexToRgba = (hex, alpha = 1) => {
  const clean = String(hex).replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
};

// ---------- screen ----------
export default function TrabajoDelDiaScreen({ route, navigation }) {
  const { width } = useWindowDimensions();
  const isWebDesktop = Platform.OS === 'web' && width >= WEB_DESKTOP_BREAKPOINT;
  const panelMaxWidth = isWebDesktop ? WEB_CONTENT_MAX_WIDTH : 860;
  // ================== PARAMS ==================
  const { plan, planKey, planValue, fecha, horario: paramHorario, hora: paramHora } = route.params || {};
  const horario = paramHorario ?? paramHora;
  const fechaEfectiva = fecha || formatYmdLocal(new Date());
  const {
    bloques,
    updateRM,
    getRM,
    calculateWeight,
    saveUserNote,
    userNotes,
    refreshTrigger,
    hydrated,
    refreshTrainingBlocksFromServer,
  } = useTrainingData();
  const { role, organization, profile, user } = useAuth();
  const effectiveOrgId = organization?.id ?? profile?.organization_id ?? null;
  const isAdminLike = role === 'superadmin' || role === 'coach';

  // ================== STATE ==================
  const [modalVisible, setModalVisible] = useState(false);
  const [rmModalCalcOpen, setRmModalCalcOpen] = useState(false);
  const [currentRM, setCurrentRM] = useState('');
  const [currentExercise, setCurrentExercise] = useState('');
  const [currentPercentage, setCurrentPercentage] = useState('');
  const [expandedId, setExpandedId] = useState(null); // ✅ por defecto todos plegados
  const [userNote, setUserNote] = useState('');
  const [chatMessage, setChatMessage] = useState('');
  const [activeTab, setActiveTab] = useState('workout');
  const [notesCollapsed, setNotesCollapsed] = useState(false);
  const [rmCollapsed, setRmCollapsed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [feedRows, setFeedRows] = useState([]);
  const [feedTick, setFeedTick] = useState(0);
  const [clientAbonoRow, setClientAbonoRow] = useState(null);
  const [clientAbonoLoading, setClientAbonoLoading] = useState(true);
  const [clientFreeGrant, setClientFreeGrant] = useState(null);

  // ✅ seed para rotación SOLO al entrar a esta pantalla
  const [bgSeed, setBgSeed] = useState(0);

  // ================== TOKENS ==================
  const { t } = useThemeContext();
  const { t: tStr } = useLocale();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { backgroundColor: 'transparent', flex: 1 },
        scroll: {
          flexGrow: 0,
          flexShrink: 0,
          justifyContent: 'flex-start',
          paddingTop: Platform.OS === 'web' ? 12 : 24,
          paddingBottom: Platform.OS === 'web' ? 16 : 24,
          width: '100%',
          alignSelf: 'center',
          maxWidth: panelMaxWidth,
        },

        panel: {
          backgroundColor: t.boxBg,
          borderColor: t.overlayBorder,
          borderRadius: MOBILE_RADII.lg,
          borderWidth: 1.5,
          marginHorizontal: isWebDesktop ? 14 : 20,
          padding: isWebDesktop ? 28 : 24,
          shadowColor: t.brand,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.35,
          shadowRadius: MOBILE_RADII.lg,
        },
        /** Pantalla de bloqueo: no estirar al ancho del viewport en web */
        lockPanel: {
          alignSelf: 'center',
          width: '100%',
          maxWidth: isWebDesktop ? 520 : 440,
        },
        panelHeader: {
          borderBottomColor: t.overlayBorder,
          borderBottomWidth: 1,
          marginBottom: 16,
          paddingBottom: 12,
        },
        backBtn: {
          alignSelf: 'flex-start',
          width: 'auto',
          maxWidth: 180,
          marginBottom: 10,
        },
        planTitle: {
          color: t.brand,
          fontSize: MOBILE_TYPE.title,
          fontWeight: 'bold',
          marginBottom: 4,
          textTransform: 'uppercase',
        },
        planSubtitle: {
          color: t.subText,
          fontSize: MOBILE_TYPE.body,
          marginBottom: 4,
        },
        dateText: {
          color: t.subText,
          fontSize: MOBILE_TYPE.body,
          fontStyle: 'italic',
        },

        // Tabs
        tabRow: {
          backgroundColor: t.inactiveTabBg,
          borderColor: t.overlayBorder,
          borderRadius: MOBILE_RADII.pill,
          borderWidth: 1,
          flexDirection: 'row',
          marginBottom: 16,
          overflow: 'hidden',
        },
        tabButton: {
          alignItems: 'center',
          flex: 1,
          paddingHorizontal: MOBILE_SPACING.sm,
          paddingVertical: 8,
        },
        tabButtonActive: {
          backgroundColor: t.activeTabBg,
        },
        tabText: {
          color: t.subText,
          fontSize: MOBILE_TYPE.body,
          fontWeight: '600',
        },
        tabTextActive: {
          color: t.text,
        },

        // Bloques
        noBlocks: {
          color: t.empty,
          fontSize: MOBILE_TYPE.body,
          fontStyle: 'italic',
          textAlign: 'center',
        },
        blockCard: {
          backgroundColor: t.inactiveTabBg,
          borderColor: t.overlayBorder,
          borderRadius: MOBILE_RADII.md,
          borderWidth: 1,
          marginBottom: Platform.OS === 'web' ? 8 : 12,
          overflow: 'hidden',
        },
        blockHeader: {
          alignItems: 'center',
          flexDirection: 'row',
          justifyContent: 'space-between',
          paddingHorizontal: MOBILE_SPACING.md,
          paddingVertical: 10,
        },
        blockTitleWrapper: {
          flex: 1,
          marginRight: 8,
        },
        blockTitle: {
          color: t.text,
          fontSize: MOBILE_TYPE.bodyStrong,
          fontWeight: '700',
          textTransform: 'uppercase',
        },
        blockMetaRow: {
          flexDirection: 'row',
          marginTop: 2,
        },
        blockMetaText: {
          color: t.subText,
          fontSize: MOBILE_TYPE.caption,
          marginRight: 8,
        },
        blockTypeTag: {
          borderColor: t.overlayBorder,
          borderRadius: MOBILE_RADII.pill,
          borderWidth: 1,
          paddingHorizontal: MOBILE_SPACING.sm,
          paddingVertical: 2,
        },
        blockTypeText: {
          color: t.brand2,
          fontSize: MOBILE_TYPE.caption,
          fontWeight: '600',
        },
        blockToggleIcon: {
          marginLeft: 8,
        },
        blockBody: {
          borderTopColor: t.overlayBorder,
          borderTopWidth: 1,
          paddingHorizontal: MOBILE_SPACING.md,
          paddingVertical: 10,
        },
        blockLine: {
          color: t.text,
          fontSize: MOBILE_TYPE.body,
          lineHeight: 22,
        },
        blockContentRoot: {
          color: t.text,
        },
        blockLineHighlighted: {
          color: t.brand,
          fontWeight: '700',
        },
        blockLineRmToken: {
          color: RM_HIGHLIGHT_COLOR,
          fontWeight: '700',
        },
        blockLineRmHint: {
          color: t.subText,
          fontSize: MOBILE_TYPE.caption,
          fontWeight: '500',
        },

        // Enlaces a video
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

        // Coach notes
        coachNotesContainer: {
          backgroundColor: t.boxBg,
          borderColor: t.overlayBorder,
          borderRadius: MOBILE_RADII.sm,
          borderWidth: 1,
          marginTop: 8,
          padding: 10,
        },
        coachNotesTitle: {
          color: t.brand2,
          fontSize: MOBILE_TYPE.body,
          fontWeight: '600',
          marginBottom: 4,
        },
        coachNotesContent: {
          color: t.text,
          fontSize: MOBILE_TYPE.bodyStrong,
          lineHeight: 20,
        },

        // Notas
        notesContainer: { marginBottom: 20 },
        sectionTitle: { color: t.brand, fontSize: MOBILE_TYPE.bodyStrong, fontWeight: 'bold', marginBottom: 10 },
        notesSubtitle: { color: t.subText, fontSize: MOBILE_TYPE.body, fontStyle: 'italic', marginBottom: 10 },
        notesInput: {
          backgroundColor: t.boxBg,
          borderColor: t.overlayBorder,
          borderRadius: MOBILE_RADII.sm,
          borderWidth: 1,
          color: t.text,
          marginBottom: 12,
          minHeight: 140,
          padding: 12,
          textAlignVertical: 'top',
        },
        notesButtonsRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginBottom: 10,
        },
        button: {
          alignItems: 'center',
          borderRadius: MOBILE_RADII.pill,
          minWidth: 120,
          paddingHorizontal: MOBILE_SPACING.lg,
          paddingVertical: 10,
        },
        saveButton: {
          ...t.buttonPrimary,
        },
        deleteButton: {
          backgroundColor: t.danger,
        },
        buttonText: {
          ...t.buttonPrimaryText,
          fontSize: MOBILE_TYPE.body,
          fontWeight: '700',
        },
        notesList: {
          borderColor: t.overlayBorder,
          borderRadius: MOBILE_RADII.compact,
          borderWidth: 1,
          padding: 10,
        },
        noteLine: {
          backgroundColor: t.boxBg,
          borderColor: t.overlayBorder,
          borderRadius: MOBILE_RADII.compact,
          borderWidth: 1,
          marginBottom: 8,
          padding: 10,
        },
        noteItemText: { color: t.text, fontSize: MOBILE_TYPE.caption, lineHeight: 16 },
        noteActions: { flexDirection: 'row', justifyContent: 'flex-end' },
        noteActionBtn: { marginLeft: 16 },
        noteEditBtn: { color: t.brand, fontWeight: '600' },
        noteDeleteBtn: { color: t.danger, fontWeight: '700' },
        noteSaveBtn: { color: t.brand2, fontWeight: '700' },
        noteCancelBtn: { color: t.subText, fontWeight: '600' },
        noteEditInput: {
          borderColor: t.overlayBorder,
          borderRadius: MOBILE_RADII.xs,
          borderWidth: 1,
          color: t.text,
          padding: 8,
        },
        noNotesText: { color: t.placeholder, fontStyle: 'italic', marginVertical: 10, textAlign: 'center' },

        // RMs
        accordionHeader: {
          alignItems: 'center',
          borderColor: t.overlayBorder,
          borderRadius: MOBILE_RADII.sm,
          borderWidth: 1,
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginBottom: 8,
          padding: 12,
        },
        accordionHeaderTxt: { color: t.brand2, fontSize: MOBILE_TYPE.bodyStrong, fontWeight: '700' },
        existingRMsContainer: {
          backgroundColor: t.boxBg,
          borderColor: t.overlayBorder,
          borderRadius: MOBILE_RADII.sm,
          borderWidth: 1,
          marginBottom: 16,
          padding: 10,
        },
        rmItem: {
          alignItems: 'center',
          borderColor: t.overlayBorder,
          borderRadius: MOBILE_RADII.compact,
          borderWidth: 1,
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginBottom: 8,
          padding: 12,
        },
        rmItemText: { color: t.brand2, fontWeight: '600' },
        rmItemEdit: { color: t.brand, fontSize: MOBILE_TYPE.caption },
        noRMsText: { color: t.placeholder, fontStyle: 'italic', marginVertical: 10, textAlign: 'center' },

        rmCalcBox: {
          backgroundColor: t.boxBg,
          borderColor: t.overlayBorder,
          borderRadius: MOBILE_RADII.sm,
          borderWidth: 1,
          marginBottom: 12,
          padding: 12,
        },
        rmCalcBoxCompact: {
          marginBottom: 8,
          marginTop: 4,
          padding: 10,
        },
        rmCalcTitle: {
          color: t.brand2,
          fontSize: MOBILE_TYPE.bodyStrong,
          fontWeight: '700',
          marginBottom: 4,
        },
        rmCalcHint: {
          color: t.placeholder,
          fontSize: MOBILE_TYPE.micro,
          lineHeight: 15,
          marginBottom: 10,
        },
        rmCalcRow: {
          columnGap: 8,
          flexDirection: 'row',
        },
        rmCalcInput: {
          backgroundColor: t.inactiveTabBg,
          borderColor: t.overlayBorder,
          borderRadius: MOBILE_RADII.compact,
          borderWidth: 1,
          color: t.text,
          fontSize: MOBILE_TYPE.body,
          marginBottom: 8,
          paddingHorizontal: 10,
          paddingVertical: Platform.OS === 'web' ? 10 : 8,
        },
        rmCalcInputHalf: {
          flex: 1,
        },
        rmCalcResult: {
          color: t.brand,
          fontSize: MOBILE_TYPE.bodyStrong,
          fontWeight: '800',
          marginBottom: 10,
          textAlign: 'center',
        },
        rmCalcActions: {
          columnGap: 8,
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'center',
        },
        rmCalcBtn: {
          borderRadius: MOBILE_RADII.compact,
          minWidth: 120,
          paddingHorizontal: 12,
          paddingVertical: 10,
        },
        rmCalcBtnPrimary: {
          ...t.buttonPrimary,
        },
        rmCalcBtnSecondary: {
          backgroundColor: t.boxBg,
          borderColor: t.overlayBorder,
          borderWidth: 1,
        },
        rmCalcBtnTextPrimary: {
          ...t.buttonPrimaryText,
          fontSize: MOBILE_TYPE.caption,
          fontWeight: '700',
          textAlign: 'center',
        },
        rmCalcBtnTextSecondary: {
          color: t.brand,
          fontSize: MOBILE_TYPE.caption,
          fontWeight: '700',
          textAlign: 'center',
        },
        rmCalcToggle: {
          alignSelf: 'center',
          marginBottom: 8,
          paddingVertical: 4,
        },
        rmCalcToggleText: {
          color: t.brand,
          fontSize: MOBILE_TYPE.caption,
          fontWeight: '700',
          textAlign: 'center',
        },

        // Chat
        chatTabContainer: { flex: 1, marginBottom: 20 },
        chatMessagesContainer: { height: 300, marginBottom: 10 },
        chatScrollView: { flex: 1 },
        chatContentContainer: { flexGrow: 1, justifyContent: 'flex-end', paddingVertical: 10 },
        chatSubtitle: { color: t.subText, fontSize: MOBILE_TYPE.body, fontStyle: 'italic', marginBottom: 15 },
        messageBubble: { borderRadius: MOBILE_RADII.sm, marginVertical: 5, maxWidth: '80%', padding: 10 },
        userMessage: { alignSelf: 'flex-end', backgroundColor: hexToRgba(t.brand, 0.18), marginLeft: '20%' },
        adminMessage: { alignSelf: 'flex-start', backgroundColor: t.boxBg, marginRight: '20%' },
        messageText: { color: t.text, fontSize: MOBILE_TYPE.body },
        messageTime: { color: t.subText, fontSize: MOBILE_TYPE.caption, marginTop: 4, textAlign: 'right' },
        messageUser: { color: t.brand2, fontSize: MOBILE_TYPE.caption, fontWeight: 'bold', marginBottom: 4 },
        messageHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
        scopeTag: {
          borderRadius: MOBILE_RADII.pill,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          paddingHorizontal: MOBILE_SPACING.sm,
          paddingVertical: 2,
          marginLeft: 8,
          backgroundColor: t.boxBg,
        },
        scopeTagGlobal: { backgroundColor: hexToRgba(t.brand, 0.16) },
        scopeTagPlan: { backgroundColor: hexToRgba(t.brand, 0.18) },
        scopeTagDay: { backgroundColor: t.boxBg },
        scopeTagBoth: { backgroundColor: hexToRgba(t.brand, 0.22) },
        scopeTagText: { color: t.text, fontSize: MOBILE_TYPE.caption, fontWeight: '700' },
        emptyChatContainer: { alignItems: 'center', padding: 20 },
        emptyChatText: { color: t.placeholder, fontStyle: 'italic' },
        chatInputContainer: {
          alignItems: 'center',
          flexDirection: 'row',
          marginTop: 10,
        },
        chatInput: {
          backgroundColor: t.boxBg,
          borderColor: t.overlayBorder,
          borderRadius: MOBILE_RADII.pill,
          borderWidth: 1,
          color: t.text,
          flex: 1,
          marginRight: 10,
          minHeight: 40,
          paddingHorizontal: MOBILE_SPACING.lg,
          paddingVertical: 8,
        },
        chatSendButton: {
          alignItems: 'center',
          ...t.buttonPrimary,
          borderRadius: MOBILE_RADII.pill,
          borderColor: t.overlayBorder,
          height: 40,
          justifyContent: 'center',
          paddingHorizontal: MOBILE_SPACING.lg,
        },
        chatSendButtonText: { color: '#fff', fontWeight: '700' },

        // toggles de envío
        sendTogglesRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: 8, marginTop: 8 },
        togglePill: {
          alignItems: 'center',
          backgroundColor: t.boxBg,
          borderColor: t.overlayBorder,
          borderRadius: MOBILE_RADII.xl,
          borderWidth: 1,
          flexDirection: 'row',
          marginHorizontal: 8,
          paddingHorizontal: 10,
          paddingVertical: 6,
        },
        togglePillActive: { backgroundColor: hexToRgba(t.brand, 0.18) },
        toggleText: { color: t.text, fontSize: MOBILE_TYPE.caption, fontWeight: '600', marginLeft: 6 },

        // Modal
        modalBackdrop: {
          alignItems: 'center',
          backgroundColor: 'rgba(0,0,0,0.6)',
          flex: 1,
          justifyContent: 'center',
        },
        modalContent: {
          backgroundColor: t.inactiveTabBg,
          borderColor: t.overlayBorder,
          borderRadius: MOBILE_RADII.lg,
          borderWidth: 1,
          maxHeight: '90%',
          padding: 20,
          width: '88%',
        },
        modalTitle: { color: t.brand, fontSize: MOBILE_TYPE.title, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
        modalSubtitle: { color: t.subText, fontSize: MOBILE_TYPE.body, marginBottom: 10, textAlign: 'center' },
        input: {
          backgroundColor: t.boxBg,
          borderColor: t.overlayBorder,
          borderRadius: MOBILE_RADII.compact,
          borderWidth: 1,
          color: t.text,
          marginBottom: 12,
          padding: 12,
        },
        modalButtons: { flexDirection: 'row', justifyContent: 'space-between' },
        modalButton: { alignItems: 'center', borderRadius: MOBILE_RADII.compact, minWidth: 100, padding: 12 },
        cancelButton: { backgroundColor: t.boxBg },
        saveButtonModal: { ...t.buttonPrimary },

        // Refresh
        refreshSpinner: {
          marginBottom: 10,
        },

        lockScroll: {
          flexGrow: 1,
          justifyContent: 'center',
          paddingVertical: 40,
          paddingHorizontal: 16,
          width: '100%',
          maxWidth: panelMaxWidth,
          alignSelf: 'center',
        },
        lockCta: {
          alignItems: 'center',
          borderRadius: MOBILE_RADII.md,
          marginTop: 12,
          marginBottom: 6,
          paddingVertical: 12,
          ...t.buttonPrimary,
        },
        lockCtaText: { ...t.buttonPrimaryText, fontWeight: '600' },
        lockBack: { alignItems: 'center', marginTop: 20, paddingVertical: 8 },
        lockBackText: { color: t.subText, fontSize: MOBILE_TYPE.body },
        lockBackBtn: {
          marginTop: 20,
        },
      }),
    [t, isWebDesktop, panelMaxWidth],
  );

  // ================== NORMALIZACIÓN FECHA / HORA ==================
  const fechaTexto = useMemo(() => {
    if (!fechaEfectiva) return '';
    try {
      const d = new Date(fechaEfectiva + 'T12:00:00');
      return d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
    } catch (e) {
      return String(fechaEfectiva);
    }
  }, [fechaEfectiva]);

  const normalizeHora = (h) => {
    if (h == null) return '';
    let s = typeof h === 'string' ? h : String(h);
    s = s.trim().toLowerCase();
    const hasAM = /\bam\b/.test(s);
    const hasPM = /\bpm\b/.test(s);
    s = s.replace(/\bhs?\b|\bam\b|\bpm\b/gi, '').trim();
    s = s.replace(/[^\d:.\- ]/g, '');
    let base = s.split('-')[0].trim();
    if (!base) return '';
    if (/^\d{1,2}$/.test(base)) base = `${base.padStart(2, '0')}:00`;
    else if (/^\d{1,2}:\d{1,2}$/.test(base)) {
      const [h1, m1] = base.split(':');
      base = `${h1.padStart(2, '0')}:${m1.padStart(2, '0')}`;
    } else if (/^\d{1,2}:\d{1,2}:\d{1,2}$/.test(base)) {
      const [h1, m1] = base.split(':');
      base = `${h1.padStart(2, '0')}:${m1.padStart(2, '0')}`;
    }
    let hourNum = parseInt(base.slice(0, 2), 10);
    const mins = base.slice(3);
    if (hasPM && hourNum < 12) hourNum += 12;
    if (hasAM && hourNum === 12) hourNum = 0;
    return `${String(hourNum).padStart(2, '0')}:${mins}`;
  };

  const horarioEfectivo = useMemo(() => {
    if (!horario) return '';
    return normalizeHora(horario);
  }, [horario]);

  // ================== PLAN NORMALIZADO (para filtro y display) ==================
  // planValue = valor que usa Admin al guardar bloques (cross_training, yoga, etc.)
  const planValueEfectivo = useMemo(() => {
    if (planValue) return String(planValue).trim();
    if (plan?.planValue) return String(plan.planValue).trim();
    const raw = plan?.id || plan?.key || plan?.planKey || '';
    const s = String(raw).toLowerCase().trim();
    if (s.includes('cross')) return 'cross_training';
    if (s.includes('open')) return 'open_box';
    if (s.includes('evol')) return 'ciclo_evolucion';
    if (s.includes('yoga')) return 'yoga';
    if (s.includes('stretch')) return 'stretching';
    if (s.includes('hyrox')) return 'hyrox';
    return s || '';
  }, [planValue, plan]);

  const planNombreCorregido = useMemo(() => {
    if (plan?.nombre) return String(plan.nombre).trim();
    if (plan?.title) return String(plan.title).trim();
    return planValueEfectivo.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }, [plan, planValueEfectivo]);

  const planKeyNormalized = useMemo(() => {
    const raw = plan?.id || planKey || plan?.planKey || planNombreCorregido || '';
    const s = String(raw).toLowerCase().trim();
    if (!s) return null;
    if (s.includes('cross')) return 'cross';
    if (s.includes('hyrox')) return 'hyrox';
    if (s.includes('evol')) return 'evolucion';
    if (s.includes('stretch')) return 'stretching';
    if (s.includes('yoga')) return 'yoga';
    if (s.includes('open')) return 'open_box';
    return s.replace(/\s+/g, '_');
  }, [plan, planKey, planNombreCorregido]);

  const planCanonForEntitlement = useMemo(() => {
    return (
      normalizePlanKey(planKey) ||
      normalizePlanKey(planKeyNormalized) ||
      normalizePlanKey(planValueEfectivo) ||
      null
    );
  }, [planKey, planKeyNormalized, planValueEfectivo]);

  useEffect(() => {
    if (isAdminLike || !user?.id) {
      setClientAbonoLoading(false);
      setClientAbonoRow(null);
      return undefined;
    }
    let alive = true;
    (async () => {
      setClientAbonoLoading(true);
      try {
        const row = await fetchLatestUserAbono(user.id);
        if (alive) setClientAbonoRow(row);
      } catch {
        if (alive) setClientAbonoRow(null);
      } finally {
        if (alive) setClientAbonoLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [isAdminLike, user?.id]);

  useEffect(() => {
    if (isAdminLike) {
      setClientFreeGrant(null);
      return undefined;
    }
    let alive = true;
    (async () => {
      const g = await resolveFreeClassGrant(user?.id);
      if (alive) setClientFreeGrant(g);
    })();
    return () => {
      alive = false;
    };
  }, [isAdminLike, user?.id]);

  const workoutEntitlement = useMemo(() => {
    if (isAdminLike) return { ok: true };
    return evaluateWorkoutEntitlement({
      planCanonKey: planCanonForEntitlement,
      organizationId: effectiveOrgId,
      abonoRow: clientAbonoRow,
      abonoLoading: clientAbonoLoading,
      freeClassGrant: clientFreeGrant,
      fechaYmd: String(fechaEfectiva).slice(0, 10),
      horarioNormalized: horarioEfectivo,
    });
  }, [
    isAdminLike,
    planCanonForEntitlement,
    effectiveOrgId,
    clientAbonoRow,
    clientAbonoLoading,
    clientFreeGrant,
    fechaEfectiva,
    horarioEfectivo,
  ]);

  // ✅ rotación SOLO al entrar (focus)
  useFocusEffect(
    useCallback(() => {
      setBgSeed(Date.now());
      if (typeof refreshTrainingBlocksFromServer === 'function' && effectiveOrgId) {
        refreshTrainingBlocksFromServer();
      }
      return undefined;
    }, [refreshTrainingBlocksFromServer, effectiveOrgId]),
  );

  // ================== BLOQUES FILTRADOS ==================
  // Filtro por plan (b.plan = valor Admin), fecha (fechaKey o slice ISO) y opcionalmente horario
  const bloquesDelDia = useMemo(() => {
    if (!bloques || !Array.isArray(bloques)) return [];
    const fechaKey = fechaEfectiva.slice(0, 10);
    return bloques.filter((b) => {
      if (effectiveOrgId && b.organization_id && b.organization_id !== effectiveOrgId) return false;
      const samePlan = plansMatchForBlocks(b.plan, planValueEfectivo);
      const bFechaKey = b.fechaKey || (b.fecha ? String(b.fecha).slice(0, 10) : '');
      const sameDate = bFechaKey === fechaKey;
      if (!samePlan || !sameDate) return false;
      if (!horarioEfectivo) return true;
      const bHora = normalizeHora(b.hora || b.horario);
      return bHora === horarioEfectivo;
    });
  }, [bloques, planValueEfectivo, fechaEfectiva, horarioEfectivo, effectiveOrgId]);

  // ================== NOTAS DE USUARIO ==================
  const userNoteKey = useMemo(() => {
    return `note_${planValueEfectivo}_${fechaEfectiva}_${horarioEfectivo || ''}`;
  }, [planValueEfectivo, fechaEfectiva, horarioEfectivo]);

  useEffect(() => {
    const existing = userNotes[userNoteKey];
    if (existing) {
      setUserNote(existing.text || '');
      setNotesCollapsed(existing.collapsed ?? false);
      setRmCollapsed(existing.rmCollapsed ?? false);
    }
  }, [userNotes, userNoteKey]);

  const handleSaveNote = () => {
    saveUserNote(userNoteKey, {
      text: userNote,
      collapsed: notesCollapsed,
      rmCollapsed,
    });
    Alert.alert(tStr('trabajo_dia_notes_saved_title'), tStr('trabajo_dia_notes_saved_body'));
  };

  const handleDeleteNote = () => {
    saveUserNote(userNoteKey, {
      text: '',
      collapsed: notesCollapsed,
      rmCollapsed,
    });
    setUserNote('');
  };

  const toggleNotesAccordion = () => {
    const next = !notesCollapsed;
    setNotesCollapsed(next);
    saveUserNote(userNoteKey, {
      text: userNote,
      collapsed: next,
      rmCollapsed,
    });
  };

  const toggleRmAccordion = () => {
    const next = !rmCollapsed;
    setRmCollapsed(next);
    saveUserNote(userNoteKey, {
      text: userNote,
      collapsed: notesCollapsed,
      rmCollapsed: next,
    });
  };

  // ================== RMs ==================
  const openRMModal = (exercise, percentageLabel) => {
    setCurrentExercise(exercise);
    setCurrentPercentage(percentageLabel);
    const existing = getRM(exercise);
    setCurrentRM(existing ? String(existing) : '');
    setRmModalCalcOpen(false);
    setModalVisible(true);
  };

  const saveRMFromCalculator = useCallback(
    (exerciseName, oneRmKg) => {
      const rounded = formatRmWeightKg(oneRmKg);
      const parsed = parseFloat(String(rounded).replace(',', '.'));
      if (Number.isNaN(parsed) || parsed <= 0) return;
      updateRM(exerciseName, parsed);
      Alert.alert(tStr('trabajo_rm_calc_saved_title'), tStr('trabajo_rm_calc_saved_body'));
    },
    [updateRM, tStr],
  );

  const saveRM = () => {
    const parsed = parseFloat(currentRM.replace(',', '.'));
    if (Number.isNaN(parsed) || parsed <= 0) {
      Alert.alert(tStr('trabajo_dia_rm_invalid_title'), tStr('trabajo_dia_rm_invalid_body'));
      return;
    }
    updateRM(currentExercise, parsed);
    setModalVisible(false);
  };

  const getExistingRMs = useCallback(() => Object.entries(getRM() || {}), [getRM]);

  // ================== CHAT (feed en Supabase: trabajo_dia_feed_messages) ==================
  const [sendToPlan, setSendToPlan] = useState(true);
  const [sendToDay, setSendToDay] = useState(true);

  useEffect(() => {
    if (!hydrated || !effectiveOrgId) {
      setFeedRows([]);
      return;
    }
    let alive = true;
    (async () => {
      const { data, error } = await fetchTrabajoDiaFeedMessages({
        organizationId: effectiveOrgId,
        planValueForKey: planValueEfectivo,
        fechaYmd: fechaEfectiva.slice(0, 10),
        horarioNormalized: horarioEfectivo,
      });
      if (!alive) return;
      if (error) {
        setFeedRows([]);
        return;
      }
      setFeedRows(data || []);
    })();
    return () => {
      alive = false;
    };
  }, [hydrated, effectiveOrgId, planValueEfectivo, fechaEfectiva, horarioEfectivo, feedTick]);

  const messagesMerged = useMemo(() => {
    if (!hydrated) return [];
    const mapped = (feedRows || []).map(rowToFeedPayload).filter((m) => m && m.id);
    const visible = isAdminLike
      ? mapped
      : mapped.filter((m) => m.scope !== 'global');
    const messageMap = new Map();
    visible.forEach((msg) => {
      messageMap.set(msg.id, msg);
    });
    return Array.from(messageMap.values()).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  }, [feedRows, hydrated, isAdminLike]);

  const sendMessage = async () => {
    const text = (chatMessage || '').trim();
    if (!text) return;
    if (!sendToPlan && !sendToDay) {
      Alert.alert(tStr('trabajo_dia_chat_dest_title'), tStr('trabajo_dia_chat_dest_body'));
      return;
    }
    if (!user?.id || !effectiveOrgId) {
      Alert.alert(tStr('trabajo_dia_chat_dest_title'), tStr('chat_hint_no_org'));
      return;
    }
    const baseId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const displayName = profile?.full_name || profile?.username || tStr('common_user');
    const ts = Date.now();

    try {
      if (sendToPlan) {
        const r1 = await insertTrabajoDiaFeedMessage({
          organizationId: effectiveOrgId,
          feedKind: 'plan',
          planKey: planValueEfectivo,
          sessionDate: null,
          slotLabel: null,
          authorId: user.id,
          payload: {
            text,
            user: displayName,
            timestamp: ts,
            isUser: true,
            id: `${baseId}_plan`,
            scope: sendToDay ? 'plan+day' : 'plan',
          },
          clientMsgId: `${baseId}_plan`,
        });
        if (r1?.error?.message) console.warn('trabajo_dia_feed plan', r1.error.message);
      }
      if (sendToDay) {
        const r2 = await insertTrabajoDiaFeedMessage({
          organizationId: effectiveOrgId,
          feedKind: 'day',
          planKey: planValueEfectivo,
          sessionDate: fechaEfectiva.slice(0, 10),
          slotLabel: horarioEfectivo || null,
          authorId: user.id,
          payload: {
            text,
            user: displayName,
            timestamp: ts,
            isUser: true,
            id: `${baseId}_day`,
            scope: sendToPlan ? 'plan+day' : 'day',
          },
          clientMsgId: `${baseId}_day`,
        });
        if (r2?.error?.message) console.warn('trabajo_dia_feed day', r2.error.message);
      }
      setFeedTick((x) => x + 1);
    } catch (e) {
      console.warn('trabajo_dia_feed send', e?.message);
    }
    setChatMessage('');
    Keyboard.dismiss();
  };

  // ================== REFRESH ==================
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshTrainingBlocksFromServer();
      setFeedTick((x) => x + 1);
    } finally {
      setRefreshing(false);
    }
  }, [refreshTrainingBlocksFromServer]);

  // ================== UI ==================
  if (!isAdminLike && !workoutEntitlement.ok) {
    if (workoutEntitlement.reason === 'loading') {
      return (
        <BackgroundWrapper screen="TrabajoDelDia" planKey={planKeyNormalized} seed={bgSeed}>
          <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
            <ActivityIndicator size="large" color={t.brand} />
          </View>
        </BackgroundWrapper>
      );
    }
    return (
      <BackgroundWrapper screen="TrabajoDelDia" planKey={planKeyNormalized} seed={bgSeed}>
        <View style={styles.container} testID="screen-trabajo-dia">
          <ScrollView contentContainerStyle={styles.lockScroll} keyboardShouldPersistTaps="handled">
            <NeoPanel style={[styles.panel, styles.lockPanel]}>
              <View style={styles.panelHeader}>
                <Text style={styles.planTitle}>{tStr('client_trabajo_locked_title')}</Text>
                <Text style={styles.planSubtitle}>{tStr('client_trabajo_locked_body')}</Text>
              </View>
              <TouchableOpacity
                style={styles.lockCta}
                onPress={() => navigation.navigate('PlanSelector')}
                activeOpacity={0.9}
              >
                <Text style={styles.lockCtaText}>{tStr('client_entitlement_go_plans')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.lockCta}
                onPress={() => navigation.navigate('AbonosPases')}
                activeOpacity={0.9}
              >
                <Text style={styles.lockCtaText}>{tStr('client_entitlement_go_pay')}</Text>
              </TouchableOpacity>
              <BackNavButton
                testID="trabajo-nav-back"
                onPress={() => navigation.goBack()}
                label={tStr('common_back')}
                style={[styles.backBtn, styles.lockBackBtn]}
              />
            </NeoPanel>
          </ScrollView>
        </View>
      </BackgroundWrapper>
    );
  }

  return (
    <BackgroundWrapper
      screen="TrabajoDelDia"
      planKey={planKeyNormalized}
      seed={bgSeed}
    >
      <KeyboardAvoidingView
        testID="screen-trabajo-dia"
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={Platform.OS === 'web' ? { flex: 1, minHeight: 0 } : undefined}
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={t.brand}
              style={styles.refreshSpinner}
            />
          }
        >
          <NeoPanel style={styles.panel}>
            {/* Header */}
            <View style={styles.panelHeader}>
              <BackNavButton
                testID="trabajo-nav-back"
                onPress={() => navigation.goBack()}
                label={tStr('common_back')}
                style={styles.backBtn}
              />
              <Text style={styles.planTitle}>{planNombreCorregido || tStr('trabajo_plan_seleccionado')}</Text>
              <Text style={styles.planSubtitle}>{horarioEfectivo || tStr('trabajo_horario_libre')}</Text>
              {!!fechaTexto && <Text style={styles.dateText}>{fechaTexto}</Text>}
            </View>

            {/* Tabs */}
            <View style={styles.tabRow}>
              <TouchableOpacity
                style={[styles.tabButton, activeTab === 'workout' && styles.tabButtonActive]}
                onPress={() => setActiveTab('workout')}
              >
                <Text style={[styles.tabText, activeTab === 'workout' && styles.tabTextActive]}>
                  {tStr('trabajo_workout')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabButton, activeTab === 'notes' && styles.tabButtonActive]}
                onPress={() => setActiveTab('notes')}
              >
                <Text style={[styles.tabText, activeTab === 'notes' && styles.tabTextActive]}>
                  {tStr('trabajo_notes')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabButton, activeTab === 'chat' && styles.tabButtonActive]}
                onPress={() => setActiveTab('chat')}
              >
                <Text style={[styles.tabText, activeTab === 'chat' && styles.tabTextActive]}>
                  {tStr('trabajo_chat')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* === TAB: WORKOUT === */}
            {activeTab === 'workout' && (
              <View>
                {bloquesDelDia.length === 0 ? (
                  <Text style={styles.noBlocks}>{tStr('trabajo_no_bloques')}</Text>
                ) : (
                  bloquesDelDia.map((bloque) => {
                    const isExpanded = expandedId === bloque.id;

                    const videoLinks = Array.isArray(bloque.videoLinks)
                      ? bloque.videoLinks
                      : Array.isArray(bloque.videos)
                        ? bloque.videos
                        : [];
                    const coachNotes = bloque.notas || bloque.coachNotes || '';

                    return (
                      <View key={bloque.id} style={styles.blockCard}>
                        <TouchableOpacity
                          style={styles.blockHeader}
                          onPress={() => setExpandedId(isExpanded ? null : bloque.id)}
                        >
                          <View style={styles.blockTitleWrapper}>
                            <Text style={styles.blockTitle}>{bloque.titulo || tStr('trabajo_bloque_sin_titulo')}</Text>
                            <View style={styles.blockMetaRow}>
                              <Text style={styles.blockMetaText}>
                                {bloque.hora || bloque.horario || horarioEfectivo || tStr('trabajo_horario')}
                              </Text>
                              {!!bloque.tipo && (
                                <View style={styles.blockTypeTag}>
                                  <Text style={styles.blockTypeText}>{bloque.tipo}</Text>
                                </View>
                              )}
                            </View>
                          </View>
                          <Ionicons
                            name={isExpanded ? 'chevron-up' : 'chevron-down'}
                            size={18}
                            color={t.brand}
                            style={styles.blockToggleIcon}
                          />
                        </TouchableOpacity>

                        {isExpanded && (
                          <View style={styles.blockBody}>
                            <RoutineBlockContent
                              text={bloque.contenido}
                              getRM={getRM}
                              calculateWeight={calculateWeight}
                              onRmPress={openRMModal}
                              textStyle={styles.blockContentRoot}
                              rmStyle={styles.blockLineRmToken}
                              rmHintStyle={styles.blockLineRmHint}
                              tStr={tStr}
                            />

                            {/* Coach notes */}
                            {!!coachNotes && (
                              <View style={styles.coachNotesContainer}>
                                <Text style={styles.coachNotesTitle}>{tStr('trabajo_coach_notes')}</Text>
                                <Text style={styles.coachNotesContent}>{coachNotes}</Text>
                              </View>
                            )}

                            {/* Video links */}
                            {videoLinks.length > 0 ? (
                              <VideoLinksThumbs
                                links={videoLinks}
                                themeStyles={styles}
                                placeholderColor={t.placeholder}
                              />
                            ) : null}
                          </View>
                        )}
                      </View>
                    );
                  })
                )}
              </View>
            )}

            {/* === TAB: NOTES === */}
            {activeTab === 'notes' && (
              <View>
                {/* Acordeón notas */}
                <TouchableOpacity onPress={toggleNotesAccordion} style={styles.accordionHeader}>
                  <Text style={styles.accordionHeaderTxt}>📝 {tStr('trabajo_mis_notas')}</Text>
                  <Ionicons
                    name={notesCollapsed ? 'chevron-down' : 'chevron-up'}
                    size={18}
                    color={t.brand}
                  />
                </TouchableOpacity>

                {!notesCollapsed && (
                  <View style={styles.notesContainer}>
                    <Text style={styles.notesSubtitle}>
                      {tStr('trabajo_notes_hint')}
                    </Text>
                    <TextInput
                      style={styles.notesInput}
                      value={userNote}
                      onChangeText={setUserNote}
                      placeholder={tStr('trabajo_placeholder_note')}
                      placeholderTextColor={t.placeholder}
                      multiline
                    />
                    <View style={styles.notesButtonsRow}>
                      <TouchableOpacity style={[styles.button, styles.saveButton]} onPress={handleSaveNote}>
                        <Text style={styles.buttonText}>{tStr('trabajo_guardar_notas')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.button, styles.deleteButton]} onPress={handleDeleteNote}>
                        <Text style={styles.buttonText}>{tStr('trabajo_borrar')}</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Acordeón RMs dentro de notas */}
                    <TouchableOpacity onPress={toggleRmAccordion} style={styles.accordionHeader}>
                      <Text style={styles.accordionHeaderTxt}>⚙️ {tStr('trabajo_rms')}</Text>
                      <Ionicons
                        name={rmCollapsed ? 'chevron-down' : 'chevron-up'}
                        size={18}
                        color={t.brand}
                      />
                    </TouchableOpacity>

                    {!rmCollapsed && (
                      <View style={styles.existingRMsContainer}>
                        <RmCalculatorPanel
                          tStr={tStr}
                          styles={styles}
                          placeholderColor={t.placeholder}
                          onSaveOneRm={saveRMFromCalculator}
                        />
                        <Text style={styles.sectionTitle}>📋 {tStr('trabajo_mis_rms_registrados')}</Text>
                        {getExistingRMs().length > 0 ? (
                          getExistingRMs().map(([exercise, rmValue]) => (
                            <TouchableOpacity
                              key={exercise}
                              style={styles.rmItem}
                              onPress={() => {
                                setCurrentExercise(exercise);
                                setCurrentRM(String(rmValue));
                                setModalVisible(true);
                              }}
                            >
                              <Text style={styles.rmItemText}>
                                {exercise}: {rmValue}kg
                              </Text>
                              <Text style={styles.rmItemEdit}>{tStr('trabajo_editar')}</Text>
                            </TouchableOpacity>
                          ))
                        ) : (
                          <Text style={styles.noRMsText}>{tStr('trabajo_no_rms_registrados')}</Text>
                        )}
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* === TAB: CHAT === */}
            {activeTab === 'chat' && (
              <View style={styles.chatTabContainer}>
                <Text style={styles.sectionTitle}>
                  💬 Chat - {String(planNombreCorregido || '').toUpperCase()}
                </Text>
                <Text style={styles.chatSubtitle}>
                  {isAdminLike
                    ? tStr('trabajo_chat_subtitle_admin')
                    : tStr('trabajo_chat_subtitle_user')}
                </Text>

                <View style={styles.chatMessagesContainer}>
                  <ScrollView
                    style={styles.chatScrollView}
                    contentContainerStyle={styles.chatContentContainer}
                    showsVerticalScrollIndicator={false}
                  >
                    {messagesMerged.length ? (
                      messagesMerged.map((msg) => {
                        const scope = msg.scope || '';
                        let scopeLabel = '';
                        if (scope === 'global') scopeLabel = tStr('trabajo_scope_global');
                        else if (scope === 'plan') scopeLabel = tStr('trabajo_scope_plan');
                        else if (scope === 'day') scopeLabel = tStr('trabajo_scope_day');
                        else if (scope === 'plan+day') scopeLabel = tStr('trabajo_scope_plan_day');

                        return (
                          <View
                            key={msg.id}
                            style={[
                              styles.messageBubble,
                              msg.isUser ? styles.userMessage : styles.adminMessage,
                            ]}
                          >
                            <View style={styles.messageHeaderRow}>
                              <Text style={styles.messageUser}>
                                {msg.isUser ? tStr('trabajo_tu') : msg.user || 'Coach'}:
                              </Text>
                              {!!scopeLabel && (
                                <View
                                  style={[
                                    styles.scopeTag,
                                    scope === 'global' && styles.scopeTagGlobal,
                                    scope === 'plan' && styles.scopeTagPlan,
                                    scope === 'day' && styles.scopeTagDay,
                                    scope === 'plan+day' && styles.scopeTagBoth,
                                  ]}
                                >
                                  <Text style={styles.scopeTagText}>{scopeLabel}</Text>
                                </View>
                              )}
                            </View>
                            <Text style={styles.messageText}>{msg.text}</Text>
                            <Text style={styles.messageTime}>
                              {msg.timestamp
                                ? new Date(msg.timestamp).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : ''}
                            </Text>
                          </View>
                        );
                      })
                    ) : (
                      <View style={styles.emptyChatContainer}>
                        <Text style={styles.emptyChatText}>💬 {tStr('trabajo_empty_chat')}</Text>
                      </View>
                    )}
                  </ScrollView>
                </View>

                {/* Destinos de envío */}
                <View style={styles.sendTogglesRow}>
                  <TouchableOpacity
                    onPress={() => setSendToPlan((v) => !v)}
                    style={[styles.togglePill, sendToPlan && styles.togglePillActive]}
                  >
                    <Ionicons
                      name={sendToPlan ? 'checkbox' : 'square-outline'}
                      size={16}
                      color={t.brand}
                    />
                    <Text style={styles.toggleText}>{tStr('trabajo_al_plan')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setSendToDay((v) => !v)}
                    style={[styles.togglePill, sendToDay && styles.togglePillActive]}
                  >
                    <Ionicons
                      name={sendToDay ? 'checkbox' : 'square-outline'}
                      size={16}
                      color={t.brand}
                    />
                    <Text style={styles.toggleText}>{tStr('trabajo_a_este_dia')}</Text>
                  </TouchableOpacity>
                </View>

                {/* Input */}
                <View style={styles.chatInputContainer}>
                  <TextInput
                    style={styles.chatInput}
                    value={chatMessage}
                    onChangeText={setChatMessage}
                    placeholder={tStr('trabajo_placeholder_message')}
                    placeholderTextColor={t.placeholder}
                    multiline
                  />
                  <TouchableOpacity style={styles.chatSendButton} onPress={sendMessage}>
                    <Text style={styles.chatSendButtonText}>{tStr('trabajo_enviar')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </NeoPanel>
        </ScrollView>

        {/* MODAL RM */}
        <Modal
          visible={modalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setModalVisible(false)}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalBackdrop}>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingVertical: 16 }}
                showsVerticalScrollIndicator={false}
              >
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>{tStr('trabajo_modal_ajustar_rm')}</Text>
                <Text style={styles.modalSubtitle}>
                  {currentExercise}
                  {currentPercentage ? ` · ${currentPercentage}` : ''}
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder={tStr('trabajo_placeholder_rm')}
                  placeholderTextColor={t.placeholder}
                  keyboardType="numeric"
                  value={currentRM}
                  onChangeText={setCurrentRM}
                  autoFocus={!rmModalCalcOpen}
                />
                <TouchableOpacity
                  style={styles.rmCalcToggle}
                  onPress={() => setRmModalCalcOpen((v) => !v)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.rmCalcToggleText}>
                    {rmModalCalcOpen ? tStr('trabajo_rm_calc_hide') : tStr('trabajo_rm_calc_toggle')}
                  </Text>
                </TouchableOpacity>
                {rmModalCalcOpen ? (
                  <RmCalculatorPanel
                    tStr={tStr}
                    styles={styles}
                    placeholderColor={t.placeholder}
                    initialExercise={currentExercise}
                    compact
                    onApplyOneRm={(kg) => {
                      const s = formatRmWeightKg(kg);
                      if (s) setCurrentRM(s);
                    }}
                    onSaveOneRm={(name, kg) => {
                      saveRMFromCalculator(name, kg);
                      setCurrentExercise(name);
                      const s = formatRmWeightKg(kg);
                      if (s) setCurrentRM(s);
                    }}
                  />
                ) : null}
                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={() => setModalVisible(false)}
                  >
                    <Text style={styles.buttonText}>{tStr('common_cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.saveButtonModal]}
                    onPress={saveRM}
                  >
                    <Text style={styles.buttonText}>
                      {getRM(currentExercise) ? tStr('trabajo_actualizar') : tStr('trabajo_guardar')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      </KeyboardAvoidingView>
    </BackgroundWrapper>
  );
}
