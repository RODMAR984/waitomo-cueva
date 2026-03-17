// screens/AdminFinanzasScreen.js
// Módulo de finanzas: cobros, suscripciones, métodos de pago, reportes y caja (libro diario).
// Soporta ARS, USD, EUR. Confirmaciones en acciones destructivas. Copy formal.

import React, { useMemo, useState } from 'react';
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
import { colors } from '../theme/colors';
import { useThemeContext } from '../contexts/ThemeContext';

const SUPPORTED_CURRENCIES = ['ARS', 'USD', 'EUR'];
// Medios por los que te pagan (ingresos)
const MEDIOS_DE_COBRO = [
  { id: 'efectivo', label: 'Efectivo' },
  { id: 'transferencia', label: 'Transferencia' },
  { id: 'qr', label: 'QR' },
  { id: 'mercadopago', label: 'Mercado Pago' },
  { id: 'cuenta_dni', label: 'Cuenta DNI' },
  { id: 'otro', label: 'Otro' },
];
// De dónde sale el dinero en una salida
const ORIGENES_SALIDA = [
  { id: 'efectivo', label: 'Efectivo (caja)' },
  { id: 'cuenta_bancaria', label: 'Cuenta bancaria' },
  { id: 'billetera', label: 'Billetera' },
];

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

