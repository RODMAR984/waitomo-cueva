// AdminNovedadesScreen — Solo admin/superadmin. Crear, editar, fijar y activar/desactivar gym_news (novedades del panel cliente y coach).

import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import ScreenShell from '../../components/ScreenShell';
import BackNavButton from '../../components/BackNavButton';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { useThemeContext } from '../../contexts/ThemeContext';
import { useLocale } from '../../contexts/LocaleContext';
import useStaffWebHideInlineBack from '../../hooks/useStaffWebHideInlineBack';
import { WEB_CONTENT_MAX_WIDTH } from '../../theme/webSpec';
import { MOBILE_RADII, MOBILE_SPACING, MOBILE_TYPE } from '../../theme/mobileSpec';

const hexToRgba = (hex, alpha) => {
  const clean = String(hex || '').replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
};

export default function AdminNovedadesScreen() {
  const navigation = useNavigation();
  const hideInlineBack = useStaffWebHideInlineBack();
  const { t } = useThemeContext();
  const { t: tStr, locale } = useLocale();
  const { user, profile, organization } = useAuth() || {};
  const orgId = organization?.id || profile?.organization_id || null;

  const formatDate = (iso) => {
    if (!iso) return '';
    try {
      const loc = locale === 'en' ? 'en-US' : 'es-AR';
      return new Date(iso).toLocaleDateString(loc, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return '';
    }
  };
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
      if (!orgId) {
        setItems([]);
        return;
      }
      const { data, error } = await supabase
        .from('gym_news')
        .select('id, title, body, tag, pinned, is_active, created_at')
        .eq('organization_id', orgId)
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
  }, [orgId]);

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
      Alert.alert(tStr('admin_news_title_required_title'), tStr('admin_news_title_required_body'));
      return;
    }
    if (!orgId) {
      Alert.alert(tStr('gym_config_alert_title_error'), tStr('admin_news_need_org'));
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
        const { error } = await supabase
          .from('gym_news')
          .insert({ ...payload, organization_id: orgId, created_by: user?.id || null });
        if (error) throw error;
      }
      cancelForm();
      await loadNews();
    } catch (e) {
      Alert.alert(tStr('gym_config_alert_title_error'), e?.message || tStr('admin_news_save_fail'));
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
      Alert.alert(tStr('gym_config_alert_title_error'), e?.message || tStr('admin_news_update_fail'));
    }
  };

  const deleteItem = (row) => {
    const titlePreview = (row.title || '').slice(0, 40);
    Alert.alert(
      tStr('admin_news_delete_title'),
      tStr('admin_news_delete_message').replace('{{title}}', titlePreview),
      [
        { text: tStr('admin_news_delete_cancel'), style: 'cancel' },
        {
          text: tStr('admin_news_delete_confirm'),
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.from('gym_news').update({ is_active: false }).eq('id', row.id);
              if (error) throw error;
              await loadNews();
              if (editingId === row.id) cancelForm();
            } catch (e) {
              Alert.alert(tStr('gym_config_alert_title_error'), e?.message || tStr('admin_news_delete_fail'));
            }
          },
        },
      ]
    );
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: {
          flex: 1,
          padding: MOBILE_SPACING.xl,
          paddingTop: 56,
          width: '100%',
          maxWidth: WEB_CONTENT_MAX_WIDTH,
          alignSelf: 'center',
        },
        header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
        backBtn: { padding: 8, marginLeft: -8 },
        title: { color: t.text, fontSize: MOBILE_TYPE.title, fontWeight: '800' },
        btn: { ...t.buttonPrimary, borderRadius: MOBILE_RADII.md, paddingVertical: 10, paddingHorizontal: MOBILE_SPACING.lg },
        btnText: { ...t.buttonPrimaryText, fontSize: MOBILE_TYPE.body },
        list: { paddingBottom: 40 },
        card: {
          backgroundColor: t.boxBg,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          borderRadius: MOBILE_RADII.lg,
          padding: 14,
          marginBottom: 12,
        },
        cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
        cardTitle: { color: t.text, fontSize: MOBILE_TYPE.bodyStrong, fontWeight: '600', flex: 1 },
        cardMeta: { color: t.subText, fontSize: MOBILE_TYPE.caption, marginTop: 4 },
        badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: MOBILE_RADII.xs, marginLeft: 6 },
        badgePinned: { backgroundColor: hexToRgba(t.brand, 0.25) },
        badgeInactive: { backgroundColor: 'rgba(128,128,128,0.3)' },
        formWrap: {
          backgroundColor: t.boxBg,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          borderRadius: MOBILE_RADII.lg,
          padding: MOBILE_SPACING.lg,
          marginBottom: 16,
        },
        label: { color: t.subText, fontSize: MOBILE_TYPE.body, marginBottom: 6, fontWeight: '600' },
        input: {
          borderWidth: 1,
          borderColor: t.overlayBorder,
          borderRadius: MOBILE_RADII.md,
          padding: 12,
          color: t.text,
          backgroundColor: t.inputBg,
          marginBottom: 12,
          fontSize: MOBILE_TYPE.bodyStrong,
        },
        textArea: { minHeight: 80, textAlignVertical: 'top' },
        row: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
        switchLabel: { color: t.text, fontSize: MOBILE_TYPE.body, marginLeft: 10, flex: 1 },
        actions: { flexDirection: 'row', gap: 10, marginTop: 8 },
        empty: { paddingVertical: 40, alignItems: 'center' },
        emptyText: { color: t.placeholder, fontSize: MOBILE_TYPE.bodyStrong },
      }),
    [t]
  );

  const formVisible = showNewForm || editingId;

  return (
    <ScreenShell
      screen="admin"
      scroll
      keyboardAvoid="form"
      keyboardAvoidProps={{ testID: 'screen-admin-novedades', style: { flex: 1 } }}
      scrollProps={{ style: styles.screen, contentContainerStyle: styles.list }}
    >
          <View style={styles.header}>
            {!hideInlineBack ? (
              <BackNavButton
                testID="admin-novedades-nav-back"
                onPress={() => navigation.goBack()}
                label={tStr('common_back')}
                style={styles.backBtn}
              />
            ) : null}
            <Text style={styles.title}>{tStr('admin_news_screen_title')}</Text>
            <TouchableOpacity style={styles.btn} onPress={openNew} activeOpacity={0.9}>
              <Text style={styles.btnText}>{tStr('admin_news_new')}</Text>
            </TouchableOpacity>
          </View>

          {formVisible && (
            <View style={styles.formWrap}>
              <Text style={styles.label}>{tStr('admin_news_label_title')}</Text>
              <TextInput
                style={styles.input}
                value={formTitle}
                onChangeText={setFormTitle}
                placeholder={tStr('admin_news_form_title_ph')}
                placeholderTextColor={t.placeholder}
              />
              <Text style={styles.label}>{tStr('admin_news_label_body')}</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formBody}
                onChangeText={setFormBody}
                placeholder={tStr('admin_news_form_body_ph')}
                placeholderTextColor={t.placeholder}
                multiline
              />
              <Text style={styles.label}>{tStr('admin_news_label_tag')}</Text>
              <TextInput
                style={styles.input}
                value={formTag}
                onChangeText={setFormTag}
                placeholder={tStr('admin_news_form_tag_ph')}
                placeholderTextColor={t.placeholder}
              />
              <View style={styles.row}>
                <Switch value={formPinned} onValueChange={setFormPinned} trackColor={{ false: t.border, true: t.brand }} thumbColor="#fff" />
                <Text style={styles.switchLabel}>{tStr('admin_news_switch_pinned')}</Text>
              </View>
              <View style={styles.row}>
                <Switch value={formActive} onValueChange={setFormActive} trackColor={{ false: t.border, true: t.brand }} thumbColor="#fff" />
                <Text style={styles.switchLabel}>{tStr('admin_news_switch_visible')}</Text>
              </View>
              <View style={styles.actions}>
                <TouchableOpacity style={styles.btn} onPress={saveItem} disabled={saving} activeOpacity={0.9}>
                  <Text style={styles.btnText}>{saving ? tStr('admin_news_saving') : tStr('admin_news_save')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, { backgroundColor: t.inputBg, borderColor: t.overlayBorder }]}
                  onPress={cancelForm}
                  activeOpacity={0.9}
                >
                  <Text style={[styles.btnText, { color: t.text }]}>{tStr('admin_news_cancel')}</Text>
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
              <Text style={styles.emptyText}>{tStr('admin_news_empty')}</Text>
            </View>
          ) : (
            items.map((row) => (
              <View key={row.id} style={styles.card}>
                <View style={styles.cardRow}>
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {row.title || tStr('admin_news_no_title')}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {row.pinned && (
                      <View style={[styles.badge, styles.badgePinned]}>
                        <Text style={{ color: t.brand, fontSize: MOBILE_TYPE.caption, fontWeight: '700' }}>{tStr('admin_news_pinned')}</Text>
                      </View>
                    )}
                    {!row.is_active && (
                      <View style={[styles.badge, styles.badgeInactive]}>
                        <Text style={{ color: t.subText, fontSize: MOBILE_TYPE.caption }}>{tStr('admin_news_hidden')}</Text>
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
                    <Text style={styles.btnText}>{tStr('admin_news_edit')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.btn, { backgroundColor: t.inputBg, borderColor: t.overlayBorder }]}
                    onPress={() => toggleActive(row)}
                    activeOpacity={0.9}
                  >
                    <Text style={[styles.btnText, { color: t.text }]}>
                      {row.is_active ? tStr('admin_news_hide') : tStr('admin_news_show')}
                    </Text>
                  </TouchableOpacity>
                  {row.is_active && (
                    <TouchableOpacity
                      style={[styles.btn, { ...t.buttonDanger }]}
                      onPress={() => deleteItem(row)}
                      activeOpacity={0.9}
                    >
                      <Text style={t.buttonDangerText}>{tStr('admin_news_delete_btn')}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))
          )}
    </ScreenShell>
  );
}
