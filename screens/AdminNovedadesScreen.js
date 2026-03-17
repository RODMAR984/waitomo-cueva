// AdminNovedadesScreen — Solo admin/superadmin. Crear, editar, fijar y activar/desactivar gym_news (novedades del panel cliente y coach).

import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import BackgroundWrapper from '../components/BackgroundWrapper';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { useThemeContext } from '../contexts/ThemeContext';

const hexToRgba = (hex, alpha) => {
  const clean = String(hex || '').replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
};

const formatDate = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '';
  }
};

export default function AdminNovedadesScreen() {
  const navigation = useNavigation();
  const { t } = useThemeContext();
  const { currentUser } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formTitle, setFormTitle] = useState('');
  const [formBody, setFormBody] = useState('');
  const [formTag, setFormTag] = useState('');
  const [formPinned, setFormPinned] = useState(false);
  const [formActive, setFormActive] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);

  const loadNews = async () => {
    try {
      const { data, error } = await supabase
        .from('gym_news')
        .select('id, title, body, tag, pinned, is_active, created_at')
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNews();
  }, []);

  const openEdit = (row) => {
    setEditingId(row.id);
    setFormTitle(row.title || '');
    setFormBody(row.body || '');
    setFormTag(row.tag || '');
    setFormPinned(!!row.pinned);
    setFormActive(row.is_active !== false);
    setShowNewForm(false);
  };

  const openNew = () => {
    setEditingId(null);
    setFormTitle('');
    setFormBody('');
    setFormTag('');
    setFormPinned(false);
    setFormActive(true);
    setShowNewForm(true);
  };

  const cancelForm = () => {
    setEditingId(null);
    setShowNewForm(false);
  };

  const saveItem = async () => {
    const title = (formTitle || '').trim();
    if (!title) {
      Alert.alert('Falta título', 'El título es obligatorio.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title,
        body: (formBody || '').trim() || null,
        tag: (formTag || '').trim() || null,
        pinned: formPinned,
        is_active: formActive,
      };
      if (editingId) {
        const { error } = await supabase.from('gym_news').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('gym_news').insert({ ...payload, created_by: currentUser?.id || null });
        if (error) throw error;
      }
      cancelForm();
      await loadNews();
    } catch (e) {
      Alert.alert('Error', e?.message || 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (row) => {
    try {
      const { error } = await supabase
        .from('gym_news')
        .update({ is_active: !row.is_active })
        .eq('id', row.id);
      if (error) throw error;
      await loadNews();
    } catch (e) {
      Alert.alert('Error', e?.message || 'No se pudo actualizar.');
    }
  };

  const deleteItem = (row) => {
    Alert.alert(
      'Eliminar novedad',
      `¿Eliminar "${(row.title || '').slice(0, 40)}..."? Los clientes ya no la verán.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.from('gym_news').update({ is_active: false }).eq('id', row.id);
              if (error) throw error;
              await loadNews();
              if (editingId === row.id) cancelForm();
            } catch (e) {
              Alert.alert('Error', e?.message || 'No se pudo eliminar.');
            }
          },
        },
      ]
    );
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
        },
        cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
        cardTitle: { color: t.text, fontSize: 15, fontWeight: '600', flex: 1 },
        cardMeta: { color: t.subText, fontSize: 12, marginTop: 4 },
        badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginLeft: 6 },
        badgePinned: { backgroundColor: hexToRgba(t.brand, 0.25) },
        badgeInactive: { backgroundColor: 'rgba(128,128,128,0.3)' },
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
        textArea: { minHeight: 80, textAlignVertical: 'top' },
        row: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
        switchLabel: { color: t.text, fontSize: 14, marginLeft: 10, flex: 1 },
        actions: { flexDirection: 'row', gap: 10, marginTop: 8 },
        empty: { paddingVertical: 40, alignItems: 'center' },
        emptyText: { color: t.placeholder, fontSize: 16 },
      }),
    [t]
  );

  const formVisible = showNewForm || editingId;

  return (
    <BackgroundWrapper screen="admin">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView style={styles.screen} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
              <Ionicons name="arrow-back" size={26} color={t.text} />
            </TouchableOpacity>
            <Text style={styles.title}>Novedades</Text>
            <TouchableOpacity style={styles.btn} onPress={openNew} activeOpacity={0.9}>
              <Text style={styles.btnText}>Nueva</Text>
            </TouchableOpacity>
          </View>

          {formVisible && (
            <View style={styles.formWrap}>
              <Text style={styles.label}>Título *</Text>
              <TextInput
                style={styles.input}
                value={formTitle}
                onChangeText={setFormTitle}
                placeholder="Título de la novedad"
                placeholderTextColor={t.placeholder}
              />
              <Text style={styles.label}>Cuerpo (opcional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formBody}
                onChangeText={setFormBody}
                placeholder="Texto completo..."
                placeholderTextColor={t.placeholder}
                multiline
              />
              <Text style={styles.label}>Etiqueta (opcional)</Text>
              <TextInput
                style={styles.input}
                value={formTag}
                onChangeText={setFormTag}
                placeholder="Ej: Horarios"
                placeholderTextColor={t.placeholder}
              />
              <View style={styles.row}>
                <Switch value={formPinned} onValueChange={setFormPinned} trackColor={{ false: t.border, true: t.brand }} thumbColor="#fff" />
                <Text style={styles.switchLabel}>Fijada (aparece primero)</Text>
              </View>
              <View style={styles.row}>
                <Switch value={formActive} onValueChange={setFormActive} trackColor={{ false: t.border, true: t.brand }} thumbColor="#fff" />
                <Text style={styles.switchLabel}>Visible para clientes y coaches</Text>
              </View>
              <View style={styles.actions}>
                <TouchableOpacity style={styles.btn} onPress={saveItem} disabled={saving} activeOpacity={0.9}>
                  <Text style={styles.btnText}>{saving ? 'Guardando...' : 'Guardar'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, { backgroundColor: t.inputBg, borderColor: t.overlayBorder }]}
                  onPress={cancelForm}
                  activeOpacity={0.9}
                >
                  <Text style={[styles.btnText, { color: t.text }]}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {loading ? (
            <View style={styles.empty}>
              <ActivityIndicator size="large" color={t.brand} />
            </View>
          ) : items.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No hay novedades. Creá una con "Nueva".</Text>
            </View>
          ) : (
            items.map((row) => (
              <View key={row.id} style={styles.card}>
                <View style={styles.cardRow}>
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {row.title || 'Sin título'}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {row.pinned && (
                      <View style={[styles.badge, styles.badgePinned]}>
                        <Text style={{ color: t.brand, fontSize: 10, fontWeight: '700' }}>FIJA</Text>
                      </View>
                    )}
                    {!row.is_active && (
                      <View style={[styles.badge, styles.badgeInactive]}>
                        <Text style={{ color: t.subText, fontSize: 10 }}>Oculta</Text>
                      </View>
                    )}
                  </View>
                </View>
                <Text style={styles.cardMeta}>
                  {formatDate(row.created_at)}
                  {row.tag ? ` · ${row.tag}` : ''}
                </Text>
                <View style={[styles.actions, { marginTop: 12 }]}>
                  <TouchableOpacity style={styles.btn} onPress={() => openEdit(row)} activeOpacity={0.9}>
                    <Text style={styles.btnText}>Editar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.btn, { backgroundColor: t.inputBg, borderColor: t.overlayBorder }]}
                    onPress={() => toggleActive(row)}
                    activeOpacity={0.9}
                  >
                    <Text style={[styles.btnText, { color: t.text }]}>{row.is_active ? 'Ocultar' : 'Mostrar'}</Text>
                  </TouchableOpacity>
                  {row.is_active && (
                    <TouchableOpacity
                      style={[styles.btn, { ...t.buttonDanger }]}
                      onPress={() => deleteItem(row)}
                      activeOpacity={0.9}
                    >
                      <Text style={t.buttonDangerText}>Eliminar</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </BackgroundWrapper>
  );
}
