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
import { useLocale } from '../contexts/LocaleContext';
import { normalizePlanKey } from '../utils/planKeyNormalize';
import { abonoCoversUserPlan, isUserAbonoActive } from '../utils/clientWorkoutEntitlement';

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

  const effectivePlanKey = useMemo(
    () => normalizePlanKey(route?.params?.planKey || route?.params?.plan?.id || profile?.plan_actual),
    [route?.params?.planKey, route?.params?.plan?.id, profile?.plan_actual],
  );

  const [loading, setLoading] = useState(true);
  const [sub, setSub] = useState(route?.params?.subscription || null);
  const [abono, setAbono] = useState(route?.params?.abono || null);

  const { t } = useThemeContext();
  const { t: tStr } = useLocale();

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        if (!user?.id) return;

        // 1) Traer abonos recientes y elegir el que corresponde al plan actual (p. ej. Yoga), no solo el último creado
        const { data, error } = await supabase
          .from('user_abonos')
          .select('id, user_id, abono_id, plan_id, status, start_date, end_date, sessions_total, sessions_used, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(40);

        if (error) throw error;

        const rows = Array.isArray(data) ? data : [];
        const pk = effectivePlanKey;
        let candidates = pk ? rows.filter((r) => abonoCoversUserPlan(r, pk)) : rows;
        if (candidates.length === 0 && pk) {
          candidates = rows;
        }

        const row =
          candidates.find((r) => isUserAbonoActive(r)) ||
          candidates.find((r) => String(r?.status || '').toLowerCase() === 'pending') ||
          candidates[0] ||
          null;

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
          Alert.alert(tStr('gym_config_alert_title_error'), e?.message || tStr('detalle_abono_load_error'));
        }
      }
    };

    load();
    return () => {
      alive = false;
    };
  }, [user?.id, effectivePlanKey]);

  const start = sub?.start_date ? fmtDate(sub.start_date) : null;
  const end = sub?.end_date ? fmtDate(sub.end_date) : null;
  const dl = sub?.end_date ? daysLeft(sub.end_date) : null;

  const status = sub?.status || 'pending';

  const statusLabel = useMemo(() => {
    if (status === 'active') return tStr('detalle_abono_status_active');
    if (status === 'pending') return tStr('detalle_abono_status_pending');
    if (status === 'expired') return tStr('detalle_abono_status_expired');
    if (status === 'cancelled') return tStr('detalle_abono_status_cancelled');
    return status;
  }, [status, tStr]);

  const dash = tStr('detalle_abono_dash');

  const handleRenovar = () => {
    const k = effectivePlanKey;
    if (!k) {
      navigation.navigate('PlanSelector');
      return;
    }
    navigation.navigate('AbonosPases', {
      plan: { id: String(k), name: String(k), title: String(k).toUpperCase() },
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
          <Text style={styles.title}>{tStr('detalle_abono_title')}</Text>
          <Text style={styles.subtitle}>{tStr('detalle_abono_subtitle')}</Text>
        </View>

        {loading ? (
          <View style={styles.panel}>
            <ActivityIndicator color={t.brand} />
            <Text style={[styles.subtitle, { marginTop: 10 }]}>{tStr('detalle_abono_loading')}</Text>
          </View>
        ) : !sub ? (
          <View style={styles.panel}>
            <Text style={styles.subtitle}>{tStr('detalle_abono_empty')}</Text>
            <TouchableOpacity style={styles.btn} onPress={handleRenovar} activeOpacity={0.9}>
              <Ionicons name="card-outline" size={18} color={t.text} />
              <Text style={styles.btnText}>{tStr('detalle_abono_see_plans')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.panel}>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>{tStr('detalle_abono_label_plan')}</Text>
              <Text style={styles.rowValue}>{abono?.name || tStr('detalle_abono_fallback_name')}</Text>
              {!!abono?.included_sessions && (
                <Text style={styles.hint}>
                  {tStr('detalle_abono_sessions_hint').replace('{{n}}', String(abono.included_sessions))}
                </Text>
              )}
              {!!abono?.duration_days && (
                <Text style={styles.hint}>
                  {tStr('detalle_abono_duration_hint').replace('{{n}}', String(abono.duration_days))}
                </Text>
              )}
            </View>

            <View style={styles.row}>
              <Text style={styles.rowLabel}>{tStr('detalle_abono_label_status')}</Text>
              <Text style={styles.rowValue}>{statusLabel}</Text>
              {status === 'pending' && <Text style={styles.hint}>{tStr('detalle_abono_pending_hint')}</Text>}
            </View>

            <View style={styles.row}>
              <Text style={styles.rowLabel}>{tStr('detalle_abono_label_validity')}</Text>
              <Text style={styles.rowValue}>
                {start ? tStr('detalle_abono_start_line').replace('{{date}}', start) : tStr('detalle_abono_start_line').replace('{{date}}', dash)}
                {'\n'}
                {end ? tStr('detalle_abono_end_line').replace('{{date}}', end) : tStr('detalle_abono_end_line').replace('{{date}}', dash)}
              </Text>
              {typeof dl === 'number' && (
                <Text style={styles.hint}>{tStr('detalle_abono_days_left').replace('{{n}}', String(dl))}</Text>
              )}
            </View>

            <TouchableOpacity style={styles.btn} onPress={handleRenovar} activeOpacity={0.9}>
              <Ionicons name="refresh-outline" size={18} color={t.text} />
              <Text style={styles.btnText}>{tStr('detalle_abono_renew')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
              <Text style={styles.backText}>{tStr('detalle_abono_back')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </BackgroundWrapper>
  );
}
