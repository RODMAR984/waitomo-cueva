// 5.9 — Badges por asistencias: definiciones seed + recalcular premios por org.

import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BackgroundWrapper from '../components/BackgroundWrapper';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { useThemeContext } from '../contexts/ThemeContext';
import { useLocale } from '../contexts/LocaleContext';
import useStaffWebHideInlineBack from '../hooks/useStaffWebHideInlineBack';
import { WEB_CONTENT_MAX_WIDTH, WEB_PANEL_RADIUS } from '../theme/webSpec';
import { MOBILE_RADII, MOBILE_SPACING, MOBILE_TYPE } from '../theme/mobileSpec';

export default function AdminBadgesScreen() {
  const navigation = useNavigation();
  const hideInlineBack = useStaffWebHideInlineBack();
  const insets = useSafeAreaInsets();
  const { t } = useThemeContext();
  const { t: tStr, locale } = useLocale();
  const { organization, profile } = useAuth() || {};
  const orgId = organization?.id ?? profile?.organization_id ?? null;

  const [defs, setDefs] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('badge_definitions').select('id, title_es, title_en, rule_threshold').order('rule_threshold');
    if (!error) setDefs(Array.isArray(data) ? data : []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const refreshBadges = async () => {
    if (!orgId) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('staff_refresh_badges_for_org', { p_org_id: orgId });
      if (error) throw error;
      const payload = Array.isArray(data) ? data[0] : data;
      if (!payload?.ok) throw new Error(payload?.reason || 'error');
      Alert.alert(tStr('admin_badges_done_title'), tStr('admin_badges_done_body').replace('{{n}}', String(payload.badges_new_rows ?? 0)));
    } catch (e) {
      Alert.alert(tStr('gym_config_alert_title_error'), e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingTop: Platform.OS === 'web' ? MOBILE_SPACING.lg : 8 + insets.top,
          paddingHorizontal: MOBILE_SPACING.lg,
          paddingBottom: 8,
          width: '100%',
          maxWidth: WEB_CONTENT_MAX_WIDTH,
          alignSelf: 'center',
        },
        backBtn: { padding: 8, marginRight: 4 },
        title: { flex: 1, color: t.text, fontSize: 18, fontWeight: '900' },
        body: { paddingHorizontal: MOBILE_SPACING.lg, paddingBottom: 32, width: '100%', maxWidth: WEB_CONTENT_MAX_WIDTH, alignSelf: 'center' },
        hint: { color: t.subText, fontSize: MOBILE_TYPE.caption, marginBottom: 12, lineHeight: 18 },
        card: {
          padding: 12,
          borderRadius: WEB_PANEL_RADIUS,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          marginBottom: 8,
          backgroundColor: t.boxBg,
        },
        name: { color: t.text, fontWeight: '800' },
        meta: { color: t.subText, fontSize: MOBILE_TYPE.caption, marginTop: 4 },
        btn: { marginTop: MOBILE_SPACING.lg, alignSelf: 'flex-start', paddingVertical: 12, paddingHorizontal: MOBILE_SPACING.lg, borderRadius: MOBILE_RADII.md, ...t.buttonPrimary },
        btnBusy: { opacity: 0.7 },
        btnText: { ...t.buttonPrimaryText, fontWeight: '800' },
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
        <Text style={styles.title}>{tStr('admin_badges_title')}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.hint}>{tStr('admin_badges_hint')}</Text>
        {defs.map((d) => (
          <View key={d.id} style={styles.card}>
            <Text style={styles.name}>{locale === 'en' ? d.title_en : d.title_es}</Text>
            <Text style={styles.meta}>
              {d.id} · ≥ {d.rule_threshold} {tStr('admin_badges_classes')}
            </Text>
          </View>
        ))}
        <TouchableOpacity style={[styles.btn, busy && styles.btnBusy]} onPress={refreshBadges} disabled={busy || !orgId}>
          <Text style={styles.btnText}>{tStr('admin_badges_recalc')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </BackgroundWrapper>
  );
}
