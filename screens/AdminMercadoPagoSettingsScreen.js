// Mercado Pago por organización: OAuth vendedor + interruptor de checkout (misma idea que Stripe).

import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
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
import { getMercadoPagoConnectRedirectUri } from '../utils/fitengineUrls';
import { useAuth } from '../contexts/AuthContext';
import { useThemeContext } from '../contexts/ThemeContext';
import { useLocale } from '../contexts/LocaleContext';
import useStaffWebHideInlineBack from '../hooks/useStaffWebHideInlineBack';

export default function AdminMercadoPagoSettingsScreen() {
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

  const mpLinked = !!organization?.mercadopago_oauth_linked;
  const checkoutLive = mpLinked && !!organization?.mercadopago_checkout_enabled;

  const [checkoutOn, setCheckoutOn] = useState(false);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    setCheckoutOn(!!organization?.mercadopago_checkout_enabled);
  }, [organization?.mercadopago_checkout_enabled, organization?.mercadopago_oauth_linked]);

  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
  }, []);

  const dirty = checkoutOn !== !!organization?.mercadopago_checkout_enabled;

  const getAuthHeader = useCallback(async () => {
    let accessToken = '';
    const { data: s0 } = await supabase.auth.getSession();
    accessToken = String(s0?.session?.access_token || '').trim();

    if (!accessToken) {
      const { data: s1 } = await supabase.auth.refreshSession();
      accessToken = String(s1?.session?.access_token || '').trim();
    }

    if (!accessToken) {
      throw new Error('auth_session_missing');
    }
    return { Authorization: `Bearer ${accessToken}` };
  }, []);

  const save = useCallback(async () => {
    if (!orgId || !canEdit) {
      Alert.alert(tStr('gym_config_no_permission_title'), tStr('gym_config_no_permission_body'));
      return;
    }
    if (!mpLinked) {
      Alert.alert(tStr('gym_config_alert_title_error'), tStr('admin_mp_need_connect_first'));
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('organizations')
        .update({ mercadopago_checkout_enabled: !!checkoutOn })
        .eq('id', orgId);
      if (error) throw error;
      if (typeof refreshOrganization === 'function') await refreshOrganization(orgId);
      Alert.alert(tStr('gym_config_saved_title'), tStr('gym_config_saved_body'));
    } catch (e) {
      Alert.alert(tStr('gym_config_alert_title_error'), e?.message || String(e));
    } finally {
      setSaving(false);
    }
  }, [canEdit, checkoutOn, mpLinked, orgId, refreshOrganization, tStr]);

  const connectMp = useCallback(async () => {
    if (!orgId || !canEdit) {
      Alert.alert(tStr('gym_config_no_permission_title'), tStr('gym_config_no_permission_body'));
      return;
    }
    setConnecting(true);
    try {
      const authHeader = await getAuthHeader();

      const nativeReturn = Platform.OS !== 'web' ? getMercadoPagoConnectRedirectUri() : '';
      const body = { organization_id: orgId };
      if (nativeReturn) body.native_return_url = nativeReturn;

      const { data, error } = await supabase.functions.invoke('mercadopago-oauth-start', {
        body,
        headers: authHeader,
      });
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
        Alert.alert(tStr('admin_mp_connect_title'), tStr('admin_mp_connect_cancelled'));
        return;
      }
      if (result.type !== 'success' || !result.url) {
        throw new Error(tStr('admin_mp_connect_unknown_result'));
      }
      const parsed = Linking.parse(result.url);
      const status = String(parsed.queryParams?.status || '').trim();
      const reason = String(parsed.queryParams?.reason || '').trim();
      if (status === 'ok') {
        if (typeof refreshOrganization === 'function') await refreshOrganization(orgId);
        Alert.alert(tStr('admin_mp_connect_title'), tStr('admin_mp_connect_success'));
      } else {
        Alert.alert(tStr('admin_mp_connect_title'), reason || tStr('gym_config_alert_title_error'));
      }
    } catch (e) {
      if (String(e?.message || '').includes('auth_session_missing')) {
        Alert.alert(tStr('security_error_title'), tStr('security_sign_in_required_body'));
        return;
      }
      Alert.alert(tStr('gym_config_alert_title_error'), e?.message || String(e));
    } finally {
      setConnecting(false);
    }
  }, [canEdit, getAuthHeader, orgId, refreshOrganization, tStr]);

  const disconnectMp = useCallback(() => {
    if (!orgId || !canEdit) {
      Alert.alert(tStr('gym_config_no_permission_title'), tStr('gym_config_no_permission_body'));
      return;
    }
    Alert.alert(tStr('admin_mp_disconnect_confirm_title'), tStr('admin_mp_disconnect_confirm_body'), [
      { text: tStr('common_cancel') || 'Cancelar', style: 'cancel' },
      {
        text: tStr('admin_mp_disconnect'),
        style: 'destructive',
        onPress: async () => {
          setDisconnecting(true);
          try {
            const authHeader = await getAuthHeader();
            const { error } = await supabase.functions.invoke('mercadopago-disconnect', {
              body: { organization_id: orgId },
              headers: authHeader,
            });
            if (error) throw error;
            if (typeof refreshOrganization === 'function') await refreshOrganization(orgId);
            Alert.alert(tStr('admin_mp_disconnect_ok'));
          } catch (e) {
            if (String(e?.message || '').includes('auth_session_missing')) {
              Alert.alert(tStr('security_error_title'), tStr('security_sign_in_required_body'));
            } else {
              Alert.alert(tStr('gym_config_alert_title_error'), e?.message || String(e));
            }
          } finally {
            setDisconnecting(false);
          }
        },
      },
    ]);
  }, [canEdit, getAuthHeader, orgId, refreshOrganization, tStr]);

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
        row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
        rowLabel: { color: t.text, fontWeight: '700', flex: 1, paddingRight: 12 },
        fieldCaption: { color: t.subText, fontSize: 11, marginTop: 4, lineHeight: 16 },
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
        noEditHint: { marginTop: 16 },
        connectedBanner: {
          flexDirection: 'row',
          alignItems: 'flex-start',
          backgroundColor: t.boxBg,
          borderRadius: 12,
          padding: 14,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          marginBottom: 14,
        },
        pausedBanner: {
          flexDirection: 'row',
          alignItems: 'flex-start',
          backgroundColor: t.boxBg,
          borderRadius: 12,
          padding: 14,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          marginBottom: 14,
        },
        connectedTitle: { color: t.text, fontWeight: '900', fontSize: 16 },
        connectedBody: { color: t.subText, fontSize: 13, marginTop: 6, lineHeight: 19 },
        link: { color: t.brand, textDecorationLine: 'underline', marginTop: 10 },
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
        <Text style={styles.title}>{tStr('admin_mp_title')}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        {checkoutLive ? (
          <View style={styles.connectedBanner} accessibilityRole="summary">
            <Ionicons name="checkmark-circle" size={28} color={t.brand} style={{ marginRight: 10, marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.connectedTitle}>{tStr('admin_mp_banner_connected_title')}</Text>
              <Text style={styles.connectedBody}>{tStr('admin_mp_banner_connected_body')}</Text>
            </View>
          </View>
        ) : null}
        {mpLinked && !checkoutLive ? (
          <View style={styles.pausedBanner} accessibilityRole="summary">
            <Ionicons name="pause-circle" size={28} color={t.subText} style={{ marginRight: 10, marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.connectedTitle}>{tStr('admin_mp_banner_paused_title')}</Text>
              <Text style={styles.connectedBody}>{tStr('admin_mp_banner_paused_body')}</Text>
            </View>
          </View>
        ) : null}

        <Text style={styles.hint}>{tStr('admin_mp_hint')}</Text>

        <View style={styles.row}>
          <Text style={styles.rowLabel}>{tStr('admin_mp_checkout_toggle')}</Text>
          <Switch
            value={!!checkoutOn}
            onValueChange={setCheckoutOn}
            disabled={!canEdit || !mpLinked || saving}
            trackColor={{ false: t.overlayBorder, true: t.brand }}
          />
        </View>
        <Text style={styles.fieldCaption}>
          {!mpLinked ? tStr('admin_mp_checkout_toggle_caption_off') : tStr('admin_mp_checkout_toggle_caption_on')}
        </Text>

        <Text style={styles.hint}>{tStr('admin_mp_webhook_note')}</Text>

        <TouchableOpacity onPress={() => Linking.openURL('https://www.mercadopago.com.ar/developers')}>
          <Text style={styles.link}>Mercado Pago Developers</Text>
        </TouchableOpacity>

        {canEdit ? (
          <TouchableOpacity
            style={[styles.btnSecondary, connecting && styles.btnBusy]}
            onPress={connectMp}
            disabled={connecting || disconnecting || saving}
          >
            <Text style={styles.btnSecondaryText}>
              {connecting ? tStr('common_loading') : tStr('admin_mp_connect_auto')}
            </Text>
          </TouchableOpacity>
        ) : null}

        {canEdit ? (
          <TouchableOpacity
            style={[styles.btn, (saving || !dirty) && styles.btnBusy]}
            onPress={save}
            disabled={saving || !dirty || !mpLinked}
          >
            <Text style={styles.btnText}>{saving ? tStr('common_loading') : tStr('gym_config_saved_title')}</Text>
          </TouchableOpacity>
        ) : null}

        {canEdit && mpLinked ? (
          <TouchableOpacity
            style={[styles.btnSecondary, (disconnecting || connecting || saving) && styles.btnBusy]}
            onPress={disconnectMp}
            disabled={disconnecting || connecting || saving}
          >
            <Text style={styles.btnSecondaryText}>
              {disconnecting ? tStr('common_loading') : tStr('admin_mp_disconnect')}
            </Text>
          </TouchableOpacity>
        ) : null}

        {!canEdit ? (
          <Text style={[styles.hint, styles.noEditHint]}>{tStr('gym_config_no_permission_body')}</Text>
        ) : null}
      </ScrollView>
    </BackgroundWrapper>
  );
}
