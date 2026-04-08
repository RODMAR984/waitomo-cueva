// screens/AdminScreen.js — Waitomo (modo claro y oscuro)
// - Paneles e inputs con tokens de tema (t.boxBg, t.inputBg) para coach/superadmin
// - Crear, copiar, pegar, mover y EDITAR bloques; selector de fecha con calendario

import React, { useState, useMemo, memo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Keyboard,
  Dimensions,
  TouchableWithoutFeedback,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';

import BackgroundWrapper from '../components/BackgroundWrapper';
import { useTrainingData } from '../contexts/TrainingDataContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabaseClient';
import { colors } from '../theme/colors';
import { useThemeContext } from '../contexts/ThemeContext';
import { useLocale } from '../contexts/LocaleContext';

const PLAN_VALUE_TO_CHAT_PLAN_ID = {
  cross_training: 'cross',
  hyrox: 'hyrox',
  ciclo_evolucion: 'evolucion',
  stretching: 'stretching',
  yoga: 'yoga',
  open_box: 'openbox',
};

const { width } = Dimensions.get('window');

// Teal oscuro Waitomo para paneles/inputs (base fija, sin verdes)
const BASE_TEAL = '#021b23';
const BASE_TEAL_SOFT = '#032b36';

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
    return new Date(d).toISOString().split('T')[0];
  } catch {
    return '';
  }
};

const detectarRM = (texto) => {
  if (!texto || typeof texto !== 'string') return [];
  const rx = /@\d+%\d*rm[a-záéíóúñ() ]*/gi;
  return texto.match(rx) || [];
};

const sumarDias = (baseDate, delta) => {
  const d = new Date(baseDate);
  d.setDate(d.getDate() + delta);
  return d;
};

const RMText = memo(({ children, styles }) => (
  <Text style={styles.rmText}>{children}</Text>
));

