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
import * as ExpoLinking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ScreenShell from '../../components/ScreenShell';
import BackNavButton from '../../components/BackNavButton';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../../supabaseClient';
import { getMercadoPagoConnectRedirectUri } from '../../utils/fitengineUrls';
import {
  consumePendingPaymentConnectResult,
  getMercadoPagoWebReturnUri,
  parsePaymentConnectReturnFromWindow,
  stripPaymentConnectQueryFromHistory,
} from '../../utils/paymentConnectWebReturn';
import {
  clearWebPaymentConnectInflight,
  startWebPaymentConnectOAuthSameTab,
} from '../../utils/runWebPaymentConnectOAuth';
import { confirmAction } from '../../utils/confirmAction';
import { useAuth } from '../../contexts/AuthContext';
import { useThemeContext } from '../../contexts/ThemeContext';
import { useLocale } from '../../contexts/LocaleContext';
import useStaffWebHideInlineBack from '../../hooks/useStaffWebHideInlineBack';
import { WEB_CONTENT_MAX_WIDTH } from '../../theme/webSpec';
import { MOBILE_RADII, MOBILE_SPACING, MOBILE_TYPE, screenHeaderTopPadding } from '../../theme/mobileSpec';

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
  const mpSellerId = String(organization?.mercadopago_mp_user_id || '').trim();
  const mpAccountLine = useMemo(() => {
    if (!mpLinked) return null;
    if (mpSellerId) return tStr('admin_mp_linked_account').replace('{{id}}', mpSellerId);
    return tStr('admin_mp_linked_account_unknown');
  }, [mpLinked, mpSellerId, tStr]);

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

  const showMpAlert = useCallback(
    (title, message) => {
      const body = [title, message].filter(Boolean).join('\n\n');
      if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.alert === 'function') {
        window.alert(body);
        return;
      }
      Alert.alert(title, message);
    },
    [],
  );

  const showMpConnectResult = useCallback(
    async (status, reason) => {
      if (status === 'ok') {
        if (typeof refreshOrganization === 'function' && orgId) await refreshOrganization(orgId);
        showMpAlert(tStr('admin_mp_connect_title'), tStr('admin_mp_connect_success'));
        return;
      }
      showMpAlert(tStr('admin_mp_connect_title'), reason || tStr('gym_config_alert_title_error'));
    },
    [orgId, refreshOrganization, showMpAlert, tStr],
  );

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const fromUrl = parsePaymentConnectReturnFromWindow();
    const pending = consumePendingPaymentConnectResult('mercadopago');
    const result = fromUrl?.kind === 'mercadopago' ? fromUrl : pending;
    if (!result || result.kind !== 'mercadopago') return;
    clearWebPaymentConnectInflight('mercadopago');
    stripPaymentConnectQueryFromHistory();
    void showMpConnectResult(result.status, result.reason);
  }, [showMpConnectResult]);

  const dirty = checkoutOn !== !!organization?.mercadopago_checkout_enabled;

  const getAuthHeader = useCallback(async () => {
    let accessToken = '';
    const { data: s0 } = await supabase.auth.getSession();
    accessToken = String(s0?.session?.access_token || '').trim();

    if (!accessToken && typeof supabase?.auth?.refreshSession === 'function') {
      const { data: s1 } = await supabase.auth.refreshSession();
      accessToken = String(s1?.session?.access_token || '').trim();
    }

    if (!accessToken) {
      throw new Error('auth_session_missing');
    }
    return { Authorization: `Bearer ${accessToken}` };
  }, []);

  const invokeEdgeAuthed = useCallback(
    async (fnName, body) => {
      const authHeader = await getAuthHeader();
      if (typeof fetch !== 'function') {
        throw new Error('fetch_unavailable');
      }
      const res = await fetch(`${SUPABASE_URL}/functions/v1/${fnName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          ...authHeader,
        },
        body: JSON.stringify(body || {}),
      });
      const text = await res.text();
      let json = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch (_) {
        json = null;
      }
      if (!res.ok) {
        const detail = json?.message || json?.error || text || `http_${res.status}`;
        throw new Error(String(detail));
      }
      return json || {};
    },
    [getAuthHeader],
  );

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
    if (mpLinked) {
      Alert.alert(tStr('admin_mp_already_linked_title'), tStr('admin_mp_already_linked_body'));
      return;
    }
    setConnecting(true);
    try {
      const webReturn = Platform.OS === 'web' ? getMercadoPagoWebReturnUri() : '';
      const nativeReturn = Platform.OS !== 'web' ? getMercadoPagoConnectRedirectUri() : '';
      const body = { organization_id: orgId };
      if (nativeReturn) body.native_return_url = nativeReturn;
      if (webReturn) body.web_return_url = webReturn;

      const data = await invokeEdgeAuthed('mercadopago-oauth-start', body);
      const oauthUrl = String(data?.oauth_url || '');
      if (!oauthUrl) throw new Error('missing_oauth_url');

      if (Platform.OS === 'web') {
        startWebPaymentConnectOAuthSameTab(oauthUrl, 'mercadopago');
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
      const parsed = ExpoLinking.parse(result.url);
      const status = String(parsed.queryParams?.status || '').trim();
      const reason = String(parsed.queryParams?.reason || '').trim();
      await showMpConnectResult(status, reason);
    } catch (e) {
      if (String(e?.message || '').includes('auth_session_missing')) {
        Alert.alert(tStr('security_error_title'), tStr('security_sign_in_required_body'));
        return;
      }
      if (String(e?.message || '').includes('fetch_unavailable')) {
        Alert.alert(tStr('gym_config_alert_title_error'), 'Runtime sin fetch; actualizá la app.');
        return;
      }
      Alert.alert(tStr('gym_config_alert_title_error'), e?.message || String(e));
    } finally {
      setConnecting(false);
    }
  }, [canEdit, invokeEdgeAuthed, mpLinked, orgId, showMpConnectResult, tStr]);

  const disconnectMp = useCallback(async () => {
    if (!orgId || !canEdit) {
      Alert.alert(tStr('gym_config_no_permission_title'), tStr('gym_config_no_permission_body'));
      return;
    }
    const ok = await confirmAction({
      title: tStr('admin_mp_disconnect_confirm_title'),
      message: tStr('admin_mp_disconnect_confirm_body'),
      confirmLabel: tStr('admin_mp_disconnect'),
      cancelLabel: tStr('common_cancel') || 'Cancelar',
      destructive: true,
    });
    if (!ok) return;

    setDisconnecting(true);
    try {
      await invokeEdgeAuthed('mercadopago-disconnect', { organization_id: orgId });
      if (typeof refreshOrganization === 'function') await refreshOrganization(orgId);
      setCheckoutOn(false);
      showMpAlert(tStr('admin_mp_disconnect_ok'), '');
    } catch (e) {
      if (String(e?.message || '').includes('auth_session_missing')) {
        Alert.alert(tStr('security_error_title'), tStr('security_sign_in_required_body'));
      } else if (String(e?.message || '').includes('fetch_unavailable')) {
        Alert.alert(tStr('gym_config_alert_title_error'), 'Runtime sin fetch; actualizá la app.');
      } else {
        Alert.alert(tStr('gym_config_alert_title_error'), e?.message || String(e));
      }
    } finally {
      setDisconnecting(false);
    }
  }, [canEdit, invokeEdgeAuthed, orgId, refreshOrganization, showMpAlert, tStr]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingTop: screenHeaderTopPadding(insets.top),
          paddingHorizontal: MOBILE_SPACING.lg,
          paddingBottom: 8,
          width: '100%',
          maxWidth: WEB_CONTENT_MAX_WIDTH,
          alignSelf: 'center',
        },
        backBtn: { marginRight: 8, width: 'auto', maxWidth: 180, alignSelf: 'flex-start' },
        title: { flex: 1, color: t.text, fontSize: MOBILE_TYPE.headline, fontWeight: '900' },
        body: { paddingHorizontal: MOBILE_SPACING.lg, paddingBottom: 32, width: '100%', maxWidth: WEB_CONTENT_MAX_WIDTH, alignSelf: 'center' },
        hint: { color: t.subText, fontSize: MOBILE_TYPE.caption, marginBottom: 12, lineHeight: 18 },
        label: { color: t.text, fontWeight: '700', marginTop: 12 },
        row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: MOBILE_SPACING.lg },
        rowLabel: { color: t.text, fontWeight: '700', flex: 1, paddingRight: 12 },
        fieldCaption: { color: t.subText, fontSize: MOBILE_TYPE.meta, marginTop: 4, lineHeight: 16 },
        btn: { marginTop: 20, alignSelf: 'flex-start', paddingVertical: 12, paddingHorizontal: 18, borderRadius: MOBILE_RADII.sm, ...t.buttonPrimary },
        btnSecondary: {
          marginTop: 10,
          alignSelf: 'flex-start',
          paddingVertical: 12,
          paddingHorizontal: 18,
          borderRadius: MOBILE_RADII.sm,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          backgroundColor: t.faintStrong,
        },
        btnBusy: { opacity: 0.7 },
        btnText: { ...t.buttonPrimaryText, fontWeight: '800' },
        btnSecondaryText: { color: t.text, fontWeight: '800' },
        noEditHint: { marginTop: MOBILE_SPACING.lg },
        connectedBanner: {
          flexDirection: 'row',
          alignItems: 'flex-start',
          backgroundColor: t.boxBg,
          borderRadius: MOBILE_RADII.md,
          padding: 14,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          marginBottom: 14,
        },
        pausedBanner: {
          flexDirection: 'row',
          alignItems: 'flex-start',
          backgroundColor: t.boxBg,
          borderRadius: MOBILE_RADII.md,
          padding: 14,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          marginBottom: 14,
        },
        connectedTitle: { color: t.text, fontWeight: '900', fontSize: MOBILE_TYPE.bodyStrong },
        connectedBody: { color: t.subText, fontSize: MOBILE_TYPE.body, marginTop: 6, lineHeight: 19 },
        link: { color: t.brand, textDecorationLine: 'underline', marginTop: 10 },
      }),
    [insets.top, t],
  );

  return (
    <ScreenShell screen="Admin">
      <View style={styles.header}>
        {!hideInlineBack ? (
          <BackNavButton onPress={() => navigation.goBack()} label={tStr('common_back')} style={styles.backBtn} />
        ) : null}
        <Text style={styles.title}>{tStr('admin_mp_title')}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        {mpLinked ? (
          <View
            style={checkoutLive ? styles.connectedBanner : styles.pausedBanner}
            accessibilityRole="summary"
          >
            <Ionicons
              name={checkoutLive ? 'checkmark-circle' : 'pause-circle'}
              size={28}
              color={checkoutLive ? t.brand : t.subText}
              style={{ marginRight: 10, marginTop: 2 }}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.connectedTitle}>
                {checkoutLive
                  ? tStr('admin_mp_banner_connected_title')
                  : tStr('admin_mp_banner_paused_title')}
              </Text>
              <Text style={styles.connectedBody}>
                {checkoutLive
                  ? tStr('admin_mp_banner_connected_body')
                  : tStr('admin_mp_banner_paused_body')}
              </Text>
              {mpAccountLine ? <Text style={styles.fieldCaption}>{mpAccountLine}</Text> : null}
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
        <Text style={styles.fieldCaption}>
          {tStr('admin_mp_dev_docs_hint')}{' '}
          <Text
            style={styles.link}
            onPress={() => Linking.openURL('https://www.mercadopago.com.ar/developers')}
          >
            {tStr('admin_mp_dev_docs_link')}
          </Text>
        </Text>

        {canEdit && !mpLinked ? (
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
    </ScreenShell>
  );
}
