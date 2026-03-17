// screens/PagoScreen.js — Waitomo Dark Only (FIX definitivo)
// - "Ya pagué" SIEMPRE continúa el flujo (no se clava)
// - ✅ Crea user_abonos (active) + user_plans (legacy) para que ClientScreen detecte plan
// - MercadoPago: si no hay monto, abre igual MP sin romper
// - Mantiene estética y estructura

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import PropTypes from 'prop-types';
import * as Clipboard from 'expo-clipboard';

import BackgroundWrapper from '../components/BackgroundWrapper';
import { useTrainingData } from '../contexts/TrainingDataContext';
import { useAuth } from '../contexts/AuthContext';
import { colors } from '../theme/colors';
import { useThemeContext } from '../contexts/ThemeContext';
import { supabase } from '../supabaseClient';

// ---------- helpers ----------
const hexToRgba = (hex, alpha = 1) => {
  const clean = String(hex).replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
};

const addDaysISO = (startDate = new Date(), days = 30) => {
  const d = startDate instanceof Date ? new Date(startDate) : new Date(String(startDate));
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + Number(days || 0));
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`; // date
};

const todayISO = () => {
  const d = new Date();
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export default function PagoScreen({ navigation, route }) {
  const { createPayment, markAsPaid } = useTrainingData();
  const { user: ctxUser } = useAuth() || {};
  const { t } = useThemeContext();

  const defaultPlan = { id: 'admin', title: 'Pago', nombre: 'admin' };
  const { plan = defaultPlan, userData, abono, planKey: routePlanKey } = route?.params || {};
  const [paymentId, setPaymentId] = useState(null);
  const [paymentUrl, setPaymentUrl] = useState(null);

  const userId = userData?.id || ctxUser?.id || null;

  const planId =
    String(
      (typeof plan?.id === 'string' && plan.id) ||
      (typeof plan?.nombre === 'string' && plan.nombre) ||
      (typeof plan?.title === 'string' && plan.title) ||
      routePlanKey ||
      'admin'
    ).toLowerCase().trim();

  const parsePrecio = (v) => {
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
      return Number(v.replace(/[^\d.,-]/g, '').replace(',', '.')) || 0;
    }
    return 0;
  };

  // monto puede ser 0 => NO frenamos flujo
  const monto = parsePrecio(abono?.precio) || parsePrecio(userData?.precio ?? plan?.precio ?? 0);
  const periodo = new Date().toISOString().slice(0, 7); // YYYY-MM

  const copiarDatos = async (texto) => {
    await Clipboard.setStringAsync(texto);
    Alert.alert('📋 Copiado', `${texto}\n\nYa podés pegarlo en tu app de pago.`);
  };

  const crearIntentoPago = async (metodo) => {
    try {
      if (!createPayment) return null;
      if (!userId) throw new Error('Usuario no autenticado');

      // ✅ si no hay monto, NO rompemos (solo no generamos intento)
      if (!(typeof monto === 'number' && monto > 0)) {
        return { paymentId: null, paymentUrl: null };
      }

      const res = await createPayment({
        userId,
        planId,
        periodo,
        monto,
        moneda: 'ARS',
        metodo,
        status: 'pendiente',
      });

      const pid =
        (typeof res === 'string' && res) ||
        res?.payment_id ||
        res?.id ||
        res?.paymentId ||
        null;

      const url = res?.init_point || res?.payment_url || res?.url || null;

      setPaymentId(pid);
      setPaymentUrl(url);

      return { paymentId: pid, paymentUrl: url };
    } catch (e) {
      setPaymentId(null);
      setPaymentUrl(null);
      console.log('❌ crearIntentoPago error:', e?.message || e);
      // NO bloqueamos la UI por esto
      return null;
    }
  };

  // ✅ FIX CLAVE: crear abono real para que ClientScreen detecte plan
  const crearAbonoReal = async () => {
    try {
      if (!userId) return;

      const abonoId = abono?.id || abono?.__row?.id || null;
      const durationDays =
        Number(abono?.duration_days ?? abono?.__row?.duration_days ?? 30) || 30;

      const includedSessions =
        abono?.included_sessions ?? abono?.__row?.included_sessions ?? null;

      // user_abonos requiere: abono_id (uuid), plan_id, end_date
      // si por algún motivo abonoId viene null, no podemos insertar (schema lo exige)
      if (!abonoId) {
        console.log('🟠 crearAbonoReal: sin abonoId (uuid) -> no inserto user_abonos');
        return;
      }

      const startDate = todayISO();
      const endDate = addDaysISO(new Date(), durationDays);

      // 1) user_abonos
      const { error: e1 } = await supabase
        .from('user_abonos')
        .insert({
          user_id: userId,
          abono_id: abonoId,
          plan_id: planId,
          status: 'active',            // ✅ para destrabar panel inmediatamente
          start_date: startDate,
          end_date: endDate,
          sessions_total: includedSessions,
          sessions_used: 0,
        });

      if (e1) {
        console.log('❌ crearAbonoReal: insert user_abonos error:', e1?.message || e1);
      } else {
        console.log('✅ crearAbonoReal: user_abonos creado', { userId, planId, abonoId });
      }

      // 2) legacy: user_plans (por compat)
      try {
        const { error: e2 } = await supabase
          .from('user_plans')
          .insert({
            user_id: userId,
            plan_id: planId,
            activo: true,
          });

        if (e2) {
          // no fatal
          console.log('🟠 crearAbonoReal: insert user_plans error (no fatal):', e2?.message || e2);
        }
      } catch (e) {
        console.log('🟠 crearAbonoReal: user_plans catch (no fatal):', e?.message || e);
      }
    } catch (e) {
      console.log('❌ crearAbonoReal catch:', e?.message || e);
    }
  };

  const handlePagoConfirmado = async () => {
    console.log('🟢 PagoScreen: click YA PAGUÉ');

    // ✅ 1) Navegar SIEMPRE (nunca clavar UI)
    navigation.navigate('RegistroCompleto', { plan, userData, abono, planKey: planId });

    // ✅ 2) Crear abono real en DB (sin bloquear UI)
    crearAbonoReal();

    // ✅ 3) Marcar pago local si existiera paymentId (no bloquear)
    if (paymentId && markAsPaid) {
      Promise.resolve()
        .then(() => markAsPaid(paymentId, { metodo: 'confirmado_usuario' }))
        .catch(() => {});
    }
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { backgroundColor: 'transparent', flex: 1 },
        scroll: {
          flexGrow: 1,
          justifyContent: 'center',
          paddingHorizontal: 16,
          paddingVertical: 40,
        },
        panel: {
          borderRadius: 20,
          borderWidth: 1.2,
          padding: 24,
          backgroundColor: t.boxBg,
          borderColor: t.overlayBorder,
          shadowColor: t.brand,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 10,
        },
        title: {
          color: t.subText,
          fontSize: 20,
          fontWeight: 'bold',
          marginBottom: 18,
          textAlign: 'center',
        },
        btnPrimary: {
          alignItems: 'center',
          ...t.buttonPrimary,
          borderRadius: 10,
          marginBottom: 14,
          paddingVertical: 14,
        },
        btnTextOn: t.buttonPrimaryText,

        btnSecondary: {
          alignItems: 'center',
          backgroundColor: t.faintStrong,
          borderColor: t.overlayBorder,
          borderRadius: 10,
          borderWidth: 1,
          marginBottom: 20,
          paddingVertical: 14,
        },
        btnText: { color: t.text, fontWeight: 'bold' },

        volverWrap: { alignItems: 'center', marginTop: 6 },
        volverText: { color: t.text, fontSize: 16 },
      }),
    [t],
  );

  return (
    <BackgroundWrapper plan={plan}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 20}
        style={styles.root}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.panel}>
            <Text style={styles.title}>Seleccioná tu forma de pago</Text>

            <TouchableOpacity
              style={styles.btnPrimary}
              onPress={async () => {
                await crearIntentoPago('mp');
                const url = paymentUrl || 'https://www.mercadopago.com.ar/';
                try { await Linking.openURL(url); } catch {}
              }}
            >
              <Text style={styles.btnTextOn}>💳 Pagar con MercadoPago</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.btnPrimary}
              onPress={async () => {
                await copiarDatos('Alias: waitomo.gym / CBU: 0000003100001234567890');
                await crearIntentoPago('transferencia');
              }}
            >
              <Text style={styles.btnTextOn}>🏦 Transferencia bancaria</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.btnPrimary}
              onPress={async () => {
                await copiarDatos('Alias Cuenta DNI: waitomo.dni');
                await crearIntentoPago('cuenta_dni');
              }}
            >
              <Text style={styles.btnTextOn}>🟡 Cuenta DNI</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.btnPrimary}
              onPress={async () => {
                await copiarDatos('Alias CVU: waitomo.billetera');
                await crearIntentoPago('modo');
              }}
            >
              <Text style={styles.btnTextOn}>🍋 MODO / Lemon u otras</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.btnPrimary}
              onPress={async () => {
                Alert.alert('💬 Pagá directamente en el box con efectivo.');
                await crearIntentoPago('efectivo');
              }}
            >
              <Text style={styles.btnTextOn}>💵 Efectivo en el box</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.btnSecondary} onPress={handlePagoConfirmado}>
              <Text style={styles.btnText}>✅ Ya pagué (avisar)</Text>
            </TouchableOpacity>

            <View style={styles.volverWrap}>
              <TouchableOpacity onPress={() => navigation.goBack()}>
                <Text style={styles.volverText}>⬅ Volver</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </BackgroundWrapper>
  );
}

PagoScreen.propTypes = {
  route: PropTypes.shape({
    params: PropTypes.shape({
      plan: PropTypes.any,
      userData: PropTypes.any,
      abono: PropTypes.any,
    }),
  }),
  navigation: PropTypes.shape({
    navigate: PropTypes.func.isRequired,
    goBack: PropTypes.func.isRequired,
  }).isRequired,
};