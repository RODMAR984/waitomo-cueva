// screens/AdminFinanzasScreen.js
// Módulo de finanzas: cobros, suscripciones, métodos de pago, reportes y caja (libro diario).
// Soporta ARS, USD, EUR. Confirmaciones en acciones destructivas. Copy formal.

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  TextInput,
} from 'react-native';
import PropTypes from 'prop-types';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import BackgroundWrapper from '../components/BackgroundWrapper';
import { useTrainingData } from '../contexts/TrainingDataContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabaseClient';
import { colors } from '../theme/colors';
import { useThemeContext } from '../contexts/ThemeContext';
import { useLocale } from '../contexts/LocaleContext';
import { WEB_CONTENT_MAX_WIDTH, WEB_PANEL_RADIUS } from '../theme/webSpec';
import { MOBILE_RADII, MOBILE_SIZES, MOBILE_SPACING, MOBILE_TYPE } from '../theme/mobileSpec';

const SUPPORTED_CURRENCIES = ['ARS', 'USD', 'EUR'];

const formatMonto = (num, moneda = 'ARS') => {
  const n = Number(num);
  if (Number.isNaN(n)) return '0';
  const decimals = moneda === 'ARS' ? 0 : 2;
  const locale = moneda === 'ARS' ? 'es-AR' : 'en-US';
  const s = Math.abs(n).toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${n < 0 ? '-' : ''}${s} ${moneda}`;
};

export default function AdminFinanzasScreen({ route }) {
  const insets = useSafeAreaInsets();
  const { t } = useThemeContext();
  const { t: tStr, locale } = useLocale();
  const { organization } = useAuth() || {};

  const payMethods = useMemo(
    () => [
      { id: 'efectivo', label: tStr('fin_pay_efectivo') },
      { id: 'transferencia', label: tStr('fin_pay_transferencia') },
      { id: 'qr', label: tStr('fin_pay_qr') },
      { id: 'mercadopago', label: tStr('fin_pay_mercadopago') },
      { id: 'cuenta_dni', label: tStr('fin_pay_cuenta_dni') },
      { id: 'otro', label: tStr('fin_pay_otro') },
    ],
    [tStr],
  );

  const outcomeSources = useMemo(
    () => [
      { id: 'efectivo', label: tStr('fin_out_efectivo') },
      { id: 'cuenta_bancaria', label: tStr('fin_out_cuenta') },
      { id: 'billetera', label: tStr('fin_out_billetera') },
    ],
    [tStr],
  );

  const payLabel = (id) => payMethods.find((x) => x.id === id)?.label || id;
  const outLabel = (id) => outcomeSources.find((x) => x.id === id)?.label || id;

  const formatDateTime = useCallback(
    (ts) => {
      const d = new Date(ts);
      const loc = locale === 'en' ? 'en-US' : 'es-AR';
      return d.toLocaleDateString(loc, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    },
    [locale],
  );

  const {
    payments,
    subscriptions,
    ledger,
    createPayment,
    markAsPaid,
    markAsPartial,
    refundPayment,
    getPayments,
    createSubscription,
    cancelSubscription,
    generateNextInvoices,
    addLedgerEntry,
    editLedgerEntry,
    deleteLedgerEntry,
    getLedgerSummary,
    getOpenBalance,
    setOpenBalance,
  } = useTrainingData();

  const [tab, setTab] = useState(route?.params?.tab || 'caja');
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const startOfToday = useMemo(
    () => new Date(new Date().setHours(0, 0, 0, 0)).getTime(),
    [todayStr],
  );
  const endOfToday = useMemo(
    () => new Date(new Date().setHours(23, 59, 59, 999)).getTime(),
    [todayStr],
  );

  // -------- Caja (libro diario) --------
  const [cajaInicialInput, setCajaInicialInput] = useState('');
  const [medioIngreso, setMedioIngreso] = useState('efectivo');
  const [montoIngreso, setMontoIngreso] = useState('');
  const [conceptoIngreso, setConceptoIngreso] = useState('');
  const [origenSalida, setOrigenSalida] = useState('efectivo');
  const [montoSalida, setMontoSalida] = useState('');
  const [conceptoSalida, setConceptoSalida] = useState('');
  const [soloHoy, setSoloHoy] = useState(true);
  const [editingLedgerId, setEditingLedgerId] = useState(null);
  const [editingLedgerNota, setEditingLedgerNota] = useState('');

  // -------- Pendientes (cobros + suscripciones) --------
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroMetodo, setFiltroMetodo] = useState('');
  const [showNuevoCobro, setShowNuevoCobro] = useState(false);
  const [nuevoCobroMonto, setNuevoCobroMonto] = useState('');
  const [nuevoCobroMoneda, setNuevoCobroMoneda] = useState('ARS');
  const [nuevoCobroMetodo, setNuevoCobroMetodo] = useState('efectivo');
  const [nuevoCobroRef, setNuevoCobroRef] = useState('');
  const [showNuevaSub, setShowNuevaSub] = useState(false);
  const [nuevaSubUserId, setNuevaSubUserId] = useState('');
  const [nuevaSubPlanId, setNuevaSubPlanId] = useState('');
  const [nuevaSubPrecio, setNuevaSubPrecio] = useState('');
  const [nuevaSubMoneda, setNuevaSubMoneda] = useState('ARS');
  const [nuevaSubDiaVenc, setNuevaSubDiaVenc] = useState('5');
  const [orgMemberPicklist, setOrgMemberPicklist] = useState([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const oid = organization?.id;
      if (!oid) {
        if (alive) setOrgMemberPicklist([]);
        return;
      }
      try {
        const { data: mems, error: e1 } = await supabase
          .from('organization_memberships')
          .select('user_id')
          .eq('organization_id', oid)
          .eq('active', true);
        if (e1) throw e1;
        const ids = [...new Set((mems || []).map((m) => m.user_id).filter(Boolean))];
        if (!ids.length) {
          if (alive) setOrgMemberPicklist([]);
          return;
        }
        const { data: profs, error: e2 } = await supabase
          .from('profiles')
          .select('id, full_name, username')
          .in('id', ids);
        if (e2) throw e2;
        const list = (profs || [])
          .map((p) => ({
            id: p.id,
            label: (p.full_name || p.username || p.id).trim(),
          }))
          .sort((a, b) => a.label.localeCompare(b.label, locale === 'en' ? 'en' : 'es'));
        if (alive) setOrgMemberPicklist(list);
      } catch {
        if (alive) setOrgMemberPicklist([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [organization?.id, locale]);

  // estilos
  const styles = useMemo(
    () =>
      StyleSheet.create({
        safe: { backgroundColor: 'transparent', flex: 1, paddingTop: insets.top + 8 },
        container: { flex: 1 },
        contentContainer: {
          padding: MOBILE_SPACING.lg,
          paddingBottom: 28,
          width: '100%',
          maxWidth: WEB_CONTENT_MAX_WIDTH,
          alignSelf: 'center',
        },

        // tabs
        tabs: {
          backgroundColor: t.boxBg,
          borderBottomWidth: 1,
          borderColor: t.overlayBorder,
          flexDirection: 'row',
        },
        tab: { alignItems: 'center', flex: 1, padding: 12 },
        activeTab: { backgroundColor: t.faintStrong },
        tabText: { color: t.brand, fontWeight: '600' },

        // tipografías
        sectionTitle: {
          color: t.brand,
          fontSize: 18,
          fontWeight: 'bold',
          marginBottom: 10,
        },
        infoText: { color: t.subText, marginBottom: 8 },
        label: { color: t.subText, minWidth: 70 },
        emptyText: { color: t.empty, fontStyle: 'italic' },
        cardTitle: { color: t.brand, fontWeight: '700', marginBottom: 4 },
        cardLine: { color: t.text },

        // tarjetas/paneles
        card: {
          backgroundColor: t.boxBg,
          borderColor: t.overlayBorder,
          borderRadius: WEB_PANEL_RADIUS,
          borderWidth: 1,
          marginBottom: 10,
          padding: 12,
        },

        // inputs (UNIFICADO)
        input: {
          backgroundColor: t.inputBg,
          borderColor: t.overlayBorder,
          borderRadius: MOBILE_RADII.md,
          borderWidth: 1,
          color: t.text,
          flex: 1,
          padding: 10,
        },

        // filas/grupos
        row: {
          alignItems: 'center',
          flexDirection: 'row',
          gap: 10,
          marginBottom: 10,
        },
        memberPickScroll: { marginBottom: 8, maxHeight: MOBILE_SIZES.controlHeight },
        memberChip: {
          paddingHorizontal: 10,
          paddingVertical: 8,
          borderRadius: MOBILE_RADII.md,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          backgroundColor: t.faintStrong,
          marginRight: 8,
        },
        memberChipText: { color: t.text, fontSize: MOBILE_TYPE.caption, fontWeight: '600' },
        btnRow: { flexDirection: 'row', gap: 12, marginVertical: 10 },
        cardActions: { flexDirection: 'row', gap: 12, marginTop: 8 },

        // botones (unificado: outline, no bloque cyan)
        btn: {
          alignSelf: 'flex-start',
          ...t.buttonPrimary,
          borderRadius: MOBILE_RADII.md,
          paddingHorizontal: 14,
          paddingVertical: 10,
        },
        btnText: t.buttonPrimaryText,
        smallBtn: {
          backgroundColor: t.faintStrong,
          borderColor: t.brand,
          borderRadius: 6,
          borderWidth: 1,
          paddingHorizontal: 10,
          paddingVertical: 6,
        },
        smallBtnDanger: {
          backgroundColor: t.faintStrong,
          borderColor: t.danger,
          borderRadius: 6,
          borderWidth: 1,
          paddingHorizontal: 10,
          paddingVertical: 6,
        },
        smallBtnText: { color: t.text, fontWeight: '600' },

        // pills
        pillRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 },
        pill: {
          borderColor: t.overlayBorder,
          borderRadius: 20,
          borderWidth: 1,
          marginRight: 8,
          marginBottom: 4,
          paddingHorizontal: 10,
          paddingVertical: 6,
        },
        pillActive: { backgroundColor: t.overlayBg },
        pillText: { color: t.brand, fontWeight: '600' },

        // espaciadores
        spacerSm: { height: 12 },
      }),
    [insets.top, t],
  );

  const cajaInicialHoy = getOpenBalance(todayStr);
  const resumenDia = useMemo(
    () => getLedgerSummary({ from: startOfToday, to: endOfToday }),
    [ledger, getLedgerSummary, startOfToday, endOfToday],
  );
  const resumenCaja = useMemo(
    () => getLedgerSummary({}),
    [ledger, getLedgerSummary],
  );
  const totalCajaHoy = cajaInicialHoy + resumenDia.ingresos - resumenDia.egresos;

  const movimientosParaLista = useMemo(() => {
    const list = [...Object.values(ledger || {})].sort(
      (a, b) => (b.fecha || 0) - (a.fecha || 0),
    );
    if (soloHoy) return list.filter((m) => m.fecha >= startOfToday && m.fecha <= endOfToday);
    return list;
  }, [ledger, soloHoy, startOfToday, endOfToday]);

  const pagosFiltrados = useMemo(
    () =>
      getPayments({
        status: filtroEstado || undefined,
        metodo: filtroMetodo || undefined,
      }),
    [payments, filtroEstado, filtroMetodo, getPayments],
  );

  // -------- Acciones Cobros --------
  const guardarNuevoCobro = (marcarCobrado = false) => {
    const monto = parseFloat(String(nuevoCobroMonto).replace(',', '.'));
    if (Number.isNaN(monto) || monto <= 0) {
      Alert.alert(tStr('fin_alert_invalid_amount'), tStr('fin_alert_amount_gt_zero'));
      return;
    }
    const id = createPayment({
      userId: nuevoCobroRef.trim() || 'cliente',
      planId: nuevoCobroRef.trim() ? nuevoCobroRef.slice(0, 32) : 'plan',
      periodo: new Date().toISOString().slice(0, 7),
      monto,
      moneda: nuevoCobroMoneda,
      metodo: nuevoCobroMetodo,
      status: 'pendiente',
    });
    if (marcarCobrado) markAsPaid(id, { metodo: nuevoCobroMetodo });
    setShowNuevoCobro(false);
    setNuevoCobroMonto('');
    setNuevoCobroRef('');
    Alert.alert(
      marcarCobrado ? tStr('fin_alert_payment_registered_title') : tStr('fin_alert_payment_created_title'),
      marcarCobrado ? tStr('fin_alert_payment_registered_body') : tStr('fin_alert_payment_created_body'),
    );
  };

  const confirmarDevolucion = (p) => {
    const refStr = `${p.userId} · ${p.periodo || 'N/A'}`;
    Alert.alert(
      tStr('fin_refund_confirm_title'),
      tStr('fin_refund_confirm_body')
        .replace('{{amount}}', formatMonto(p.monto, p.moneda))
        .replace('{{ref}}', refStr),
      [
        { text: tStr('common_cancel'), style: 'cancel' },
        { text: tStr('fin_refund_btn'), style: 'destructive', onPress: () => refundPayment(p.id) },
      ],
    );
  };

  // -------- Acciones Suscripciones --------
  const guardarNuevaSuscripcion = () => {
    const precio = parseFloat(String(nuevaSubPrecio).replace(',', '.'));
    const dia = parseInt(nuevaSubDiaVenc, 10);
    if (Number.isNaN(precio) || precio <= 0) {
      Alert.alert(tStr('fin_alert_invalid_amount'), tStr('fin_alert_price_gt_zero'));
      return;
    }
    createSubscription({
      userId: nuevaSubUserId.trim() || 'cliente',
      planId: nuevaSubPlanId.trim() || 'plan',
      tipo: 'mensual',
      precio,
      moneda: nuevaSubMoneda,
      diaVencimiento: Number.isNaN(dia) || dia < 1 || dia > 31 ? 5 : dia,
    });
    setShowNuevaSub(false);
    setNuevaSubUserId('');
    setNuevaSubPlanId('');
    setNuevaSubPrecio('');
    setNuevaSubDiaVenc('5');
    Alert.alert(tStr('fin_sub_created_title'), tStr('fin_sub_created_body'));
  };

  const confirmarCancelarSuscripcion = (s) => {
    Alert.alert(
      tStr('fin_sub_cancel_title'),
      tStr('fin_sub_cancel_body').replace('{{ref}}', `${s.userId} · ${s.planId}`),
      [
        { text: tStr('fin_sub_cancel_no'), style: 'cancel' },
        { text: tStr('fin_sub_cancel_yes'), style: 'destructive', onPress: () => cancelSubscription(s.id) },
      ],
    );
  };

  // -------- Acciones Caja --------
  const guardarCajaInicial = () => {
    const monto = parseFloat(String(cajaInicialInput).replace(',', '.'));
    if (Number.isNaN(monto) || monto < 0) {
      Alert.alert(tStr('fin_alert_invalid_amount'), tStr('fin_alert_opening_valid'));
      return;
    }
    setOpenBalance(todayStr, monto);
    setCajaInicialInput('');
    Alert.alert(tStr('fin_alert_saved_opening_title'), tStr('fin_alert_saved_opening_body'));
  };

  const registrarIngreso = () => {
    const monto = parseFloat(String(montoIngreso).replace(',', '.'));
    if (Number.isNaN(monto) || monto <= 0) {
      Alert.alert(tStr('fin_alert_invalid_amount'), tStr('fin_alert_amount_gt_zero'));
      return;
    }
    addLedgerEntry({
      tipo: 'ingreso',
      fuente: 'cobro',
      metodo: medioIngreso,
      monto,
      moneda: 'ARS',
      notas:
        (conceptoIngreso || '').trim() ||
        tStr('fin_note_income').replace('{{label}}', payLabel(medioIngreso)),
    });
    setMontoIngreso('');
    setConceptoIngreso('');
  };

  const registrarSalida = () => {
    const monto = parseFloat(String(montoSalida).replace(',', '.'));
    if (Number.isNaN(monto) || monto <= 0) {
      Alert.alert(tStr('fin_alert_invalid_amount'), tStr('fin_alert_amount_gt_zero'));
      return;
    }
    addLedgerEntry({
      tipo: 'egreso',
      fuente: 'salida',
      metodo: origenSalida,
      monto,
      moneda: 'ARS',
      notas:
        (conceptoSalida || '').trim() ||
        tStr('fin_note_outcome').replace('{{label}}', outLabel(origenSalida)),
    });
    setMontoSalida('');
    setConceptoSalida('');
  };

  const confirmarEliminarMovimiento = (m) => {
    Alert.alert(
      tStr('fin_delete_move_title'),
      tStr('fin_delete_move_body').replace('{{amount}}', formatMonto(m.monto, m.moneda)),
      [
        { text: tStr('common_cancel'), style: 'cancel' },
        { text: tStr('fin_btn_delete'), style: 'destructive', onPress: () => deleteLedgerEntry(m.id) },
      ],
    );
  };

  const guardarEditarNota = () => {
    if (editingLedgerId) {
      editLedgerEntry(editingLedgerId, { notas: editingLedgerNota.trim() });
      setEditingLedgerId(null);
      setEditingLedgerNota('');
    }
  };

  return (
    <BackgroundWrapper screen="adminfinanzas">
      <SafeAreaView style={styles.safe}>
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, tab === 'caja' && styles.activeTab]}
            onPress={() => setTab('caja')}
          >
            <Text style={styles.tabText}>{tStr('fin_tab_caja')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === 'pendientes' && styles.activeTab]}
            onPress={() => setTab('pendientes')}
          >
            <Text style={styles.tabText}>{tStr('fin_tab_pendientes')}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.contentContainer}
          contentInsetAdjustmentBehavior="always"
          showsVerticalScrollIndicator={false}
        >
          {tab === 'caja' && (
            <View>
              <Text style={styles.sectionTitle}>{tStr('fin_section_ledger')}</Text>
              <Text style={styles.infoText}>{tStr('fin_intro_caja')}</Text>

              <View style={[styles.card, { borderColor: t.brand, opacity: 0.95 }]}>
                <Text style={styles.cardTitle}>{tStr('fin_card_why_manual_title')}</Text>
                <Text style={styles.cardLine}>{tStr('fin_card_why_manual_body')}</Text>
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>{tStr('fin_opening_balance_title')}</Text>
                <Text style={styles.cardLine}>
                  {tStr('fin_opening_balance_today')} {formatMonto(cajaInicialHoy)}
                </Text>
                <View style={styles.row}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    keyboardType="numeric"
                    value={cajaInicialInput}
                    onChangeText={setCajaInicialInput}
                    placeholder={tStr('fin_ph_opening')}
                    placeholderTextColor={t.placeholder}
                  />
                  <TouchableOpacity style={styles.btn} onPress={guardarCajaInicial}>
                    <Text style={styles.btnText}>{tStr('common_save')}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>{tStr('fin_income_title')}</Text>
                <Text style={styles.cardLine}>{tStr('fin_income_via')}</Text>
                <View style={styles.pillRow}>
                  {payMethods.map((med) => (
                    <TouchableOpacity
                      key={med.id}
                      style={[styles.pill, medioIngreso === med.id && styles.pillActive]}
                      onPress={() => setMedioIngreso(med.id)}
                    >
                      <Text style={styles.pillText}>{med.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.row}>
                  <Text style={styles.label}>{tStr('fin_label_amount')}</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={montoIngreso}
                    onChangeText={setMontoIngreso}
                    placeholder={tStr('fin_ph_amount_zero')}
                    placeholderTextColor={t.placeholder}
                  />
                </View>
                <View style={styles.row}>
                  <Text style={styles.label}>{tStr('fin_label_concept')}</Text>
                  <TextInput
                    style={styles.input}
                    value={conceptoIngreso}
                    onChangeText={setConceptoIngreso}
                    placeholder={tStr('fin_ph_concept_in')}
                    placeholderTextColor={t.placeholder}
                  />
                </View>
                <TouchableOpacity style={styles.btn} onPress={registrarIngreso}>
                  <Text style={styles.btnText}>{tStr('fin_btn_load_income')}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>{tStr('fin_outcome_title')}</Text>
                <Text style={styles.cardLine}>{tStr('fin_outcome_from')}</Text>
                <View style={styles.pillRow}>
                  {outcomeSources.map((org) => (
                    <TouchableOpacity
                      key={org.id}
                      style={[styles.pill, origenSalida === org.id && styles.pillActive]}
                      onPress={() => setOrigenSalida(org.id)}
                    >
                      <Text style={styles.pillText}>{org.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.row}>
                  <Text style={styles.label}>{tStr('fin_label_amount')}</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={montoSalida}
                    onChangeText={setMontoSalida}
                    placeholder={tStr('fin_ph_amount_zero')}
                    placeholderTextColor={t.placeholder}
                  />
                </View>
                <View style={styles.row}>
                  <Text style={styles.label}>{tStr('fin_label_concept')}</Text>
                  <TextInput
                    style={styles.input}
                    value={conceptoSalida}
                    onChangeText={setConceptoSalida}
                    placeholder={tStr('fin_ph_concept_out')}
                    placeholderTextColor={t.placeholder}
                  />
                </View>
                <TouchableOpacity style={styles.btn} onPress={registrarSalida}>
                  <Text style={styles.btnText}>{tStr('fin_btn_load_outcome')}</Text>
                </TouchableOpacity>
              </View>

              <View style={[styles.card, { marginBottom: 8 }]}>
                <Text style={styles.cardTitle}>{tStr('fin_total_day_title')}</Text>
                <Text style={[styles.cardLine, { fontSize: 16 }]}>
                  {tStr('fin_total_opening')} {formatMonto(cajaInicialHoy)}
                </Text>
                <Text style={[styles.cardLine, { fontSize: 16, color: t.brand }]}>
                  {tStr('fin_total_in')} {formatMonto(resumenDia.ingresos)}
                </Text>
                <Text style={[styles.cardLine, { fontSize: 16, color: t.danger }]}>
                  {tStr('fin_total_out')} {formatMonto(resumenDia.egresos)}
                </Text>
                <Text style={[styles.cardLine, { fontSize: 20, fontWeight: '700', marginTop: 8 }]}>
                  = {formatMonto(totalCajaHoy)}
                </Text>
              </View>

              {editingLedgerId ? (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>{tStr('fin_edit_concept_title')}</Text>
                  <TextInput
                    style={styles.input}
                    value={editingLedgerNota}
                    onChangeText={setEditingLedgerNota}
                    placeholder={tStr('fin_ph_concept_short')}
                    placeholderTextColor={t.placeholder}
                  />
                  <View style={styles.btnRow}>
                    <TouchableOpacity style={styles.btn} onPress={guardarEditarNota}>
                      <Text style={styles.btnText}>{tStr('common_save')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => { setEditingLedgerId(null); setEditingLedgerNota(''); }}>
                      <Text style={[styles.cardLine, { color: t.brand }]}>{tStr('common_cancel')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}

              <View style={styles.row}>
                <Text style={styles.label}>{tStr('fin_view_label')}</Text>
                <TouchableOpacity
                  style={[styles.pill, soloHoy && styles.pillActive]}
                  onPress={() => setSoloHoy(true)}
                >
                  <Text style={styles.pillText}>{tStr('fin_view_today')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.pill, !soloHoy && styles.pillActive]}
                  onPress={() => setSoloHoy(false)}
                >
                  <Text style={styles.pillText}>{tStr('fin_view_all')}</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.sectionTitle}>{tStr('fin_movements_title')}</Text>
              {movimientosParaLista.length ? (
                movimientosParaLista.map((m) => (
                  <View key={m.id} style={styles.card}>
                    <Text style={styles.cardTitle}>
                      {m.tipo === 'ingreso' ? tStr('fin_movement_in') : tStr('fin_movement_out')} ·{' '}
                      {formatMonto(m.monto, m.moneda)}
                    </Text>
                    <Text style={styles.cardLine}>
                      {formatDateTime(m.fecha)} ·{' '}
                      {m.tipo === 'ingreso' ? payLabel(m.metodo) : outLabel(m.metodo)}
                    </Text>
                    {m.notas ? <Text style={styles.cardLine}>{m.notas}</Text> : null}
                    <View style={styles.cardActions}>
                      <TouchableOpacity
                        style={styles.smallBtn}
                        onPress={() => { setEditingLedgerId(m.id); setEditingLedgerNota(m.notas || ''); }}
                      >
                        <Text style={styles.smallBtnText}>{tStr('fin_btn_edit_concept')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.smallBtnDanger}
                        onPress={() => confirmarEliminarMovimiento(m)}
                      >
                        <Text style={styles.smallBtnText}>{tStr('fin_btn_delete')}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>{tStr('fin_empty_movements')}</Text>
              )}
            </View>
          )}

          {tab === 'pendientes' && (
            <View>
              <Text style={styles.sectionTitle}>{tStr('fin_pending_title')}</Text>
              <Text style={styles.infoText}>{tStr('fin_pending_intro')}</Text>
              <View style={styles.row}>
                <Text style={styles.label}>{tStr('fin_label_status')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={tStr('fin_ph_filter_status')}
                  placeholderTextColor={t.placeholder}
                  value={filtroEstado}
                  onChangeText={setFiltroEstado}
                />
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>{tStr('fin_label_method')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={tStr('fin_ph_filter_method')}
                  placeholderTextColor={t.placeholder}
                  value={filtroMetodo}
                  onChangeText={setFiltroMetodo}
                />
              </View>
              {!showNuevoCobro ? (
                <TouchableOpacity style={styles.btn} onPress={() => setShowNuevoCobro(true)}>
                  <Text style={styles.btnText}>{tStr('fin_btn_new_pending')}</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>{tStr('fin_new_pending_title')}</Text>
                  <View style={styles.row}>
                    <Text style={styles.label}>{tStr('fin_label_amount')}</Text>
                    <TextInput style={styles.input} keyboardType="numeric" value={nuevoCobroMonto} onChangeText={setNuevoCobroMonto} placeholder={tStr('fin_ph_amount_example')} placeholderTextColor={t.placeholder} />
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.label}>{tStr('fin_label_currency')}</Text>
                    <View style={styles.pillRow}>
                      {SUPPORTED_CURRENCIES.map((cur) => (
                        <TouchableOpacity key={cur} style={[styles.pill, nuevoCobroMoneda === cur && styles.pillActive]} onPress={() => setNuevoCobroMoneda(cur)}>
                          <Text style={styles.pillText}>{cur}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.label}>{tStr('fin_label_method_when_paid')}</Text>
                    <View style={styles.pillRow}>
                      {payMethods.map((med) => (
                        <TouchableOpacity key={med.id} style={[styles.pill, nuevoCobroMetodo === med.id && styles.pillActive]} onPress={() => setNuevoCobroMetodo(med.id)}>
                          <Text style={styles.pillText}>{med.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.label}>{tStr('fin_label_ref')}</Text>
                    <TextInput style={styles.input} value={nuevoCobroRef} onChangeText={setNuevoCobroRef} placeholder={tStr('fin_ph_ref')} placeholderTextColor={t.placeholder} />
                  </View>
                  <View style={styles.btnRow}>
                    <TouchableOpacity style={styles.btn} onPress={() => guardarNuevoCobro(false)}>
                      <Text style={styles.btnText}>{tStr('fin_btn_save_pending')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.btn} onPress={() => guardarNuevoCobro(true)}>
                      <Text style={styles.btnText}>{tStr('fin_btn_save_paid')}</Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity onPress={() => setShowNuevoCobro(false)}>
                    <Text style={[styles.cardLine, { color: t.brand, marginTop: 8 }]}>{tStr('common_cancel')}</Text>
                  </TouchableOpacity>
                </View>
              )}
              {pagosFiltrados.length ? (
                pagosFiltrados.map((p) => (
                  <View key={p.id} style={styles.card}>
                    <Text style={styles.cardTitle}>{p.userId} · {p.planId}</Text>
                    <Text style={styles.cardLine}>
                      {tStr('fin_period_line')} {p.periodo || '—'} · {tStr('fin_status_line')} {p.status}
                    </Text>
                    <Text style={styles.cardLine}>
                      {formatMonto(p.monto, p.moneda)} · {p.metodo ? payLabel(p.metodo) : '—'}
                    </Text>
                    {p.paidAt ? (
                      <Text style={[styles.cardLine, { fontSize: 12, color: t.subText }]}>
                        {tStr('fin_collected')} {formatDateTime(p.paidAt)}
                      </Text>
                    ) : null}
                    <View style={styles.cardActions}>
                      {(p.status === 'pendiente' || p.status === 'parcial') && (
                        <>
                          <TouchableOpacity style={styles.smallBtn} onPress={() => markAsPaid(p.id, { metodo: p.metodo || 'efectivo' })}>
                            <Text style={styles.smallBtnText}>{tStr('fin_btn_mark_paid')}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.smallBtn} onPress={() => markAsPartial(p.id, Math.round((p.monto || 0) / 2), { metodo: p.metodo || 'efectivo' })}>
                            <Text style={styles.smallBtnText}>{tStr('fin_btn_partial')}</Text>
                          </TouchableOpacity>
                        </>
                      )}
                      {p.status !== 'devuelto' && (
                        <TouchableOpacity style={styles.smallBtnDanger} onPress={() => confirmarDevolucion(p)}>
                          <Text style={styles.smallBtnText}>{tStr('fin_btn_refund')}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>{tStr('fin_empty_payments')}</Text>
              )}

              <View style={styles.spacerSm} />
              <Text style={styles.sectionTitle}>{tStr('fin_subscriptions_title')}</Text>
              <Text style={styles.infoText}>{tStr('fin_subscriptions_intro')}</Text>
              {!showNuevaSub ? (
                <View style={styles.btnRow}>
                  <TouchableOpacity style={styles.btn} onPress={() => setShowNuevaSub(true)}>
                    <Text style={styles.btnText}>{tStr('fin_btn_new_sub')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.btn} onPress={generateNextInvoices}>
                    <Text style={styles.btnText}>{tStr('fin_btn_gen_invoices')}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>{tStr('fin_new_sub_title')}</Text>
                  <View style={styles.row}>
                    <Text style={styles.label}>{tStr('fin_label_client_id')}</Text>
                    <TextInput style={styles.input} value={nuevaSubUserId} onChangeText={setNuevaSubUserId} placeholder={tStr('fin_ph_uuid')} placeholderTextColor={t.placeholder} />
                  </View>
                  {orgMemberPicklist.length > 0 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.memberPickScroll}>
                      {orgMemberPicklist.map((m) => (
                        <TouchableOpacity
                          key={m.id}
                          style={styles.memberChip}
                          onPress={() => setNuevaSubUserId(m.id)}
                          activeOpacity={0.85}
                        >
                          <Text style={styles.memberChipText} numberOfLines={1}>
                            {m.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  ) : null}
                  <View style={styles.row}>
                    <Text style={styles.label}>{tStr('fin_label_plan')}</Text>
                    <TextInput style={styles.input} value={nuevaSubPlanId} onChangeText={setNuevaSubPlanId} placeholder={tStr('fin_ph_plan_id')} placeholderTextColor={t.placeholder} />
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.label}>{tStr('fin_label_price')}</Text>
                    <TextInput style={styles.input} keyboardType="numeric" value={nuevaSubPrecio} onChangeText={setNuevaSubPrecio} placeholder={tStr('fin_ph_amount_example')} placeholderTextColor={t.placeholder} />
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.label}>{tStr('fin_label_currency')}</Text>
                    <View style={styles.pillRow}>
                      {SUPPORTED_CURRENCIES.map((cur) => (
                        <TouchableOpacity key={cur} style={[styles.pill, nuevaSubMoneda === cur && styles.pillActive]} onPress={() => setNuevaSubMoneda(cur)}>
                          <Text style={styles.pillText}>{cur}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.label}>{tStr('fin_label_due_day')}</Text>
                    <TextInput style={styles.input} keyboardType="number-pad" value={nuevaSubDiaVenc} onChangeText={setNuevaSubDiaVenc} placeholder={tStr('fin_ph_due_day')} placeholderTextColor={t.placeholder} />
                  </View>
                  <TouchableOpacity style={styles.btn} onPress={guardarNuevaSuscripcion}>
                    <Text style={styles.btnText}>{tStr('fin_btn_create_sub')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setShowNuevaSub(false)}>
                    <Text style={[styles.cardLine, { color: t.brand, marginTop: 8 }]}>{tStr('common_cancel')}</Text>
                  </TouchableOpacity>
                </View>
              )}
              {Object.values(subscriptions || {}).length ? (
                Object.values(subscriptions).map((s) => (
                  <View key={s.id} style={styles.card}>
                    <Text style={styles.cardTitle}>{s.userId} · {s.planId}</Text>
                    <Text style={styles.cardLine}>
                      {tStr('fin_sub_line')
                        .replace('{{tipo}}', s.tipo)
                        .replace('{{amount}}', formatMonto(s.precio, s.moneda))
                        .replace('{{day}}', String(s.diaVencimiento ?? '—'))}
                    </Text>
                    <View style={styles.cardActions}>
                      {s.activo ? (
                        <TouchableOpacity style={styles.smallBtnDanger} onPress={() => confirmarCancelarSuscripcion(s)}>
                          <Text style={styles.smallBtnText}>{tStr('fin_btn_cancel_sub')}</Text>
                        </TouchableOpacity>
                      ) : (
                        <Text style={[styles.cardLine, { color: t.subText }]}>{tStr('fin_sub_cancelled')}</Text>
                      )}
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>{tStr('fin_empty_subs')}</Text>
              )}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </BackgroundWrapper>
  );
}

AdminFinanzasScreen.propTypes = {
  route: PropTypes.shape({
    params: PropTypes.shape({
      tab: PropTypes.string,
    }),
  }),
};
