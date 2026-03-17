// screens/DetalleAbonoScreen.js — Detalle del abono activo (vencimiento / renovación)
// - Se abre desde la cajita superior "Plan" del ClientScreen
// - Muestra vigencia, estado, días restantes
// - Botón para ir a Abonos y Pases (renovar / cambiar)

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabaseClient';
import BackgroundWrapper from '../components/BackgroundWrapper';
import { colors } from '../theme/colors';
import { useThemeContext } from '../contexts/ThemeContext';

// helpers
const hexToRgba = (hex, alpha = 1) => {
  const clean = String(hex || '').replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const r = parseInt(full.substring(0, 2), 16) || 0;
  const g = parseInt(full.substring(2, 4), 16) || 0;
  const b = parseInt(full.substring(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
};

const fmtDate = (iso) => {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear());
    return `${dd}/${mm}/${yy}`;
  } catch {
    return null;
  }
};

const daysLeft = (endIso) => {
  if (!endIso) return null;
  const end = new Date(endIso);
  if (Number.isNaN(end.getTime())) return null;
  const now = new Date();
  return Math.ceil((end.getTime() - now.getTime()) / 86400000);
};

export default function DetalleAbonoScreen({ navigation, route }) {
  const { user, profile } = useAuth() || {};
  const planKey = route?.params?.planKey || profile?.plan_actual || null;

  const [loading, setLoading] = useState(true);
  const [sub, setSub] = useState(route?.params?.subscription || null);
  const [abono, setAbono] = useState(route?.params?.abono || null);

  const { t } = useThemeContext();

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        if (!user?.id) return;

        // 1) Traer último abono del usuario
        const { data, error } = await supabase
          .from('user_abonos')
          .select('id, user_id, abono_id, plan_id, status, start_date, end_date, sessions_total, sessions_used, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1);

        if (error) throw error;

        const row = Array.isArray(data) ? data[0] : null;
        if (!row) {
          if (alive) {
            setSub(null);
            setAbono(null);
            setLoading(false);
          }
          return;
        }

        // 2) Traer detalle de abono desde public.abonos (sin price_cents)
        const abonoId = row.abono_id;
        let abonoRow = null;

        if (abonoId) {
          const { data: aData, error: aErr } = await supabase
            .from('abonos')
            .select('id, plan_id, name, duration_days, included_sessions, currency, is_active')
            .eq('id', abonoId)
            .limit(1);

          if (!aErr) abonoRow = Array.isArray(aData) ? aData[0] : null;
        }

        if (alive) {
          setSub(row);
          setAbono(abonoRow);
          setLoading(false);
        }
      } catch (e) {
        if (alive) {
          setLoading(false);
          Alert.alert('Error', e?.message || 'No se pudo cargar el detalle del abono.');
        }
      }
    };

    load();
    return () => {
      alive = false;
    };
  }, [user?.id]);

  const start = sub?.start_date ? fmtDate(sub.start_date) : null;
  const end = sub?.end_date ? fmtDate(sub.end_date) : null;
  const dl = sub?.end_date ? daysLeft(sub.end_date) : null;

  const status = sub?.status || 'pending';

  const statusLabel =
    status === 'active'
      ? 'Activo'
      : status === 'pending'
      ? 'Pendiente de confirmación'
      : status === 'expired'
      ? 'Vencido'
      : status === 'cancelled'
      ? 'Cancelado'
      : status;

  const handleRenovar = () => {
    if (!planKey) {
      navigation.navigate('PlanSelector');
      return;
    }
    navigation.navigate('AbonosPases', {
      plan: { id: String(planKey), name: String(planKey), title: String(planKey).toUpperCase() },
      renewal: true,
    });
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1 },
        scroll: { paddingHorizontal: 20, paddingTop: 70, paddingBottom: 40 },
        panel: {
          backgroundColor: t.boxBg,
          borderColor: t.overlayBorder,
          borderWidth: 1,
          borderRadius: 22,
          padding: 18,
          marginBottom: 16,
        },
        title: { color: t.text, fontSize: 20, fontWeight: '900', textAlign: 'center' },
        subtitle: { color: t.subText, fontSize: 12, textAlign: 'center', marginTop: 6 },
        row: {
          marginTop: 14,
          backgroundColor: t.boxBg,
          borderRadius: 16,
          padding: 14,
          borderWidth: 1,
          borderColor: t.overlayBorder,
        },
        rowLabel: { color: t.subText, fontSize: 11 },
        rowValue: { color: t.text, fontSize: 15, fontWeight: '800', marginTop: 4 },
        hint: { color: t.subText, fontSize: 11, marginTop: 6 },
        btn: {
          marginTop: 14,
          alignSelf: 'center',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 18,
          paddingVertical: 12,
          borderRadius: 999,
          ...t.buttonPrimary,
        },
        btnText: { marginLeft: 8, ...t.buttonPrimaryText, fontSize: 13 },
        back: { marginTop: 12, alignSelf: 'center' },
        backText: { color: t.subText, fontSize: 12, fontWeight: '700' },
      }),
    [t]
  );

  return (
    <BackgroundWrapper screen="TrabajoDelDia">
      <ScrollView style={styles.root} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.panel}>
          <Text style={styles.title}>Detalle de tu abono</Text>
          <Text style={styles.subtitle}>Estado, vigencia y renovación (confirmación por admin).</Text>
        </View>

        {loading ? (
          <View style={styles.panel}>
            <ActivityIndicator color={t.brand} />
            <Text style={[styles.subtitle, { marginTop: 10 }]}>Cargando…</Text>
          </View>
        ) : !sub ? (
          <View style={styles.panel}>
            <Text style={styles.subtitle}>No hay un abono cargado todavía.</Text>
            <TouchableOpacity style={styles.btn} onPress={handleRenovar} activeOpacity={0.9}>
              <Ionicons name="card-outline" size={18} color={t.text} />
              <Text style={styles.btnText}>Ver abonos y pases</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.panel}>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Abono</Text>
              <Text style={styles.rowValue}>{abono?.name || 'Abono'}</Text>
              {!!abono?.included_sessions && <Text style={styles.hint}>{abono.included_sessions} clases incluidas</Text>}
              {!!abono?.duration_days && <Text style={styles.hint}>Duración: {abono.duration_days} días</Text>}
            </View>

            <View style={styles.row}>
              <Text style={styles.rowLabel}>Estado</Text>
              <Text style={styles.rowValue}>{statusLabel}</Text>
              {status === 'pending' && (
                <Text style={styles.hint}>Tu pago fue avisado. Falta confirmación de administración.</Text>
              )}
            </View>

            <View style={styles.row}>
              <Text style={styles.rowLabel}>Vigencia</Text>
              <Text style={styles.rowValue}>
                {start ? `Inicio: ${start}` : 'Inicio: —'}
                {'\n'}
                {end ? `Vence: ${end}` : 'Vence: —'}
              </Text>
              {typeof dl === 'number' && <Text style={styles.hint}>Quedan {dl} días</Text>}
            </View>

            <TouchableOpacity style={styles.btn} onPress={handleRenovar} activeOpacity={0.9}>
              <Ionicons name="refresh-outline" size={18} color={t.text} />
              <Text style={styles.btnText}>Renovar / Cambiar abono</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
              <Text style={styles.backText}>← Volver</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </BackgroundWrapper>
  );
}
