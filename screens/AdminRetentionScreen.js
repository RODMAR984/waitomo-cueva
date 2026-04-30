// 5.2 — Retención: socios “dormidos” + nudge in-app (límite 7 días por socio).

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
  Alert,
  Platform,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BackgroundWrapper from '../components/BackgroundWrapper';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { useThemeContext } from '../contexts/ThemeContext';
import { useLocale } from '../contexts/LocaleContext';
import useStaffWebHideInlineBack from '../hooks/useStaffWebHideInlineBack';

const hexToRgba = (hex, alpha = 1) => {
  const clean = String(hex || '').replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const r = parseInt(full.substring(0, 2), 16) || 0;
  const g = parseInt(full.substring(2, 4), 16) || 0;
  const b = parseInt(full.substring(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
};

export default function AdminRetentionScreen() {
  const navigation = useNavigation();
  const hideInlineBack = useStaffWebHideInlineBack();
  const insets = useSafeAreaInsets();
  const { t } = useThemeContext();
  const { t: tStr } = useLocale();
  const { organization, profile } = useAuth() || {};
  const orgId = organization?.id ?? profile?.organization_id ?? null;

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [days, setDays] = useState('14');
  const [modalUser, setModalUser] = useState(null);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!orgId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const d = Math.max(1, Math.min(365, parseInt(String(days || '14').trim(), 10) || 14));
      const { data, error } = await supabase.rpc('staff_list_dormant_clients', {
        p_org_id: orgId,
        p_days: d,
      });
      if (error) throw error;
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setRows([]);
      Alert.alert(tStr('gym_config_alert_title_error'), e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [orgId, days, tStr]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const openNudge = (row) => {
    setModalUser(row);
    setBody(tStr('admin_retention_default_body'));
  };

  const sendNudge = async () => {
    if (!orgId || !modalUser?.user_id) return;
    setSending(true);
    try {
      const { data, error } = await supabase.rpc('staff_send_in_app_nudge', {
        p_org_id: orgId,
        p_target_user_id: modalUser.user_id,
        p_body: body,
      });
      if (error) throw error;
      const payload = Array.isArray(data) ? data[0] : data;
      if (!payload?.ok) {
        Alert.alert(tStr('admin_retention_send_fail'), String(payload?.reason || ''));
        return;
      }
      setModalUser(null);
      Alert.alert(tStr('admin_retention_send_ok_title'), tStr('admin_retention_send_ok_body'));
    } catch (e) {
      Alert.alert(tStr('gym_config_alert_title_error'), e?.message || String(e));
    } finally {
      setSending(false);
    }
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingTop: Platform.OS === 'web' ? 16 : 8 + insets.top,
          paddingHorizontal: 16,
          paddingBottom: 8,
        },
        backBtn: { padding: 8, marginRight: 4 },
        title: { flex: 1, color: t.text, fontSize: 18, fontWeight: '900' },
        body: { paddingHorizontal: 16, paddingBottom: 24 },
        hint: { color: t.subText, fontSize: 12, marginBottom: 10, lineHeight: 18 },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 10,
          gap: 8,
        },
        input: {
          flex: 1,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          borderRadius: 10,
          paddingHorizontal: 10,
          paddingVertical: 8,
          color: t.text,
          backgroundColor: t.inputBg,
          maxWidth: 120,
        },
        card: {
          borderRadius: 14,
          padding: 14,
          marginBottom: 10,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          backgroundColor: t.boxBg,
        },
        name: { color: t.text, fontSize: 15, fontWeight: '800' },
        meta: { color: t.subText, fontSize: 12, marginTop: 4 },
        btn: { marginTop: 10, alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, ...t.buttonPrimary },
        btnText: { ...t.buttonPrimaryText, fontWeight: '800' },
        modalCard: {
          margin: 20,
          padding: 16,
          borderRadius: 16,
          backgroundColor: t.boxBg,
          borderWidth: 1,
          borderColor: t.overlayBorder,
        },
        modalInput: {
          borderWidth: 1,
          borderColor: t.overlayBorder,
          borderRadius: 12,
          padding: 10,
          color: t.text,
          minHeight: 100,
          textAlignVertical: 'top',
          marginTop: 8,
          backgroundColor: t.inputBg,
        },
        daysLabel: { color: t.text, fontWeight: '700' },
        spinner: { marginTop: 20 },
        modalBackdrop: {
          flex: 1,
          backgroundColor: hexToRgba(t.text, 0.45),
          justifyContent: 'center',
        },
        modalTitle: { color: t.text, fontWeight: '900', fontSize: 16 },
        modalActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
        sendBtnBusy: { opacity: 0.6 },
        cancelBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: t.overlayBg, justifyContent: 'center' },
        cancelBtnText: { ...t.buttonPrimaryText, color: t.text, fontWeight: '800' },
      }),
    [insets.top, t],
  );

  return (
    <BackgroundWrapper screen="Admin">
      <View style={styles.header}>
        {!hideInlineBack ? (
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
            <Ionicons name="arrow-back" size={24} color={t.text} />
          </TouchableOpacity>
        ) : null}
        <Text style={styles.title}>{tStr('admin_retention_title')}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.hint}>{tStr('admin_retention_hint')}</Text>
        <View style={styles.row}>
          <Text style={styles.daysLabel}>{tStr('admin_retention_days_label')}</Text>
          <TextInput style={styles.input} value={days} onChangeText={setDays} keyboardType="number-pad" />
          <TouchableOpacity style={styles.btn} onPress={load}>
            <Text style={styles.btnText}>{tStr('admin_retention_reload')}</Text>
          </TouchableOpacity>
        </View>
        {loading ? (
          <ActivityIndicator color={t.brand} style={styles.spinner} />
        ) : rows.length === 0 ? (
          <Text style={styles.hint}>{tStr('admin_retention_empty')}</Text>
        ) : (
          rows.map((r) => (
            <View key={r.user_id} style={styles.card}>
              <Text style={styles.name}>{r.display_name || r.user_id}</Text>
              <Text style={styles.meta}>
                {tStr('admin_retention_last')}: {r.last_session || '—'}
              </Text>
              <TouchableOpacity style={styles.btn} onPress={() => openNudge(r)}>
                <Text style={styles.btnText}>{tStr('admin_retention_nudge_cta')}</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={!!modalUser} transparent animationType="fade" onRequestClose={() => setModalUser(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{tStr('admin_retention_modal_title')}</Text>
            <Text style={styles.meta}>{modalUser?.display_name}</Text>
            <TextInput
              style={styles.modalInput}
              multiline
              value={body}
              onChangeText={setBody}
              placeholderTextColor={t.placeholder}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.btn, sending && styles.sendBtnBusy]} onPress={sendNudge} disabled={sending}>
                <Text style={styles.btnText}>{tStr('admin_retention_send')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalUser(null)}>
                <Text style={styles.cancelBtnText}>{tStr('common_cancel')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </BackgroundWrapper>
  );
}
