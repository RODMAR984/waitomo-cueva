// AdminPlanesScreen — CRUD de planes por organización. Fase 4.

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

const MODES = [{ label: 'Clases', value: 'class' }, { label: 'Programa', value: 'program' }];

export default function AdminPlanesScreen() {
  const navigation = useNavigation();
  const { t } = useThemeContext();
  const { profile, organization } = useAuth() || {};
  const orgId = organization?.id || profile?.organization_id;

  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [formCode, setFormCode] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formSubtitle, setFormSubtitle] = useState('');
  const [formMode, setFormMode] = useState('class');
  const [formOrder, setFormOrder] = useState('0');

  const isOwner = organization?.owner_id === profile?.id;

  const loadPlans = async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('plans')
        .select('id, code, title, subtitle, mode, active, order')
        .eq('organization_id', orgId)
        .order('order', { ascending: true });
      if (error) throw error;
      setPlans(Array.isArray(data) ? data : []);
    } catch (e) {
      console.log('AdminPlanes load:', e?.message || e);
      setPlans([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlans();
  }, [orgId]);

  const openEdit = (row) => {
    setEditingId(row.id);
    setFormCode(row.code || '');
    setFormTitle(row.title || '');
    setFormSubtitle(row.subtitle || '');
    setFormMode(row.mode || 'class');
    setFormOrder(String(row.order ?? 0));
    setShowNew(false);
  };

  const openNew = () => {
    setEditingId(null);
    setFormCode('');
    setFormTitle('');
    setFormSubtitle('');
    setFormMode('class');
    setFormOrder(String((plans.length + 1)));
    setShowNew(true);
  };

  const cancelForm = () => {
    setEditingId(null);
    setShowNew(false);
  };

  const savePlan = async () => {
    const code = (formCode || '').trim().toLowerCase().replace(/\s+/g, '_');
    const title = (formTitle || '').trim();
    if (!code || !title) {
      Alert.alert('Datos', 'Código y título son obligatorios (ej: cross, CROSS TRAINING).');
      return;
    }
    if (!orgId || !isOwner) {
      Alert.alert('Sin permiso', 'Solo el dueño puede crear o editar planes.');
      return;
    }
    setSaving(true);
    try {
      const orderNum = parseInt(formOrder, 10) || 0;
      if (editingId) {
        const { error } = await supabase
          .from('plans')
          .update({ code, title, subtitle: (formSubtitle || '').trim() || null, mode: formMode, order: orderNum })
          .eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('plans').insert({
          organization_id: orgId,
          code,
          title,
          subtitle: (formSubtitle || '').trim() || null,
          mode: formMode,
          active: true,
          order: orderNum,
        });
        if (error) throw error;
      }
      cancelForm();
      await loadPlans();
    } catch (e) {
      Alert.alert('Error', e?.message || 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (row) => {
    try {
      const { error } = await supabase.from('plans').update({ active: !row.active }).eq('id', row.id);
      if (error) throw error;
      await loadPlans();
    } catch (e) {
      Alert.alert('Error', e?.message || 'No se pudo actualizar.');
    }
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
            <Text style={styles.title}>Planes</Text>
            {isOwner && (
              <TouchableOpacity style={styles.btn} onPress={openNew} activeOpacity={0.9}>
                <Text style={styles.btnText}>Nuevo</Text>
              </TouchableOpacity>
            )}
          </View>

          {formVisible && isOwner && (
            <View style={styles.formWrap}>
              <Text style={styles.label}>Código (ej: cross, pase_total) *</Text>
              <TextInput
                style={styles.input}
                value={formCode}
                onChangeText={setFormCode}
                placeholder="cross"
                placeholderTextColor={t.placeholder}
                editable={!editingId}
              />
              <Text style={styles.label}>Título *</Text>
              <TextInput
                style={styles.input}
                value={formTitle}
                onChangeText={setFormTitle}
                placeholder="CROSS TRAINING"
                placeholderTextColor={t.placeholder}
              />
              <Text style={styles.label}>Subtítulo</Text>
              <TextInput
                style={styles.input}
                value={formSubtitle}
                onChangeText={setFormSubtitle}
                placeholder="Clases grupales"
                placeholderTextColor={t.placeholder}
              />
              <Text style={styles.label}>Orden</Text>
              <TextInput
                style={styles.input}
                value={formOrder}
                onChangeText={setFormOrder}
                placeholder="0"
                placeholderTextColor={t.placeholder}
                keyboardType="number-pad"
              />
              <View style={styles.row}>
                <TouchableOpacity style={[styles.btn, { flex: 1 }]} onPress={savePlan} disabled={saving}>
                  {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.btnText}>Guardar</Text>}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, { flex: 1, backgroundColor: t.overlayBorder }]}
                  onPress={cancelForm}
                >
                  <Text style={styles.btnText}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {loading ? (
            <View style={styles.empty}>
              <ActivityIndicator size="large" color={t.brand} />
            </View>
          ) : plans.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No hay planes. Creá uno desde "Nuevo".</Text>
            </View>
          ) : (
            plans.map((p) => (
              <View key={p.id} style={styles.card}>
                <View style={styles.cardLeft}>
                  <Text style={styles.cardTitle}>{p.title}</Text>
                  <Text style={styles.cardMeta}>{p.code} · orden {p.order} · {p.active ? 'Activo' : 'Inactivo'}</Text>
                </View>
                {isOwner && (
                  <>
                    <Switch value={!!p.active} onValueChange={() => toggleActive(p)} trackColor={{ false: t.overlayBorder, true: t.brand }} />
                    <TouchableOpacity onPress={() => openEdit(p)} style={{ padding: 8 }}>
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