const renderPreviewWithRM = (text, styles) => {
  if (!text) return <Text style={styles.previewText}>—</Text>;
  const regex = /@\d+%\d*rm[a-zA-Záéíóúñ() ]*/gi;
  const parts = text.split(regex);
  const matches = text.match(regex) || [];
  const out = [];
  for (let i = 0; i < parts.length; i += 1) {
    out.push(
      <Text key={`p_${i}`} style={styles.previewText}>
        {parts[i]}
      </Text>,
    );
    if (matches[i]) {
      out.push(
        <RMText key={`rm_${i}`} styles={styles}>
          {matches[i]}
        </RMText>,
      );
    }
  }
  return out;
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
      {open && (
        <TouchableWithoutFeedback onPress={() => setOpen(false)}>
          <View style={styles.dropdownBackdrop}>
            <View
              style={styles.dropdownList}
              onStartShouldSetResponder={() => true}
            >
              <View style={styles.dropdownListHeader}>
                <Text style={styles.dropdownListHeaderText}>{tStr('admin_horarios')}</Text>
              </View>
              <ScrollView
                style={styles.dropdownHoursScroll}
                contentContainerStyle={styles.dropdownHoursScrollContent}
                showsVerticalScrollIndicator={true}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
              >
                {items.map((label) => {
                  const selected = horariosSeleccionados.includes(label);
                  return (
                    <TouchableOpacity
                      key={label}
                      onPress={() => toggleHour(label)}
                      style={[
                        styles.dropdownItem,
                        selected && styles.dropdownItemSelected,
                      ]}
                    >
                      <Text style={styles.dropdownItemText}>{label}</Text>
                      {selected && (
                        <Ionicons name="checkmark" size={18} color={t.brand} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <View style={styles.dropdownActions}>
                <TouchableOpacity
                  onPress={() => setOpen(false)}
                  style={styles.dropdownDoneBtn}
                >
                  <Text style={styles.dropdownDoneText}>{tStr('admin_listo')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      )}
    </View>
  );
});

export default function AdminScreen(props) {
  const navigation = useNavigation();
  const route = useRoute();
  const { t } = useThemeContext();
  const { t: tStr, locale } = useLocale();
  const dateLocale = locale === 'en' ? 'en-US' : 'es-ES';

  const mode = (props && props.mode) || route?.params?.mode || 'full';
  const isLite = mode === 'lite';

  const { bloques, saveBloques, refreshTrigger } = useTrainingData();
  const { currentUser, rolesByUser, isSuperAdmin, logout, profile, organization } = useAuth();
  const myId = currentUser?.id || null;
  const myRole = rolesByUser?.[myId];
  const isSA = !!(myId && isSuperAdmin(myId));
  const isCoach = myRole === 'coach';
  const isOrgCoach = organization?.type === 'coach';
  const isOrgGym = organization?.type === 'gym' || !organization?.type;
  const coachPlanActual = profile?.plan_actual ? String(profile.plan_actual) : null;

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
    (isCoach && coachPlanActual && PLANS.some((p) => p.value === coachPlanActual) ? coachPlanActual : null) ||
    'cross_training';
  const [planSeleccionado, setPlanSeleccionado] = useState(initialPlan || 'cross_training');

  useEffect(() => {
    if (isCoach && coachPlanActual && PLANS.some((p) => p.value === coachPlanActual)) {
      setPlanSeleccionado(coachPlanActual);
    }
  }, [isCoach, coachPlanActual]);

  const plansDisponibles = useMemo(() => {
    if (isSA) return PLANS;
    if (isCoach && coachPlanActual) {
      const one = PLANS.find((p) => p.value === coachPlanActual);
      return one ? [one] : PLANS;
    }
    return PLANS;
  }, [isSA, isCoach, coachPlanActual]);

  const [fecha, setFecha] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [horariosSeleccionados, setHorariosSeleccionados] = useState([]);

  const [titulo, setTitulo] = useState('');
  const [contenido, setContenido] = useState('');
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


  const policy = useMemo(
    () => PLANS.find((p) => p.value === planSeleccionado)?.policy || 'SHARED',
    [planSeleccionado],
  );
  const isPartitioned = policy === 'PARTITIONED';

  const bloquesPlanOrdenados = useMemo(() => {
    let lista = (Array.isArray(bloques) ? [...bloques] : []).filter(
      (b) => (b?.plan || '') === planSeleccionado,
    );
    if (!isSA && isCoach && isPartitioned && myId) {
      lista = lista.filter((b) => (b.coachId || null) === myId);
    }
    return lista.sort(
      (a, b) => new Date(a.fecha || 0) - new Date(b.fecha || 0),
    );
  }, [bloques, planSeleccionado, refreshTrigger, isSA, isCoach, isPartitioned, myId]);

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

  const chatPlanId = PLAN_VALUE_TO_CHAT_PLAN_ID[planSeleccionado] || planSeleccionado;
  const irAlChatDelPlan = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_channels')
        .select('id, name')
        .eq('plan_id', chatPlanId)
        .maybeSingle();
      if (error) throw error;
      if (data?.id) {
        navigation.navigate('Chat', { channelId: data.id, channelName: data.name || planSeleccionado });
      } else {
        Alert.alert('Sin canal', `Aún no hay canal de chat para el plan "${planSeleccionado}". Creá uno en Supabase (chat_channels).`);
      }
    } catch (e) {
      Alert.alert('Error', e?.message || 'No se pudo abrir el chat.');
    }
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, backgroundColor: 'transparent' },
        scrollContainer: { paddingVertical: 40 },

        panel: {
          alignSelf: 'center',
          backgroundColor: t.boxBg,
          borderColor: t.overlayBorder,
          borderRadius: 16,
          borderWidth: 1,
          marginBottom: 30,
          padding: 20,
          width: width > 500 ? '90%' : '100%',
        },

        headerRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        },
        headerTitle: {
          color: t.text,
          fontSize: 13,
          fontWeight: '600',
        },
        headerLogoutBtn: {
          paddingVertical: 8,
          paddingHorizontal: 14,
          borderRadius: 10,
          ...t.buttonPrimary,
        },
        headerLogout: {
          ...t.buttonPrimaryText,
          fontSize: 13,
        },

        title: {
          color: t.text,
          fontSize: 22,
          fontWeight: 'bold',
          marginBottom: 20,
          textAlign: 'center',
        },

        fs12: { fontSize: 12 },
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
          fontSize: 14,
          fontWeight: '600',
          marginBottom: 8,
        },

        input: {
          backgroundColor: t.inputBg,
          borderColor: t.overlayBorder,
          borderRadius: 10,
          borderWidth: 1,
          color: t.text,
          marginBottom: 12,
          padding: 12,
        },
        textarea: {
          backgroundColor: t.inputBg,
          borderColor: t.overlayBorder,
          borderRadius: 10,
          borderWidth: 1,
          color: t.text,
          marginBottom: 12,
          padding: 12,
        },

        primaryBtn: {
          alignItems: 'center',
          ...t.buttonPrimary,
          borderRadius: 10,
          marginBottom: 14,
          marginTop: 4,
          padding: 12,
        },
        primaryBtnTextOn: t.buttonPrimaryText,

        financeBtn: {
          alignSelf: 'flex-end',
          ...t.buttonPrimary,
          borderRadius: 8,
          marginBottom: 10,
          paddingHorizontal: 12,
          paddingVertical: 8,
        },
        financeBtnText: t.buttonPrimaryText,

        dropdown: {
          alignItems: 'center',
          backgroundColor: t.inputBg,
          borderColor: t.overlayBorder,
          borderRadius: 10,
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
        dropdownList: {
          backgroundColor: '#0e252e',
          borderColor: colors.brand.primary,
          borderRadius: 16,
          borderWidth: 2,
          width: '90%',
          height: 400,
          overflow: 'hidden',
          shadowColor: '#000000',
          shadowOpacity: 0.55,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 6 },
          elevation: 22,
        },
        dropdownListHeader: {
          paddingVertical: 12,
          paddingHorizontal: 16,
          borderBottomWidth: 1,
          borderBottomColor: hexToRgbaLocal(colors.brand.primary, 0.4),
          backgroundColor: hexToRgbaLocal(colors.brand.primary, 0.12),
        },
        dropdownListHeaderText: {
          color: colors.brand.primary,
          fontSize: 16,
          fontWeight: '700',
        },

        dropdownScroll: { maxHeight: 220 },
        dropdownHoursScroll: {
          flex: 1,
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
        dropdownItemText: { color: t.text, fontSize: 16 },

        dropdownActions: {
          paddingHorizontal: 12,
          paddingVertical: 10,
          alignItems: 'flex-end',
          backgroundColor: '#0e252e',
        },
        dropdownDoneBtn: {
          paddingHorizontal: 16,
          paddingVertical: 8,
          borderRadius: 999,
          ...t.buttonPrimary,
        },
        dropdownDoneText: {
          fontSize: 13,
          fontWeight: '600',
          ...t.buttonPrimaryText,
        },

        previewWrap: {
          backgroundColor: hexToRgbaLocal(t.brand, 0.14),
          borderRadius: 8,
          marginTop: 10,
          padding: 10,
        },
        previewTitle: { color: t.text, fontWeight: '600' },
        previewRow: { flexDirection: 'row', flexWrap: 'wrap' },
        previewText: { color: t.text },
        rmText: {
          backgroundColor: hexToRgbaLocal(t.brand, 0.12),
          borderRadius: 4,
          color: t.text,
          fontWeight: 'bold',
          paddingHorizontal: 4,
        },

        bloqueCard: {
          backgroundColor: t.inputBg,
          borderColor: t.overlayBorder,
          borderRadius: 10,
          borderWidth: 1,
          marginBottom: 14,
          padding: 12,
        },
        bloqueTitle: { color: t.text, fontWeight: 'bold' },
        bloqueMeta: { color: t.text, fontSize: 12, opacity: 0.85 },
        bloqueCoach: { color: t.text, fontSize: 11, opacity: 0.75 },

        iconButton: { alignItems: 'center' },
        iconText: { color: t.text, fontSize: 12, marginTop: 2 },

        noteBox: {
          marginTop: 6,
          padding: 8,
          backgroundColor: hexToRgbaLocal(t.brand, 0.14),
          borderRadius: 8,
          borderWidth: 1,
          borderColor: t.overlayBorder,
        },
        noteTitle: { color: t.text, fontWeight: '600' },
        noteText: { color: t.text },

        videoLink: { color: t.text, fontSize: 12, marginTop: 2 },

        chatContainer: {
          backgroundColor: t.inputBg,
          borderColor: t.overlayBorder,
          borderRadius: 10,
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
          fontSize: 12,
          fontWeight: 'bold',
          marginBottom: 4,
        },
        messageText: { color: t.text, fontSize: 14 },
        messageTime: {
          color: t.text,
          fontSize: 10,
          marginTop: 4,
          textAlign: 'right',
          opacity: 0.8,
        },
        emptyChatContainer: { alignItems: 'center', padding: 20 },
        emptyChatText: { color: t.placeholder, fontStyle: 'italic' },

        sendButton: {
          backgroundColor: hexToRgbaLocal(t.brand, 0.08),
          borderColor: t.brand,
          borderRadius: 10,
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
          borderRadius: 20,
          borderWidth: 1,
          paddingHorizontal: 16,
          paddingVertical: 8,
        },
        togglePillActive: { backgroundColor: t.brand },
        toggleText: { color: t.text, fontWeight: '600' },

        modalOverlay: {
          alignItems: 'center',
          backgroundColor: hexToRgbaLocal(t.text, 0.7),
          flex: 1,
          justifyContent: 'center',
        },
        modalContent: {
          backgroundColor: t.boxBg,
          borderColor: t.overlayBorder,
          borderRadius: 15,
          borderWidth: 1,
          maxHeight: '90%',
          padding: 20,
        },
        modalTitle: {
          color: t.text,
          fontSize: 18,
          fontWeight: 'bold',
          textAlign: 'center',
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
    [t],
  );

  const updateBloquesArray = async (modifier) => {
    const arr = Array.isArray(bloques) ? [...bloques] : [];
    const updated = modifier(arr);
    await saveBloques(updated);
  };

  const crearBloques = async () => {
    if (!titulo.trim() || !contenido.trim()) {
      Alert.alert('Faltan datos', 'Completá título y contenido.');
      return;
    }

    if (editingBlockId) {
      await updateBloquesArray((arr) =>
        arr.map((b) =>
          b.id === editingBlockId
            ? {
                ...b,
                titulo: titulo.trim(),
                contenido: contenido.trim(),
                notas: coachNotes.trim(),
                videoLinks: videoLinks
                  .split('\n')
                  .map((s) => s.trim())
                  .filter(Boolean),
                rmTags: detectarRM(contenido),
              }
            : b,
        ),
      );
      Alert.alert('Actualizado', 'Bloque actualizado.');
      setEditingBlockId(null);
      setCoachNotes('');
      setVideoLinks('');
      setContenido('');
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
        coachId: myId || 'superadmin',
        id: `b_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,

        plan: planSeleccionado,
        fecha: d.toISOString(),
        fechaKey: fk,
        hora: h,
        titulo: titulo.trim(),
        contenido: contenido.trim(),
        notas: coachNotes.trim(),
        videoLinks: videoLinks
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        rmTags: detectarRM(contenido),
      };
    });
    await updateBloquesArray((arr) => [...arr, ...nuevos]);
    Alert.alert(tStr('admin_listo'), tStr('admin_creados_ok').replace('%d', String(nuevos.length)));
    setTitulo('');
    setContenido('');
    setCoachNotes('');
    setVideoLinks('');
    // NO limpiamos horariosSeleccionados acá para poder seguir creando bloques en el mismo/los mismos horarios
  };

  const guardiaPropietario = (b, accion = 'editar') => {
    if (isSA) return true;
    if (!isPartitioned) return true;
    if ((b.coachId || null) === myId) return true;
    Alert.alert('No autorizado', `Solo el dueño del bloque puede ${accion}.`);
    return false;
  };

  const copiarBloque = (b) => {
    if (guardiaPropietario(b, 'copiar')) {
      setClipboardBloque(b);
      Alert.alert('Copiado', 'Bloque copiado');
    }
  };

  const pegarEnHorarios = async () => {
    if (!clipboardBloque) {
      Alert.alert('Nada para pegar', 'Copiá un bloque primero.');
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
        plan: planSeleccionado,
        fecha: d.toISOString(),
        fechaKey: fk,
        hora: h,
        coachId: myId || clipboardBloque.coachId,
      };
    });
    await updateBloquesArray((arr) => [...arr, ...clones]);
    Alert.alert('Pegado', `Se pegó en ${clones.length} horario(s).`);
  };

  const empezarEdicion = (b) => {
    if (!guardiaPropietario(b, 'editar')) return;
    setEditingBlockId(b.id);
    setPlanSeleccionado(b.plan || planSeleccionado);
    setFecha(new Date(b.fecha));
    setHorariosSeleccionados([b.hora]);
    setTitulo(b.titulo || '');
    setContenido(b.contenido || '');
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
    const fk = iso.split('T')[0];
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
          {!!b.coachId && (
            <Text style={styles.bloqueCoach}>{tStr('admin_coach')} {b.coachId}</Text>
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
        <View style={[styles.mt6, styles.rowWrap]}>
          {renderPreviewWithRM(b.contenido, styles)}
        </View>
      )}
      {!!b.notas && (
        <View style={styles.noteBox}>
          <Text style={styles.noteTitle}>{tStr('admin_notas_coach_label')}</Text>
          <Text style={styles.noteText}>{b.notas}</Text>
        </View>
      )}
      {Array.isArray(b.videoLinks) &&
        b.videoLinks.map((u, i) => (
          <Text key={`${b.id}-v-${i}`} style={styles.videoLink}>
            🔗 {u}
          </Text>
        ))}
    </View>
  );

  return (
    <BackgroundWrapper screen="admin">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.screen}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.panel}>
            <View style={styles.headerRow}>
              <Text style={styles.headerTitle}>{tStr('admin_panel')}</Text>
              <TouchableOpacity style={styles.headerLogoutBtn} onPress={handleLogout}>
                <Text style={styles.headerLogout}>{tStr('admin_salir')}</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.title}>{tStr('admin_title')}</Text>

            <TouchableOpacity
              onPress={() => navigation.navigate('Perfil')}
              style={styles.financeBtn}
            >
              <Text style={styles.financeBtnText}>👤 {tStr('admin_mi_perfil')}</Text>
            </TouchableOpacity>

            {!isLite && (
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate('AdminFinanzas', { tab: 'cobros' })
                }
                style={styles.financeBtn}
              >
                <Text style={styles.financeBtnText}>💰 {tStr('admin_finanzas')}</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={() => navigation.navigate('Novedades')}
              style={styles.financeBtn}
            >
              <Text style={styles.financeBtnText}>📢 {tStr('admin_ver_novedades')}</Text>
            </TouchableOpacity>

            {!isLite && (
              <TouchableOpacity
                onPress={() => navigation.navigate('AdminNovedades')}
                style={styles.financeBtn}
              >
                <Text style={styles.financeBtnText}>✏️ {tStr('admin_gestionar_novedades')}</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={() => navigation.navigate('GymConfig')}
              style={styles.financeBtn}
            >
              <Text style={styles.financeBtnText}>
                🏢 {isOrgCoach ? tStr('admin_mi_configuracion') : 'Configuración del gym'}
              </Text>
            </TouchableOpacity>

            {!isLite && (
              <TouchableOpacity
                onPress={() => navigation.navigate('AdminPlanes')}
                style={styles.financeBtn}
              >
                <Text style={styles.financeBtnText}>📋 Planes</Text>
              </TouchableOpacity>
            )}

            {!isLite && (
              <TouchableOpacity
                onPress={() => navigation.navigate('AdminAbonos')}
                style={styles.financeBtn}
              >
                <Text style={styles.financeBtnText}>🎫 Abonos</Text>
              </TouchableOpacity>
            )}

            {isCoach && !coachPlanActual ? (
              <View style={styles.block}>
                <Text style={styles.label}>{tStr('admin_plan')}</Text>
                <Text style={[styles.fs12, styles.tacSubtle, { color: t.placeholder, marginTop: 4 }]}>
                  {tStr('admin_sin_plan')}
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

            <Text style={styles.label}>{tStr('admin_titulo')}</Text>
            <TextInput
              value={titulo}
              onChangeText={setTitulo}
              placeholder={tStr('admin_placeholder_titulo')}
              placeholderTextColor={t.placeholder}
              style={styles.input}
            />

            <Text style={styles.label}>{tStr('admin_contenido')}</Text>
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
              <View style={styles.previewRow}>
                {renderPreviewWithRM(contenido, styles)}
              </View>
            </View>

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

            <TouchableOpacity onPress={crearBloques} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnTextOn}>
                {isEditing ? tStr('admin_actualizar_bloque') : tStr('admin_crear_bloques')}
              </Text>
            </TouchableOpacity>

            {clipboardBloque && !isEditing && (
              <TouchableOpacity
                onPress={pegarEnHorarios}
                style={styles.primaryBtn}
              >
                <Text style={styles.primaryBtnTextOn}>
                  {tStr('admin_pegar_horarios')}
                </Text>
              </TouchableOpacity>
            )}

            <Text style={[styles.title, styles.mt24]}>{tStr('admin_ultimos_dias')}</Text>
            {lastWeekBlocks.length === 0 ? (
              <Text style={styles.tacPlaceholder}>
                {tStr('admin_sin_bloques')}
              </Text>
            ) : (
              lastWeekBlocks.map((b) => <BloqueCard key={b.id} b={b} />)
            )}

            <Text style={[styles.title, styles.mt24]}>{tStr('admin_historico')}</Text>
            {historicBlocks.length === 0 ? (
              <Text style={styles.tacPlaceholder}>{tStr('admin_sin_historico')}</Text>
            ) : (
              historicBlocks.map((b) => <BloqueCard key={b.id} b={b} />)
            )}

            <Text style={[styles.title, styles.mt24]}>{tStr('admin_chat_plan')}</Text>
            <TouchableOpacity
              onPress={irAlChatDelPlan}
              style={[styles.primaryBtn, { marginTop: 8 }]}
            >
              <Text style={styles.primaryBtnTextOn}>
                {tStr('admin_ir_chat')} — {plansDisponibles.find((p) => p.value === planSeleccionado)?.label || planSeleccionado}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={moveModalVisible} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => setMoveModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
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
