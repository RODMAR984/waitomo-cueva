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

export default function AdminAbonosScreen() {
  const navigation = useNavigation();
  const { t } = useThemeContext();
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
  const [formPriceCents, setFormPriceCents] = useState('');
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
    setFormPriceCents(row.price_cents != null ? String(row.price_cents) : '');
    setShowNew(false);
  };

  const openNew = () => {
    setEditingId(null);
    setFormPlanId(plans[0]?.code || '');
    setFormName('');
    setFormDurationDays('30');
    setFormIncludedSessions('');
    setFormPriceCents('');
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
      Alert.alert('Datos', 'Plan y nombre del abono son obligatorios.');
      return;
    }
    if (!orgId || !isOwner) {
      Alert.alert('Sin permiso', 'Solo el dueño puede crear o editar abonos.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        plan_id: planId,
        name,
        duration_days: formDurationDays ? parseInt(formDurationDays, 10) : null,
        included_sessions: formIncludedSessions ? parseInt(formIncludedSessions, 10) : null,
        price_cents: formPriceCents ? parseInt(formPriceCents, 10) : null,
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
      Alert.alert('Error', e?.message || 'No se pudo guardar.');
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
      Alert.alert('Error', e?.message || 'No se pudo actualizar.');
    }
  };

  const formatPrice = (cents) => {
    if (cents == null) return '—';
    return `$${Math.round(cents / 100).toLocaleString('es-AR')}`;
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, padding: 20, paddingTop: 56 },
        header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
        backBtn: { padding: 8, marginLeft: -8 },
        title: { color: t.text, fontSize: 22, fontWeight: '800' },
        btn: { ...t.buttonPrimary, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16 },
        btnText: { ...t.buttonPrimaryText, fontSize: 14 },
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
            <Text style={styles.title}>Abonos</Text>
            {isOwner && (
              <TouchableOpacity style={styles.btn} onPress={openNew} activeOpacity={0.9}>
                <Text style={styles.btnText}>Nuevo</Text>
              </TouchableOpacity>
            )}
          </View>

          {plans.length > 0 && (
            <View style={styles.filterRow}>
              <Text style={styles.filterLabel}>Plan:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
                <TouchableOpacity
                  style={[styles.btn, filterPlanId === '' ? {} : { backgroundColor: t.overlayBorder }]}
                  onPress={() => setFilterPlanId('')}
                >
                  <Text style={styles.btnText}>Todos</Text>
                </TouchableOpacity>
                {plans.map((pl) => (
                  <TouchableOpacity
                    key={pl.id}
                    style={[styles.btn, filterPlanId === pl.code ? {} : { backgroundColor: t.overlayBorder }, { marginLeft: 8 }]}
                    onPress={() => setFilterPlanId(pl.code)}
                  >
                    <Text style={styles.btnText}>{pl.title}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {formVisible && isOwner && (
            <View style={styles.formWrap}>
              <Text style={styles.label}>Plan (código) *</Text>
              <TextInput
                style={styles.input}
                value={formPlanId}
                onChangeText={setFormPlanId}
                placeholder="cross"
                placeholderTextColor={t.placeholder}
              />
              <Text style={styles.label}>Nombre del abono *</Text>
              <TextInput
                style={styles.input}
                value={formName}
                onChangeText={setFormName}
                placeholder="4 clases / mes"
                placeholderTextColor={t.placeholder}
              />
              <Text style={styles.label}>Días de duración</Text>
              <TextInput
                style={styles.input}
                value={formDurationDays}
                onChangeText={setFormDurationDays}
                placeholder="30"
                placeholderTextColor={t.placeholder}
                keyboardType="number-pad"
              />
              <Text style={styles.label}>Clases incluidas (vacío = ilimitado)</Text>
              <TextInput
                style={styles.input}
                value={formIncludedSessions}
                onChangeText={setFormIncludedSessions}
                placeholder="4, 8, 12..."
                placeholderTextColor={t.placeholder}
                keyboardType="number-pad"
              />
              <Text style={styles.label}>Precio en centavos (ej: 25000 = $250)</Text>
              <TextInput
                style={styles.input}
                value={formPriceCents}
                onChangeText={setFormPriceCents}
                placeholder="25000"
                placeholderTextColor={t.placeholder}
                keyboardType="number-pad"
              />
              <View style={styles.row}>
                <TouchableOpacity style={[styles.btn, { flex: 1 }]} onPress={saveAbono} disabled={saving}>
                  {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.btnText}>Guardar</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, { flex: 1, backgroundColor: t.overlayBorder }]} onPress={cancelForm}>
                  <Text style={styles.btnText}>Cancelar</Text>
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
              <Text style={styles.emptyText}>No hay abonos para este plan. Creá uno desde "Nuevo".</Text>
            </View>
          ) : (
            abonos.map((a) => (
              <View key={a.id} style={styles.card}>
                <View style={styles.cardLeft}>
                  <Text style={styles.cardTitle}>{a.name}</Text>
                  <Text style={styles.cardMeta}>
                    {a.plan_id} · {a.duration_days != null ? `${a.duration_days} días` : '—'} · {a.included_sessions != null ? `${a.included_sessions} clases` : 'ilimitado'} · {formatPrice(a.price_cents)} · {a.is_active ? 'Activo' : 'Inactivo'}
                  </Text>
                </View>
                {isOwner && (
                  <>
                    <Switch value={!!a.is_active} onValueChange={() => toggleActive(a)} trackColor={{ false: t.overlayBorder, true: t.brand }} />
                    <TouchableOpacity onPress={() => openEdit(a)} style={{ padding: 8 }}>
                      <Ionicons name="pencil" size={22} color={t.brand} />
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
