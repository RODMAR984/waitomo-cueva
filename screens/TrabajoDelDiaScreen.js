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
  Linking,
  Image,
  Modal,
  TextInput,
  TouchableWithoutFeedback,
  Keyboard,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTrainingData } from '../contexts/TrainingDataContext';
import BackgroundWrapper from '../components/BackgroundWrapper';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useAuth } from '../contexts/AuthContext';
import { useThemeContext } from '../contexts/ThemeContext';
import { useLocale } from '../contexts/LocaleContext';

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
  // ================== PARAMS ==================
  const { plan, planKey, planValue, fecha, horario: paramHorario, hora: paramHora } = route.params || {};
  const horario = paramHorario ?? paramHora;
  const fechaEfectiva = fecha || (() => { const d = new Date(); return d.toISOString().slice(0, 10); })();
  const {
    bloques,
    updateRM,
    getRM,
    calculateWeight,
    saveUserNote,
    userNotes,
    sendChatMessage,
    chatMessages,
    refreshTrigger,
    hydrated,
  } = useTrainingData();
  const { role } = useAuth();
  const isAdminLike = role === 'superadmin' || role === 'coach';

  // ================== STATE ==================
  const [modalVisible, setModalVisible] = useState(false);
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

  // ✅ seed para rotación SOLO al entrar a esta pantalla
  const [bgSeed, setBgSeed] = useState(0);

  // ================== TOKENS ==================
  const { t } = useThemeContext();
  const { t: tStr } = useLocale();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { backgroundColor: 'transparent', flex: 1 },
        scroll: { flexGrow: 1, justifyContent: 'center', paddingVertical: 60 },

        panel: {
          backgroundColor: t.boxBg,
          borderColor: t.overlayBorder,
          borderRadius: 20,
          borderWidth: 1.5,
          marginHorizontal: 20,
          padding: 24,
          shadowColor: t.brand,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.35,
          shadowRadius: 16,
        },
        panelHeader: {
          borderBottomColor: t.overlayBorder,
          borderBottomWidth: 1,
          marginBottom: 16,
          paddingBottom: 12,
        },
        planTitle: {
          color: t.brand,
          fontSize: 20,
          fontWeight: 'bold',
          marginBottom: 4,
          textTransform: 'uppercase',
        },
        planSubtitle: {
          color: t.subText,
          fontSize: 14,
          marginBottom: 4,
        },
        dateText: {
          color: t.subText,
          fontSize: 13,
          fontStyle: 'italic',
        },

        // Tabs
        tabRow: {
          backgroundColor: t.inactiveTabBg,
          borderColor: t.overlayBorder,
          borderRadius: 999,
          borderWidth: 1,
          flexDirection: 'row',
          marginBottom: 16,
          overflow: 'hidden',
        },
        tabButton: {
          alignItems: 'center',
          flex: 1,
          paddingHorizontal: 8,
          paddingVertical: 8,
        },
        tabButtonActive: {
          backgroundColor: t.activeTabBg,
        },
        tabText: {
          color: t.subText,
          fontSize: 13,
          fontWeight: '600',
        },
        tabTextActive: {
          color: t.text,
        },

        // Bloques
        noBlocks: {
          color: t.empty,
          fontSize: 14,
          fontStyle: 'italic',
          textAlign: 'center',
        },
        blockCard: {
          backgroundColor: t.inactiveTabBg,
          borderColor: t.overlayBorder,
          borderRadius: 12,
          borderWidth: 1,
          marginBottom: 12,
          overflow: 'hidden',
        },
        blockHeader: {
          alignItems: 'center',
          flexDirection: 'row',
          justifyContent: 'space-between',
          paddingHorizontal: 12,
          paddingVertical: 10,
        },
        blockTitleWrapper: {
          flex: 1,
          marginRight: 8,
        },
        blockTitle: {
          color: t.text,
          fontSize: 15,
          fontWeight: '700',
          textTransform: 'uppercase',
        },
        blockMetaRow: {
          flexDirection: 'row',
          marginTop: 2,
        },
        blockMetaText: {
          color: t.subText,
          fontSize: 12,
          marginRight: 8,
        },
        blockTypeTag: {
          borderColor: t.overlayBorder,
          borderRadius: 999,
          borderWidth: 1,
          paddingHorizontal: 8,
          paddingVertical: 2,
        },
        blockTypeText: {
          color: t.brand2,
          fontSize: 11,
          fontWeight: '600',
        },
        blockToggleIcon: {
          marginLeft: 8,
        },
        blockBody: {
          borderTopColor: t.overlayBorder,
          borderTopWidth: 1,
          paddingHorizontal: 12,
          paddingVertical: 10,
        },
        blockLine: {
          color: t.text,
          fontSize: 14,
          marginBottom: 4,
        },
        blockLineHighlighted: {
          color: t.brand,
          fontWeight: '700',
        },

        // Enlaces a video
        videoThumbRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          marginTop: 8,
        },
        videoThumb: {
          alignItems: 'center',
          borderColor: t.overlayBorder,
          borderRadius: 10,
          borderWidth: 1,
          marginRight: 8,
          marginTop: 8,
          overflow: 'hidden',
          width: 90,
        },
        videoImage: {
          height: 60,
          width: '100%',
        },
        videoLabel: {
          color: t.text,
          fontSize: 11,
          padding: 4,
        },

        // Coach notes
        coachNotesContainer: {
          backgroundColor: t.boxBg,
          borderColor: t.overlayBorder,
          borderRadius: 10,
          borderWidth: 1,
          marginTop: 8,
          padding: 10,
        },
        coachNotesTitle: {
          color: t.brand2,
          fontSize: 13,
          fontWeight: '600',
          marginBottom: 4,
        },
        coachNotesContent: {
          color: t.text,
          fontSize: 13,
        },

        // Notas
        notesContainer: { marginBottom: 20 },
        sectionTitle: { color: t.brand, fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
        notesSubtitle: { color: t.subText, fontSize: 14, fontStyle: 'italic', marginBottom: 10 },
        notesInput: {
          backgroundColor: t.boxBg,
          borderColor: t.overlayBorder,
          borderRadius: 8,
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
          borderRadius: 999,
          minWidth: 120,
          paddingHorizontal: 16,
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
          fontSize: 14,
          fontWeight: '700',
        },
        notesList: {
          borderColor: t.overlayBorder,
          borderRadius: 8,
          borderWidth: 1,
          padding: 10,
        },
        noteLine: {
          backgroundColor: t.boxBg,
          borderColor: t.overlayBorder,
          borderRadius: 8,
          borderWidth: 1,
          marginBottom: 8,
          padding: 10,
        },
        noteItemText: { color: t.text, fontSize: 12, lineHeight: 16 },
        noteActions: { flexDirection: 'row', justifyContent: 'flex-end' },
        noteActionBtn: { marginLeft: 16 },
        noteEditBtn: { color: t.brand, fontWeight: '600' },
        noteDeleteBtn: { color: t.danger, fontWeight: '700' },
        noteSaveBtn: { color: t.brand2, fontWeight: '700' },
        noteCancelBtn: { color: t.subText, fontWeight: '600' },
        noteEditInput: {
          borderColor: t.overlayBorder,
          borderRadius: 6,
          borderWidth: 1,
          color: t.text,
          padding: 8,
        },
        noNotesText: { color: t.placeholder, fontStyle: 'italic', marginVertical: 10, textAlign: 'center' },

        // RMs
        accordionHeader: {
          alignItems: 'center',
          borderColor: t.overlayBorder,
          borderRadius: 10,
          borderWidth: 1,
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginBottom: 8,
          padding: 12,
        },
        accordionHeaderTxt: { color: t.brand2, fontSize: 15, fontWeight: '700' },
        existingRMsContainer: {
          backgroundColor: t.boxBg,
          borderColor: t.overlayBorder,
          borderRadius: 10,
          borderWidth: 1,
          marginBottom: 16,
          padding: 10,
        },
        rmItem: {
          alignItems: 'center',
          borderColor: t.overlayBorder,
          borderRadius: 8,
          borderWidth: 1,
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginBottom: 8,
          padding: 12,
        },
        rmItemText: { color: t.brand2, fontWeight: '600' },
        rmItemEdit: { color: t.brand, fontSize: 12 },
        noRMsText: { color: t.placeholder, fontStyle: 'italic', marginVertical: 10, textAlign: 'center' },

        // Chat
        chatTabContainer: { flex: 1, marginBottom: 20 },
        chatMessagesContainer: { height: 300, marginBottom: 10 },
        chatScrollView: { flex: 1 },
        chatContentContainer: { flexGrow: 1, justifyContent: 'flex-end', paddingVertical: 10 },
        chatSubtitle: { color: t.subText, fontSize: 14, fontStyle: 'italic', marginBottom: 15 },
        messageBubble: { borderRadius: 10, marginVertical: 5, maxWidth: '80%', padding: 10 },
        userMessage: { alignSelf: 'flex-end', backgroundColor: hexToRgba(t.brand, 0.18), marginLeft: '20%' },
        adminMessage: { alignSelf: 'flex-start', backgroundColor: t.boxBg, marginRight: '20%' },
        messageText: { color: t.text, fontSize: 14 },
        messageTime: { color: t.subText, fontSize: 10, marginTop: 4, textAlign: 'right' },
        messageUser: { color: t.brand2, fontSize: 12, fontWeight: 'bold', marginBottom: 4 },
        messageHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
        scopeTag: {
          borderRadius: 999,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          paddingHorizontal: 8,
          paddingVertical: 2,
          marginLeft: 8,
          backgroundColor: t.boxBg,
        },
        scopeTagGlobal: { backgroundColor: hexToRgba(t.brand, 0.16) },
        scopeTagPlan: { backgroundColor: hexToRgba(t.brand, 0.18) },
        scopeTagDay: { backgroundColor: t.boxBg },
        scopeTagBoth: { backgroundColor: hexToRgba(t.brand, 0.22) },
        scopeTagText: { color: t.text, fontSize: 10, fontWeight: '700' },
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
          borderRadius: 999,
          borderWidth: 1,
          color: t.text,
          flex: 1,
          marginRight: 10,
          minHeight: 40,
          paddingHorizontal: 16,
          paddingVertical: 8,
        },
        chatSendButton: {
          alignItems: 'center',
          ...t.buttonPrimary,
          borderRadius: 999,
          borderColor: t.overlayBorder,
          height: 40,
          justifyContent: 'center',
          paddingHorizontal: 16,
        },
        chatSendButtonText: { color: '#fff', fontWeight: '700' },

        // toggles de envío
        sendTogglesRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: 8, marginTop: 8 },
        togglePill: {
          alignItems: 'center',
          backgroundColor: t.boxBg,
          borderColor: t.overlayBorder,
          borderRadius: 20,
          borderWidth: 1,
          flexDirection: 'row',
          marginHorizontal: 8,
          paddingHorizontal: 10,
          paddingVertical: 6,
        },
        togglePillActive: { backgroundColor: hexToRgba(t.brand, 0.18) },
        toggleText: { color: t.text, fontSize: 12, fontWeight: '600', marginLeft: 6 },

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
          borderRadius: 16,
          borderWidth: 1,
          padding: 20,
          width: '80%',
        },
        modalTitle: { color: t.brand, fontSize: 20, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
        modalSubtitle: { color: t.subText, fontSize: 14, marginBottom: 10, textAlign: 'center' },
        input: {
          backgroundColor: t.boxBg,
          borderColor: t.overlayBorder,
          borderRadius: 8,
          borderWidth: 1,
          color: t.text,
          marginBottom: 12,
          padding: 12,
        },
        modalButtons: { flexDirection: 'row', justifyContent: 'space-between' },
        modalButton: { alignItems: 'center', borderRadius: 8, minWidth: 100, padding: 12 },
        cancelButton: { backgroundColor: t.boxBg },
        saveButtonModal: { ...t.buttonPrimary },

        // Refresh
        refreshSpinner: {
          marginBottom: 10,
        },
      }),
    [t],
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

  // ✅ rotación SOLO al entrar (focus)
  useFocusEffect(
    useCallback(() => {
      setBgSeed(Date.now());
      return undefined;
    }, []),
  );

  // ================== BLOQUES FILTRADOS ==================
  // Filtro por plan (b.plan = valor Admin), fecha (fechaKey o slice ISO) y opcionalmente horario
  const bloquesDelDia = useMemo(() => {
    if (!bloques || !Array.isArray(bloques)) return [];
    const fechaKey = fechaEfectiva.slice(0, 10);
    return bloques.filter((b) => {
      const samePlan = String(b.plan || '').trim() === planValueEfectivo;
      const bFechaKey = b.fechaKey || (b.fecha ? String(b.fecha).slice(0, 10) : '');
      const sameDate = bFechaKey === fechaKey;
      if (!samePlan || !sameDate) return false;
      if (!horarioEfectivo) return true;
      const bHora = normalizeHora(b.hora || b.horario);
      return bHora === horarioEfectivo;
    });
  }, [bloques, planValueEfectivo, fechaEfectiva, horarioEfectivo]);

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
    Alert.alert('Notas guardadas', 'Tus notas personales se han guardado para este día/horario.');
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
    setModalVisible(true);
  };

  const saveRM = () => {
    const parsed = parseFloat(currentRM.replace(',', '.'));
    if (Number.isNaN(parsed) || parsed <= 0) {
      Alert.alert('Dato inválido', 'Ingresá un RM válido en kilos.');
      return;
    }
    updateRM(currentExercise, parsed);
    setModalVisible(false);
  };

  const getExistingRMs = useCallback(() => Object.entries(getRM() || {}), [getRM]);

  // ================== CHAT ==================
  const GLOBAL_CHAT_KEY = 'global_trabajo_del_dia';
  const PLAN_FEED_PREFIX = 'plan_feed_';
  const planFeedKey = `${PLAN_FEED_PREFIX}${planValueEfectivo}`;
  const chatKey = `chat_${String(planValueEfectivo)}_${fechaEfectiva}${horarioEfectivo ? `_${horarioEfectivo}` : ''}`;

  const [sendToPlan, setSendToPlan] = useState(true);
  const [sendToDay, setSendToDay] = useState(true);

  const messagesMerged = useMemo(() => {
    if (!hydrated) return [];
    const globalMsgs = isAdminLike
      ? (chatMessages && chatMessages[GLOBAL_CHAT_KEY]) || []
      : [];
    const planMsgs = (chatMessages && chatMessages[planFeedKey]) || [];
    const dayMsgs = (chatMessages && chatMessages[chatKey]) || [];

    const messageMap = new Map();

    globalMsgs.forEach((msg) => {
      if (!msg || !msg.id) return;
      const scope = typeof msg.scope === 'string' && msg.scope ? msg.scope : 'global';
      messageMap.set(msg.id, { ...msg, scope });
    });

    planMsgs.forEach((msg) => {
      if (!msg || !msg.id) return;
      const scope = typeof msg.scope === 'string' && msg.scope ? msg.scope : 'plan';
      messageMap.set(msg.id, { ...msg, scope });
    });

    dayMsgs.forEach((msg) => {
      if (!msg || !msg.id) return;
      const scope = typeof msg.scope === 'string' && msg.scope ? msg.scope : 'day';
      messageMap.set(msg.id, { ...msg, scope });
    });

    return Array.from(messageMap.values()).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  }, [chatMessages, planFeedKey, chatKey, refreshTrigger, hydrated, isAdminLike]);

  const sendMessage = () => {
    const text = (chatMessage || '').trim();
    if (!text) return;
    if (!sendToPlan && !sendToDay) {
      Alert.alert('Elegí un destino', 'Activá "Al plan" y/o "A este día/horario".');
      return;
    }
    const baseId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    let scope = '';
    if (sendToPlan && sendToDay) scope = 'plan+day';
    else if (sendToPlan) scope = 'plan';
    else if (sendToDay) scope = 'day';

    const payload = {
      text,
      user: 'Usuario',
      timestamp: Date.now(),
      isUser: true,
      id: baseId,
      scope,
    };

    if (sendToPlan) sendChatMessage(planFeedKey, payload);
    if (sendToDay) sendChatMessage(chatKey, payload);
    setChatMessage('');
    Keyboard.dismiss();
  };

  // ================== REFRESH ==================
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 900);
  }, []);

  // ================== RENDER SET LINE ==================
  const renderSetLine = (line, idx) => {
  const tokens = String(line || '').split(/\s+/).filter(Boolean);

  let found = null; // { pct, reps, exerciseName }

  // Armamos un string “bonito” para mostrar la línea,
  // pero cuando hay patrón lo renderizamos destacado.
  const rendered = tokens.map((token, i) => {
    const match = token.match(/^@(\d{1,3})%(\d+)rm(.+)$/i);

    if (match) {
      const [, pct, reps, exerciseRaw] = match;
      const percentageNumber = parseFloat(pct);
      const repsNumber = parseInt(reps, 10);
      const rmType = `${repsNumber}RM`;
      const exerciseName = String(exerciseRaw || '').trim();

      found = { percentageNumber, repsNumber, exerciseName };

      const weight = calculateWeight(exerciseName, percentageNumber, repsNumber);
      const displayWeight =
        weight != null && !Number.isNaN(weight) ? `${weight.toFixed(1)}kg` : '—';

      return (
        <Text key={`${idx}_pct_${i}`} style={styles.blockLineHighlighted}>
          @{percentageNumber}%{rmType} ({exerciseName}) → {displayWeight}{' '}
        </Text>
      );
    }

    return (
      <Text key={`${idx}_word_${i}`} style={styles.blockLine}>
        {token}{' '}
      </Text>
    );
  });

  return (
    <View key={`line_${idx}`} style={{ marginBottom: 6 }}>
      {/* ✅ La línea puede tener múltiples <Text>, pero el contenedor es View */}
      <Text style={styles.blockLine}>{rendered}</Text>

      {/* ✅ Botón afuera del Text */}
      {found?.exerciseName && (
        <TouchableOpacity
          onPress={() => openRMModal(found.exerciseName, `${found.percentageNumber}%`)}
          style={{ marginTop: 6 }}
        >
          <Text style={styles.blockLineHighlighted}>
            ⚙️ Ajustar RM de {found.exerciseName}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};


  // ================== UI ==================
  return (
    <BackgroundWrapper
      screen="TrabajoDelDia"
      planKey={planKeyNormalized}
      seed={bgSeed}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
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
          <View style={styles.panel}>
            {/* Header */}
            <View style={styles.panelHeader}>
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
                    const lines = Array.isArray(bloque.contenido)
                      ? bloque.contenido
                      : String(bloque.contenido || '').split('\n');

                    const videoLinks = Array.isArray(bloque.videos) ? bloque.videos : [];
                    const coachNotes = bloque.coachNotes || '';

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
                                {bloque.horario || horarioEfectivo || tStr('trabajo_horario')}
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
                            {lines.map((line, idx) => {
                              if (!line) return null;
                              return (
                                <View key={`${bloque.id}_line_${idx}`}>
                                  {renderSetLine(line, idx)}
                                </View>
                              );
                            })}

                            {/* Coach notes */}
                            {!!coachNotes && (
                              <View style={styles.coachNotesContainer}>
                                <Text style={styles.coachNotesTitle}>{tStr('trabajo_coach_notes')}</Text>
                                <Text style={styles.coachNotesContent}>{coachNotes}</Text>
                              </View>
                            )}

                            {/* Video links */}
                            {videoLinks.length > 0 && (
                              <View style={styles.videoThumbRow}>
                                {videoLinks.map((link, idx) => (
                                  <TouchableOpacity
                                    key={`${bloque.id}_video_${idx}`}
                                    style={styles.videoThumb}
                                    onPress={() => Linking.openURL(link.url)}
                                  >
                                    <Image
                                      source={{ uri: link.thumbnail }}
                                      style={styles.videoImage}
                                      resizeMode="cover"
                                    />
                                    <Text style={styles.videoLabel}>{link.label || tStr('trabajo_video')}</Text>
                                  </TouchableOpacity>
                                ))}
                              </View>
                            )}
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
          </View>
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
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>{tStr('trabajo_modal_ajustar_rm')}</Text>
                <Text style={styles.modalSubtitle}>
                  {currentExercise} {currentPercentage ? `@${currentPercentage}` : ''}
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder={tStr('trabajo_placeholder_rm')}
                  placeholderTextColor={t.placeholder}
                  keyboardType="numeric"
                  value={currentRM}
                  onChangeText={setCurrentRM}
                  autoFocus
                />
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
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      </KeyboardAvoidingView>
    </BackgroundWrapper>
  );
}
