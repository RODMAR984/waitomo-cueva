// AdminAbonosScreen — CRUD de abonos por plan/organización. Fase 4.

import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import BackgroundWrapper from '../components/BackgroundWrapper';
import { useAuth } from '../contexts/AuthContext';
import { useLocale } from '../contexts/LocaleContext';
import { useThemeContext } from '../contexts/ThemeContext';
import { supabase } from '../supabaseClient';

const hexToRgba = (hex, alpha) => {
  const clean = String(hex || '').replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
};

/** Entrada en pesos (ej. 25000 o 25.000 o 25000,50) → centavos para `price_cents`. */
function pesosInputToCents(raw) {
  const s = String(raw ?? '').trim().replace(/\s/g, '');
  if (!s) return null;
  let n;
  if (s.includes(',')) {
    const parts = s.split(',');
    if (parts.length !== 2) return null;
    const intPart = parts[0].replace(/\./g, '');
    n = parseFloat(`${intPart}.${parts[1]}`);
  } else {
    n = parseFloat(s.replace(/\./g, ''));
  }
  if (Number.isNaN(n) || n < 0) return null;
  return Math.round(n * 100);
}

export default function AdminAbonosScreen() {
  const navigation = useNavigation();
  const { t } = useThemeContext();
  const { t: tStr, locale } = useLocale();
  const { profile, organization } = useAuth() || {};
  const orgId = organization?.id || profile?.organization_id;

  const [plans, setPlans] = useState([]);
  const [abonos, setAbonos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [formPlanId, setFormPlanId] = useState('');
  const [formName, setFormName] = useState('');
  const [formDurationDays, setFormDurationDays] = useState('30');
  const [formIncludedSessions, setFormIncludedSessions] = useState('');
  const [formPricePesos, setFormPricePesos] = useState('');
  const [filterPlanId, setFilterPlanId] = useState('');

  const isOwner = organization?.owner_id === profile?.id;

  const loadPlans = async () => {
    if (!orgId) return;
    try {
      const { data } = await supabase.from('plans').select('id, code, title').eq('organization_id', orgId).order('order');
      setPlans(Array.isArray(data) ? data : []);
      if (data?.length && !formPlanId) setFormPlanId(data[0].code);
    } catch (e) {
      setPlans([]);
    }
  };

  const loadAbonos = async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      let q = supabase
        .from('abonos')
        .select('id, plan_id, name, duration_days, included_sessions, price_cents, currency, is_active')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });
      if (filterPlanId) q = q.eq('plan_id', filterPlanId);
      const { data, error } = await q;
      if (error) throw error;
      setAbonos(Array.isArray(data) ? data : []);
    } catch (e) {
      console.log('AdminAbonos load:', e?.message || e);
      setAbonos([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlans();
  }, [orgId]);

  useEffect(() => {
    loadAbonos();
  }, [orgId, filterPlanId]);

  const openEdit = (row) => {
    setEditingId(row.id);
    setFormPlanId(row.plan_id || '');
    setFormName(row.name || '');
    setFormDurationDays(row.duration_days != null ? String(row.duration_days) : '30');
    setFormIncludedSessions(row.included_sessions != null ? String(row.included_sessions) : '');
    setFormPricePesos(
      row.price_cents != null && row.price_cents > 0 ? String(Math.round(row.price_cents / 100)) : '',
    );
    setShowNew(false);
  };

  const openNew = () => {
    setEditingId(null);
    setFormPlanId(plans[0]?.code || '');
    setFormName('');
    setFormDurationDays('30');
    setFormIncludedSessions('');
    setFormPricePesos('');
    setShowNew(true);
  };

  const cancelForm = () => {
    setEditingId(null);
    setShowNew(false);
  };

  const saveAbono = async () => {
    const name = (formName || '').trim();
    const planId = (formPlanId || '').trim();
    if (!name || !planId) {
      Alert.alert(tStr('admin_abonos_alert_data_title'), tStr('admin_abonos_alert_data_body'));
      return;
    }
    if (!orgId || !isOwner) {
      Alert.alert(tStr('gym_config_alert_title_error'), tStr('admin_abonos_no_permission'));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        plan_id: planId,
        name,
        duration_days: formDurationDays ? parseInt(formDurationDays, 10) : null,
        included_sessions: formIncludedSessions ? parseInt(formIncludedSessions, 10) : null,
        price_cents: pesosInputToCents(formPricePesos),
        currency: 'ARS',
        is_active: true,
      };
      if (editingId) {
        const { error } = await supabase.from('abonos').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('abonos').insert({ ...payload, organization_id: orgId });
        if (error) throw error;
      }
      cancelForm();
      await loadAbonos();
    } catch (e) {
      Alert.alert(tStr('gym_config_alert_title_error'), e?.message || tStr('admin_crud_save_fail'));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (row) => {
    try {
      const { error } = await supabase.from('abonos').update({ is_active: !row.is_active }).eq('id', row.id);
      if (error) throw error;
      await loadAbonos();
    } catch (e) {
      Alert.alert(tStr('gym_config_alert_title_error'), e?.message || tStr('admin_crud_update_fail'));
    }
  };

  const formatPrice = (cents) => {
    if (cents == null) return tStr('detalle_abono_dash');
    const loc = locale === 'en' ? 'en-US' : 'es-AR';
    return `$${Math.round(cents / 100).toLocaleString(loc)}`;
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, padding: 20, paddingTop: 56 },
        header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
        backBtn: { padding: 8, marginLeft: -8 },
        title: { color: t.text, fontSize: 22, fontWeight: '800' },
        /** Única acción primaria fuerte (ej. Nuevo). */
        btn: { ...t.buttonPrimary, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16 },
        btnText: { ...t.buttonPrimaryText, fontSize: 14 },
        /**
         * Chips de filtro por plan (ej. Todos / CROSS TRAINING): mismo sistema que cajas/bordes de org
         * (`boxBg`, `border` / `overlayBorder` desde Gym Config), no un recuadro “extra” solo con acento.
         */
        filterChip: {
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          backgroundColor: t.inputBg,
        },
        filterChipActive: {
          borderWidth: 2,
          borderColor: t.border,
          backgroundColor: t.boxBg,
        },
        filterChipText: { color: t.subText, fontSize: 13, fontWeight: '600' },
        filterChipTextActive: { color: t.text, fontSize: 13, fontWeight: '700' },
        filterRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8 },
        filterLabel: { color: t.subText, fontSize: 13 },
        list: { paddingBottom: 40 },
        card: {
          backgroundColor: t.boxBg,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          borderRadius: 14,
          padding: 14,
          marginBottom: 12,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        },
        cardLeft: { flex: 1 },
        cardTitle: { color: t.text, fontSize: 15, fontWeight: '600' },
        cardMeta: { color: t.subText, fontSize: 12, marginTop: 4 },
        formWrap: {
          backgroundColor: t.boxBg,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          borderRadius: 14,
          padding: 16,
          marginBottom: 16,
        },
        label: { color: t.subText, fontSize: 13, marginBottom: 6, fontWeight: '600' },
        input: {
          borderWidth: 1,
          borderColor: t.overlayBorder,
          borderRadius: 10,
          padding: 12,
          color: t.text,
          backgroundColor: t.inputBg,
          marginBottom: 12,
          fontSize: 15,
        },
        row: { flexDirection: 'row', gap: 10, marginTop: 8 },
        empty: { paddingVertical: 40, alignItems: 'center' },
        emptyText: { color: t.placeholder, fontSize: 16 },
      }),
    [t]
  );

  const formVisible = showNew || editingId;

  return (
    <BackgroundWrapper screen="admin">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView style={styles.screen} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
              <Ionicons name="arrow-back" size={26} color={t.text} />
            </TouchableOpacity>
            <Text style={styles.title}>{tStr('admin_abonos_screen_title')}</Text>
            {isOwner && (
              <TouchableOpacity style={styles.btn} onPress={openNew} activeOpacity={0.9}>
                <Text style={styles.btnText}>{tStr('admin_plans_new')}</Text>
              </TouchableOpacity>
            )}
          </View>

          {plans.length > 0 && (
            <View style={styles.filterRow}>
              <Text style={styles.filterLabel}>{tStr('admin_abonos_filter_label')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
                <TouchableOpacity
                  style={[styles.filterChip, filterPlanId === '' && styles.filterChipActive]}
                  onPress={() => setFilterPlanId('')}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.filterChipText, filterPlanId === '' && styles.filterChipTextActive]}>
                    {tStr('admin_abonos_filter_all')}
                  </Text>
                </TouchableOpacity>
                {plans.map((pl) => (
                  <TouchableOpacity
                    key={pl.id}
                    style={[styles.filterChip, { marginLeft: 8 }, filterPlanId === pl.code && styles.filterChipActive]}
                    onPress={() => setFilterPlanId(pl.code)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.filterChipText, filterPlanId === pl.code && styles.filterChipTextActive]}>
                      {pl.title}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {formVisible && isOwner && (
            <View style={styles.formWrap}>
              <Text style={styles.label}>{tStr('admin_abonos_label_plan')}</Text>
              <TextInput
                style={styles.input}
                value={formPlanId}
                onChangeText={setFormPlanId}
                placeholder={tStr('admin_abonos_ph_plan')}
                placeholderTextColor={t.placeholder}
              />
              <Text style={styles.label}>{tStr('admin_abonos_label_name')}</Text>
              <TextInput
                style={styles.input}
                value={formName}
                onChangeText={setFormName}
                placeholder={tStr('admin_abonos_ph_name')}
                placeholderTextColor={t.placeholder}
              />
              <Text style={styles.label}>{tStr('admin_abonos_label_days')}</Text>
              <TextInput
                style={styles.input}
                value={formDurationDays}
                onChangeText={setFormDurationDays}
                placeholder={tStr('admin_abonos_ph_days')}
                placeholderTextColor={t.placeholder}
                keyboardType="number-pad"
              />
              <Text style={styles.label}>{tStr('admin_abonos_label_sessions')}</Text>
              <TextInput
                style={styles.input}
                value={formIncludedSessions}
                onChangeText={setFormIncludedSessions}
                placeholder={tStr('admin_abonos_ph_sessions')}
                placeholderTextColor={t.placeholder}
                keyboardType="number-pad"
              />
              <Text style={styles.label}>{tStr('admin_abonos_label_price')}</Text>
              <TextInput
                style={styles.input}
                value={formPricePesos}
                onChangeText={setFormPricePesos}
                placeholder={tStr('admin_abonos_ph_price')}
                placeholderTextColor={t.placeholder}
                keyboardType="decimal-pad"
              />
              <View style={styles.row}>
                <TouchableOpacity style={[styles.btn, { flex: 1 }]} onPress={saveAbono} disabled={saving}>
                  {saving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.btnText}>{tStr('common_save')}</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, { flex: 1, backgroundColor: t.overlayBorder }]} onPress={cancelForm}>
                  <Text style={styles.btnText}>{tStr('common_cancel')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {loading ? (
            <View style={styles.empty}>
              <ActivityIndicator size="large" color={t.brand} />
            </View>
          ) : abonos.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>{tStr('admin_abonos_empty')}</Text>
            </View>
          ) : (
            abonos.map((a) => (
              <View key={a.id} style={styles.card}>
                <View style={styles.cardLeft}>
                  <Text style={styles.cardTitle}>{a.name}</Text>
                  <Text style={styles.cardMeta}>
                    {a.plan_id} ·{' '}
                    {a.duration_days != null
                      ? tStr('admin_abonos_days_short').replace('{{n}}', String(a.duration_days))
                      : tStr('detalle_abono_dash')}{' '}
                    ·{' '}
                    {a.included_sessions != null
                      ? tStr('admin_abonos_sessions_short').replace('{{n}}', String(a.included_sessions))
                      : tStr('admin_abonos_unlimited')}{' '}
                    · {formatPrice(a.price_cents)} ·{' '}
                    {a.is_active ? tStr('admin_plans_state_on') : tStr('admin_plans_state_off')}
                  </Text>
                </View>
                {isOwner && (
                  <>
                    <Switch
                      value={!!a.is_active}
                      onValueChange={() => toggleActive(a)}
                      trackColor={{ false: t.overlayBorder, true: hexToRgba(t.brand, 0.35) }}
                      thumbColor={a.is_active ? t.brand : undefined}
                    />
                    <TouchableOpacity onPress={() => openEdit(a)} style={{ padding: 8 }}>
                      <Ionicons name="pencil" size={22} color={t.subText} />
                    </TouchableOpacity>
                  </>
                )}
              </View>
            ))
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </BackgroundWrapper>
  );
}
