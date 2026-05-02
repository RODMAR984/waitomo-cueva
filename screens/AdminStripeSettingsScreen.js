// 5.5 — Stripe (capa 1): datos de cuenta en org; checkout y webhooks se completan con Edge + claves en env.

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
  Platform,
  Linking,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BackgroundWrapper from '../components/BackgroundWrapper';
import { supabase } from '../supabaseClient';
import { getStripeConnectRedirectUri } from '../utils/fitengineUrls';
import { useAuth } from '../contexts/AuthContext';
import { useThemeContext } from '../contexts/ThemeContext';
import { useLocale } from '../contexts/LocaleContext';
import useStaffWebHideInlineBack from '../hooks/useStaffWebHideInlineBack';

export default function AdminStripeSettingsScreen() {
  const navigation = useNavigation();
  const hideInlineBack = useStaffWebHideInlineBack();
  const insets = useSafeAreaInsets();
  const { t } = useThemeContext();
  const { t: tStr } = useLocale();
  const { user, profile, organization, refreshOrganization } = useAuth() || {};
  const orgId = organization?.id ?? profile?.organization_id ?? null;

  const isOwner =
    !!(organization?.owner_id && (organization.owner_id === user?.id || organization.owner_id === profile?.id));
  const canEdit = isOwner || profile?.role === 'superadmin';

  const [acct, setAcct] = useState('');
  const [checkoutOn, setCheckoutOn] = useState(false);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    setAcct(String(organization?.stripe_connect_account_id || '').trim());
    setCheckoutOn(!!organization?.stripe_checkout_enabled);
  }, [organization?.stripe_connect_account_id, organization?.stripe_checkout_enabled]);

  const save = useCallback(async () => {
    if (!orgId || !canEdit) {
      Alert.alert(tStr('gym_config_no_permission_title'), tStr('gym_config_no_permission_body'));
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('organizations')
        .update({
          stripe_connect_account_id: acct.trim() || null,
          stripe_checkout_enabled: !!checkoutOn,
        })
        .eq('id', orgId);
      if (error) throw error;
      if (typeof refreshOrganization === 'function') await refreshOrganization(orgId);
      Alert.alert(tStr('gym_config_saved_title'), tStr('gym_config_saved_body'));
    } catch (e) {
      Alert.alert(tStr('gym_config_alert_title_error'), e?.message || String(e));
    } finally {
      setSaving(false);
    }
  }, [acct, canEdit, checkoutOn, orgId, refreshOrganization, tStr]);

  const connectStripeAuto = useCallback(async () => {
    if (!orgId || !canEdit) {
      Alert.alert(tStr('gym_config_no_permission_title'), tStr('gym_config_no_permission_body'));
      return;
    }
    setConnecting(true);
    try {
      const nativeReturn = Platform.OS !== 'web' ? getStripeConnectRedirectUri() : '';
      const body = { organization_id: orgId };
      if (nativeReturn) body.native_return_url = nativeReturn;

      const { data, error } = await supabase.functions.invoke('stripe-connect-start', { body });
      if (error) throw error;
      const oauthUrl = String(data?.oauth_url || '');
      if (!oauthUrl) throw new Error('missing_oauth_url');

      if (Platform.OS === 'web') {
        await Linking.openURL(oauthUrl);
        return;
      }

      WebBrowser.maybeCompleteAuthSession();
      const result = await WebBrowser.openAuthSessionAsync(oauthUrl, nativeReturn, { showInRecents: true });
      if (result.type === 'cancel' || result.type === 'dismiss') {
        Alert.alert(tStr('admin_stripe_connect_title'), tStr('admin_stripe_connect_cancelled'));
        return;
      }
      if (result.type !== 'success' || !result.url) {
        throw new Error(tStr('admin_stripe_connect_unknown_result'));
      }
      const parsed = Linking.parse(result.url);
      const status = String(parsed.queryParams?.status || '').trim();
      const reason = String(parsed.queryParams?.reason || '').trim();
      if (status === 'ok') {
        if (typeof refreshOrganization === 'function') await refreshOrganization(orgId);
        Alert.alert(tStr('admin_stripe_connect_title'), tStr('admin_stripe_connect_success'));
      } else {
        Alert.alert(tStr('admin_stripe_connect_title'), reason || tStr('gym_config_alert_title_error'));
      }
    } catch (e) {
      Alert.alert(tStr('gym_config_alert_title_error'), e?.message || String(e));
    } finally {
      setConnecting(false);
    }
  }, [canEdit, orgId, refreshOrganization, tStr]);

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
        body: { paddingHorizontal: 16, paddingBottom: 32 },
        hint: { color: t.subText, fontSize: 12, marginBottom: 12, lineHeight: 18 },
        label: { color: t.text, fontWeight: '700', marginTop: 12 },
        input: {
          borderWidth: 1,
          borderColor: t.overlayBorder,
          borderRadius: 10,
          padding: 10,
          color: t.text,
          backgroundColor: t.inputBg,
          marginTop: 6,
        },
        row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
        rowLabel: { color: t.text, fontWeight: '700', flex: 1 },
        btn: { marginTop: 20, alignSelf: 'flex-start', paddingVertical: 12, paddingHorizontal: 18, borderRadius: 10, ...t.buttonPrimary },
        btnSecondary: {
          marginTop: 10,
          alignSelf: 'flex-start',
          paddingVertical: 12,
          paddingHorizontal: 18,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          backgroundColor: t.faintStrong,
        },
        btnBusy: { opacity: 0.7 },
        btnText: { ...t.buttonPrimaryText, fontWeight: '800' },
        btnSecondaryText: { color: t.text, fontWeight: '800' },
        link: { color: t.brand, textDecorationLine: 'underline', marginTop: 10 },
        noEditHint: { marginTop: 16 },
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
        <Text style={styles.title}>{tStr('admin_stripe_title')}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.hint}>{tStr('admin_stripe_hint')}</Text>
        <Text style={styles.label}>{tStr('admin_stripe_account_id')}</Text>
        <TextInput
          style={styles.input}
          value={acct}
          onChangeText={setAcct}
          placeholder="acct_…"
          placeholderTextColor={t.placeholder}
          editable={canEdit}
          autoCapitalize="none"
        />
        <View style={styles.row}>
          <Text style={styles.rowLabel}>{tStr('admin_stripe_checkout_toggle')}</Text>
          <Switch value={checkoutOn} onValueChange={setCheckoutOn} disabled={!canEdit} trackColor={{ false: t.overlayBorder, true: t.brand }} />
        </View>
        <Text style={styles.hint}>{tStr('admin_stripe_webhook_note')}</Text>
        <TouchableOpacity onPress={() => Linking.openURL('https://dashboard.stripe.com/connect/accounts/overview')}>
          <Text style={styles.link}>Stripe Dashboard → Connect</Text>
        </TouchableOpacity>
        {canEdit ? (
          <TouchableOpacity
            style={[styles.btnSecondary, connecting && styles.btnBusy]}
            onPress={connectStripeAuto}
            disabled={connecting}
          >
            <Text style={styles.btnSecondaryText}>
              {connecting ? tStr('common_loading') : tStr('admin_stripe_connect_auto')}
            </Text>
          </TouchableOpacity>
        ) : null}
        {canEdit ? (
          <TouchableOpacity style={[styles.btn, saving && styles.btnBusy]} onPress={save} disabled={saving}>
            <Text style={styles.btnText}>{tStr('gym_config_saved_title')}</Text>
          </TouchableOpacity>
        ) : (
          <Text style={[styles.hint, styles.noEditHint]}>{tStr('gym_config_no_permission_body')}</Text>
        )}
      </ScrollView>
    </BackgroundWrapper>
  );
}