const formatDateTime = (ts) => {
  const d = new Date(ts);
  return d.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function AdminFinanzasScreen({ route }) {
  const insets = useSafeAreaInsets();
  const { t } = useThemeContext();

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

  // estilos
  const styles = useMemo(
    () =>
      StyleSheet.create({
        safe: { backgroundColor: 'transparent', flex: 1, paddingTop: insets.top + 8 },
        container: { flex: 1 },
        contentContainer: { padding: 16, paddingBottom: 28 },

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
          borderRadius: 10,
          borderWidth: 1,
          marginBottom: 10,
          padding: 12,
        },

        // inputs (UNIFICADO)
        input: {
          backgroundColor: t.inputBg,
          borderColor: t.overlayBorder,
          borderRadius: 8,
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
        btnRow: { flexDirection: 'row', gap: 12, marginVertical: 10 },
        cardActions: { flexDirection: 'row', gap: 12, marginTop: 8 },

        // botones (unificado: outline, no bloque cyan)
        btn: {
          alignSelf: 'flex-start',
          ...t.buttonPrimary,
          borderRadius: 8,
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
      Alert.alert('Dato inválido', 'Ingrese un monto mayor a 0.');
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
      marcarCobrado ? 'Cobro registrado' : 'Cobro creado',
      marcarCobrado
        ? 'El cobro quedó registrado y el ingreso se reflejó en Caja.'
        : 'El cobro quedó pendiente. Puede marcarlo como cobrado desde la lista.',
    );
  };

  const confirmarDevolucion = (p) => {
    Alert.alert(
      'Confirmar devolución',
      `¿Devolver ${formatMonto(p.monto, p.moneda)} (${p.userId} · ${p.periodo || 'N/A'})? Se registrará un egreso en Caja.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Devolver', style: 'destructive', onPress: () => refundPayment(p.id) },
      ],
    );
  };

  // -------- Acciones Suscripciones --------
  const guardarNuevaSuscripcion = () => {
    const precio = parseFloat(String(nuevaSubPrecio).replace(',', '.'));
    const dia = parseInt(nuevaSubDiaVenc, 10);
    if (Number.isNaN(precio) || precio <= 0) {
      Alert.alert('Dato inválido', 'Ingrese un precio mayor a 0.');
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
    Alert.alert('Suscripción creada', 'Se generarán facturas según el día de vencimiento.');
  };

  const confirmarCancelarSuscripcion = (s) => {
    Alert.alert(
      'Cancelar suscripción',
      `¿Cancelar la suscripción ${s.userId} · ${s.planId}? No se generarán más facturas.`,
      [
        { text: 'No', style: 'cancel' },
        { text: 'Sí, cancelar', style: 'destructive', onPress: () => cancelSubscription(s.id) },
      ],
    );
  };

  // -------- Acciones Caja --------
  const guardarCajaInicial = () => {
    const monto = parseFloat(String(cajaInicialInput).replace(',', '.'));
    if (Number.isNaN(monto) || monto < 0) {
      Alert.alert('Dato inválido', 'Ingrese un monto válido (mayor o igual a 0).');
      return;
    }
    setOpenBalance(todayStr, monto);
    setCajaInicialInput('');
    Alert.alert('Guardado', 'Caja inicial del día actualizada.');
  };

  const registrarIngreso = () => {
    const monto = parseFloat(String(montoIngreso).replace(',', '.'));
    if (Number.isNaN(monto) || monto <= 0) {
      Alert.alert('Dato inválido', 'Ingrese un monto mayor a 0.');
      return;
    }
    addLedgerEntry({
      tipo: 'ingreso',
      fuente: 'cobro',
      metodo: medioIngreso,
      monto,
      moneda: 'ARS',
      notas: (conceptoIngreso || '').trim() || `Cobro por ${MEDIOS_DE_COBRO.find((x) => x.id === medioIngreso)?.label || medioIngreso}`,
    });
    setMontoIngreso('');
    setConceptoIngreso('');
  };

  const registrarSalida = () => {
    const monto = parseFloat(String(montoSalida).replace(',', '.'));
    if (Number.isNaN(monto) || monto <= 0) {
      Alert.alert('Dato inválido', 'Ingrese un monto mayor a 0.');
      return;
    }
    addLedgerEntry({
      tipo: 'egreso',
      fuente: 'salida',
      metodo: origenSalida,
      monto,
      moneda: 'ARS',
      notas: (conceptoSalida || '').trim() || `Salida desde ${ORIGENES_SALIDA.find((x) => x.id === origenSalida)?.label || origenSalida}`,
    });
    setMontoSalida('');
    setConceptoSalida('');
  };

  const confirmarEliminarMovimiento = (m) => {
    Alert.alert(
      'Eliminar movimiento',
      `¿Eliminar este movimiento (${formatMonto(m.monto, m.moneda)})? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => deleteLedgerEntry(m.id) },
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
            <Text style={styles.tabText}>Caja</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === 'pendientes' && styles.activeTab]}
            onPress={() => setTab('pendientes')}
          >
            <Text style={styles.tabText}>Pendientes</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.contentContainer}
          contentInsetAdjustmentBehavior="always"
          showsVerticalScrollIndicator={false}
        >
          {tab === 'caja' && (
            <View>
              <Text style={styles.sectionTitle}>Libro diario — Caja</Text>
              <Text style={styles.infoText}>
                Acá se registra todo: caja inicial del día, cada cobro (efectivo, transferencia, QR, Mercado Pago, Cuenta DNI) y cada salida (desde efectivo, cuenta bancaria o billetera). Cuando alguien te paga por cualquier medio, cargá el ingreso abajo con el medio que corresponda.
              </Text>

              <View style={[styles.card, { borderColor: t.brand, opacity: 0.95 }]}>
                <Text style={styles.cardTitle}>¿Por qué se carga manual? ¿Se puede automatizar?</Text>
                <Text style={styles.cardLine}>
                  Hoy la app no está linkeada a ninguna cuenta (Mercado Pago, banco, etc.). Por eso cada cobro se registra a mano. Sí se puede automatizar: si conectás tu cuenta de Mercado Pago (o un banco que ofrezca API) mediante webhooks, cuando te paguen por QR, link o transferencia el sistema puede recibir la notificación y cargar el ingreso solo. Eso requiere un backend (por ejemplo Supabase) que reciba la notificación de pago y guarde el movimiento; la app después lo muestra. La opción «Conectar cuenta» para linkear Mercado Pago y que los cobros se carguen solos está prevista para una próxima versión.
                </Text>
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>Caja inicial del día</Text>
                <Text style={styles.cardLine}>
                  Hoy tenés cargado: {formatMonto(cajaInicialHoy)}
                </Text>
                <View style={styles.row}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    keyboardType="numeric"
                    value={cajaInicialInput}
                    onChangeText={setCajaInicialInput}
                    placeholder="Monto con el que abrís caja"
                    placeholderTextColor={t.placeholder}
                  />
                  <TouchableOpacity style={styles.btn} onPress={guardarCajaInicial}>
                    <Text style={styles.btnText}>Guardar</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>Registrar ingreso (cobro recibido)</Text>
                <Text style={styles.cardLine}>Medio por el que te pagaron:</Text>
                <View style={styles.pillRow}>
                  {MEDIOS_DE_COBRO.map((med) => (
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
                  <Text style={styles.label}>Monto</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={montoIngreso}
                    onChangeText={setMontoIngreso}
                    placeholder="0"
                    placeholderTextColor={t.placeholder}
                  />
                </View>
                <View style={styles.row}>
                  <Text style={styles.label}>Concepto</Text>
                  <TextInput
                    style={styles.input}
                    value={conceptoIngreso}
                    onChangeText={setConceptoIngreso}
                    placeholder="Ej: mensualidad Juan, clase suelta"
                    placeholderTextColor={t.placeholder}
                  />
                </View>
                <TouchableOpacity style={styles.btn} onPress={registrarIngreso}>
                  <Text style={styles.btnText}>Cargar ingreso</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>Registrar salida</Text>
                <Text style={styles.cardLine}>¿De dónde sale el dinero?</Text>
                <View style={styles.pillRow}>
                  {ORIGENES_SALIDA.map((org) => (
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
                  <Text style={styles.label}>Monto</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={montoSalida}
                    onChangeText={setMontoSalida}
                    placeholder="0"
                    placeholderTextColor={t.placeholder}
                  />
                </View>
                <View style={styles.row}>
                  <Text style={styles.label}>Concepto</Text>
                  <TextInput
                    style={styles.input}
                    value={conceptoSalida}
                    onChangeText={setConceptoSalida}
                    placeholder="Ej: alquiler, proveedor, retiro"
                    placeholderTextColor={t.placeholder}
                  />
                </View>
                <TouchableOpacity style={styles.btn} onPress={registrarSalida}>
                  <Text style={styles.btnText}>Cargar salida</Text>
                </TouchableOpacity>
              </View>

              <View style={[styles.card, { marginBottom: 8 }]}>
                <Text style={styles.cardTitle}>Total caja del día</Text>
                <Text style={[styles.cardLine, { fontSize: 16 }]}>
                  Caja inicial: {formatMonto(cajaInicialHoy)}
                </Text>
                <Text style={[styles.cardLine, { fontSize: 16, color: t.brand }]}>
                  + Ingresos: {formatMonto(resumenDia.ingresos)}
                </Text>
                <Text style={[styles.cardLine, { fontSize: 16, color: t.danger }]}>
                  − Salidas: {formatMonto(resumenDia.egresos)}
                </Text>
                <Text style={[styles.cardLine, { fontSize: 20, fontWeight: '700', marginTop: 8 }]}>
                  = {formatMonto(totalCajaHoy)}
                </Text>
              </View>

              {editingLedgerId ? (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Editar concepto</Text>
                  <TextInput
                    style={styles.input}
                    value={editingLedgerNota}
                    onChangeText={setEditingLedgerNota}
                    placeholder="Concepto"
                    placeholderTextColor={t.placeholder}
                  />
                  <View style={styles.btnRow}>
                    <TouchableOpacity style={styles.btn} onPress={guardarEditarNota}>
                      <Text style={styles.btnText}>Guardar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => { setEditingLedgerId(null); setEditingLedgerNota(''); }}>
                      <Text style={[styles.cardLine, { color: t.brand }]}>Cancelar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}

              <View style={styles.row}>
                <Text style={styles.label}>Ver</Text>
                <TouchableOpacity
                  style={[styles.pill, soloHoy && styles.pillActive]}
                  onPress={() => setSoloHoy(true)}
                >
                  <Text style={styles.pillText}>Solo hoy</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.pill, !soloHoy && styles.pillActive]}
                  onPress={() => setSoloHoy(false)}
                >
                  <Text style={styles.pillText}>Todo</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.sectionTitle}>Movimientos</Text>
              {movimientosParaLista.length ? (
                movimientosParaLista.map((m) => (
                  <View key={m.id} style={styles.card}>
                    <Text style={styles.cardTitle}>
                      {m.tipo === 'ingreso' ? 'Ingreso' : 'Salida'} · {formatMonto(m.monto, m.moneda)}
                    </Text>
                    <Text style={styles.cardLine}>
                      {formatDateTime(m.fecha)} · {m.tipo === 'ingreso' ? (MEDIOS_DE_COBRO.find((x) => x.id === m.metodo)?.label || m.metodo) : (ORIGENES_SALIDA.find((x) => x.id === m.metodo)?.label || m.metodo)}
                    </Text>
                    {m.notas ? <Text style={styles.cardLine}>{m.notas}</Text> : null}
                    <View style={styles.cardActions}>
                      <TouchableOpacity
                        style={styles.smallBtn}
                        onPress={() => { setEditingLedgerId(m.id); setEditingLedgerNota(m.notas || ''); }}
                      >
                        <Text style={styles.smallBtnText}>Editar concepto</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.smallBtnDanger}
                        onPress={() => confirmarEliminarMovimiento(m)}
                      >
                        <Text style={styles.smallBtnText}>Eliminar</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>Sin movimientos</Text>
              )}
            </View>
          )}

          {tab === 'pendientes' && (
            <View>
              <Text style={styles.sectionTitle}>Cobros pendientes</Text>
              <Text style={styles.infoText}>
                Facturas o cobros que aún no se cobraron. Cuando cobrés (por el medio que sea), marcá «Marcar cobrado» y el ingreso se suma en Caja. Si preferís no usar esta lista, podés cargar el ingreso directo en la pestaña Caja.
              </Text>
              <View style={styles.row}>
                <Text style={styles.label}>Estado</Text>
                <TextInput
                  style={styles.input}
                  placeholder="pendiente, pagado, etc."
                  placeholderTextColor={t.placeholder}
                  value={filtroEstado}
                  onChangeText={setFiltroEstado}
                />
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Método</Text>
                <TextInput
                  style={styles.input}
                  placeholder="efectivo, transferencia, etc."
                  placeholderTextColor={t.placeholder}
                  value={filtroMetodo}
                  onChangeText={setFiltroMetodo}
                />
              </View>
              {!showNuevoCobro ? (
                <TouchableOpacity style={styles.btn} onPress={() => setShowNuevoCobro(true)}>
                  <Text style={styles.btnText}>+ Nuevo cobro pendiente</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Nuevo cobro pendiente</Text>
                  <View style={styles.row}>
                    <Text style={styles.label}>Monto</Text>
                    <TextInput style={styles.input} keyboardType="numeric" value={nuevoCobroMonto} onChangeText={setNuevoCobroMonto} placeholder="Ej: 20000" placeholderTextColor={t.placeholder} />
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.label}>Moneda</Text>
                    <View style={styles.pillRow}>
                      {SUPPORTED_CURRENCIES.map((cur) => (
                        <TouchableOpacity key={cur} style={[styles.pill, nuevoCobroMoneda === cur && styles.pillActive]} onPress={() => setNuevoCobroMoneda(cur)}>
                          <Text style={styles.pillText}>{cur}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.label}>Medio (al cobrar)</Text>
                    <View style={styles.pillRow}>
                      {MEDIOS_DE_COBRO.map((med) => (
                        <TouchableOpacity key={med.id} style={[styles.pill, nuevoCobroMetodo === med.id && styles.pillActive]} onPress={() => setNuevoCobroMetodo(med.id)}>
                          <Text style={styles.pillText}>{med.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.label}>Referencia</Text>
                    <TextInput style={styles.input} value={nuevoCobroRef} onChangeText={setNuevoCobroRef} placeholder="Cliente / plan (opcional)" placeholderTextColor={t.placeholder} />
                  </View>
                  <View style={styles.btnRow}>
                    <TouchableOpacity style={styles.btn} onPress={() => guardarNuevoCobro(false)}>
                      <Text style={styles.btnText}>Guardar (pendiente)</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.btn} onPress={() => guardarNuevoCobro(true)}>
                      <Text style={styles.btnText}>Guardar y marcar cobrado</Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity onPress={() => setShowNuevoCobro(false)}>
                    <Text style={[styles.cardLine, { color: t.brand, marginTop: 8 }]}>Cancelar</Text>
                  </TouchableOpacity>
                </View>
              )}
              {pagosFiltrados.length ? (
                pagosFiltrados.map((p) => (
                  <View key={p.id} style={styles.card}>
                    <Text style={styles.cardTitle}>{p.userId} · {p.planId}</Text>
                    <Text style={styles.cardLine}>Período: {p.periodo || '—'} · Estado: {p.status}</Text>
                    <Text style={styles.cardLine}>{formatMonto(p.monto, p.moneda)} · {p.metodo || '—'}</Text>
                    {p.paidAt ? <Text style={[styles.cardLine, { fontSize: 12, color: t.subText }]}>Cobrado: {formatDateTime(p.paidAt)}</Text> : null}
                    <View style={styles.cardActions}>
                      {(p.status === 'pendiente' || p.status === 'parcial') && (
                        <>
                          <TouchableOpacity style={styles.smallBtn} onPress={() => markAsPaid(p.id, { metodo: p.metodo || 'efectivo' })}>
                            <Text style={styles.smallBtnText}>Marcar cobrado</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.smallBtn} onPress={() => markAsPartial(p.id, Math.round((p.monto || 0) / 2), { metodo: p.metodo || 'efectivo' })}>
                            <Text style={styles.smallBtnText}>Pago parcial</Text>
                          </TouchableOpacity>
                        </>
                      )}
                      {p.status !== 'devuelto' && (
                        <TouchableOpacity style={styles.smallBtnDanger} onPress={() => confirmarDevolucion(p)}>
                          <Text style={styles.smallBtnText}>Devolución</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>Sin cobros pendientes</Text>
              )}

              <View style={styles.spacerSm} />
              <Text style={styles.sectionTitle}>Suscripciones</Text>
              <Text style={styles.infoText}>
                Generan cobros periódicos. «Generar facturas del mes» crea los cobros pendientes; después cobrás y los registrás en Caja.
              </Text>
              {!showNuevaSub ? (
                <View style={styles.btnRow}>
                  <TouchableOpacity style={styles.btn} onPress={() => setShowNuevaSub(true)}>
                    <Text style={styles.btnText}>+ Nueva suscripción</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.btn} onPress={generateNextInvoices}>
                    <Text style={styles.btnText}>Generar facturas del mes</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Nueva suscripción</Text>
                  <View style={styles.row}>
                    <Text style={styles.label}>Cliente / ID</Text>
                    <TextInput style={styles.input} value={nuevaSubUserId} onChangeText={setNuevaSubUserId} placeholder="Ej: cliente@email.com" placeholderTextColor={t.placeholder} />
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.label}>Plan</Text>
                    <TextInput style={styles.input} value={nuevaSubPlanId} onChangeText={setNuevaSubPlanId} placeholder="Ej: cross_training" placeholderTextColor={t.placeholder} />
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.label}>Precio</Text>
                    <TextInput style={styles.input} keyboardType="numeric" value={nuevaSubPrecio} onChangeText={setNuevaSubPrecio} placeholder="Ej: 25000" placeholderTextColor={t.placeholder} />
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.label}>Moneda</Text>
                    <View style={styles.pillRow}>
                      {SUPPORTED_CURRENCIES.map((cur) => (
                        <TouchableOpacity key={cur} style={[styles.pill, nuevaSubMoneda === cur && styles.pillActive]} onPress={() => setNuevaSubMoneda(cur)}>
                          <Text style={styles.pillText}>{cur}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.label}>Día venc.</Text>
                    <TextInput style={styles.input} keyboardType="number-pad" value={nuevaSubDiaVenc} onChangeText={setNuevaSubDiaVenc} placeholder="1-31" placeholderTextColor={t.placeholder} />
                  </View>
                  <TouchableOpacity style={styles.btn} onPress={guardarNuevaSuscripcion}>
                    <Text style={styles.btnText}>Crear suscripción</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setShowNuevaSub(false)}>
                    <Text style={[styles.cardLine, { color: t.brand, marginTop: 8 }]}>Cancelar</Text>
                  </TouchableOpacity>
                </View>
              )}
              {Object.values(subscriptions || {}).length ? (
                Object.values(subscriptions).map((s) => (
                  <View key={s.id} style={styles.card}>
                    <Text style={styles.cardTitle}>{s.userId} · {s.planId}</Text>
                    <Text style={styles.cardLine}>{s.tipo} · {formatMonto(s.precio, s.moneda)} / mes · Vence día {s.diaVencimiento ?? '—'}</Text>
                    <View style={styles.cardActions}>
                      {s.activo ? (
                        <TouchableOpacity style={styles.smallBtnDanger} onPress={() => confirmarCancelarSuscripcion(s)}>
                          <Text style={styles.smallBtnText}>Cancelar suscripción</Text>
                        </TouchableOpacity>
                      ) : (
                        <Text style={[styles.cardLine, { color: t.subText }]}>Cancelada</Text>
                      )}
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>Sin suscripciones</Text>
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
