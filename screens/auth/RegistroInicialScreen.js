// screens/RegistroInicialScreen.js
// — Registro profesional: crea usuario real en Supabase (Auth + profiles)
// — Si el usuario YA tiene cuenta, puede ir a Login y seguir el flujo con el plan/abono elegido
// — Si viene de OAuth (Google/Facebook/Apple), NO vuelve a crear auth: completa datos mínimos y sigue a Pago

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Switch,
} from 'react-native';
import ScreenShell from '../../components/ScreenShell';
import BackNavButton from '../../components/BackNavButton';
import LogoCompleto from '../../components/LogoCompleto';
import PasswordInput from '../../components/PasswordInput';
import { useAuth } from '../../contexts/AuthContext';
import { useThemeContext } from '../../contexts/ThemeContext';
import { useLocale } from '../../contexts/LocaleContext';
import { fitengineLogoColors as fe } from '../../theme/colors';
import { WEB_CONTENT_MAX_WIDTH, WEB_AUTH_SIGNUP_MAX_WIDTH } from '../../theme/webSpec';
import { supabase } from '../../supabaseClient';
import { getPendingClientInviteCode, clearPendingClientInviteCode } from '../../utils/pendingClientInviteStorage';
import {
  getPendingClientOrganizationId,
  clearPendingClientOrganizationId,
} from '../../utils/pendingClientOrganizationStorage';
import { getClientPostAuthRouteName } from '../../utils/clientPostAuthRoute';
import { MOBILE_RADII, MOBILE_SIZES, MOBILE_SPACING, MOBILE_TYPE } from '../../theme/mobileSpec';
import NeoPanel from '../../components/NeoPanel';
import {
  AuthDismissKeyboardOutside,
  authScrollKeyboardDismissMode,
  authScrollContentJustify,
} from '../../components/AuthWebFormShell';
import { showAppAlert } from '../../utils/confirmAction';
import { resetToRoute } from '../../utils/resetToRoute';
import { sendAppWelcomeEmail } from '../../services/signup/appWelcomeEmail';

function mapJoinInviteErrorToMessage(res, tStr) {
  const e = res?.error;
  if (e === 'invalid_code') return tStr('invite_error_invalid');
  if (e === 'invalid_org') return tStr('directory_error_invalid_org');
  if (e === 'role_not_client') return tStr('invite_error_not_client');
  if (e === 'empty_code') return tStr('invite_error_empty');
  if (e === 'empty_org') return tStr('directory_error_invalid_org');
  if (e === 'not_authenticated') return tStr('invite_error_auth');
  return res?.message || tStr('invite_error_generic');
}

export default function RegistroInicialScreen({ route, navigation }) {
  // Recibimos plan y abono desde Abonos/PlanDetail o desde CreaCuenta (OAuth)
  const { plan, abono, fromOAuth } = route?.params || {};

  /** Sin plan = alta desde FitEngine global (Welcome → Crear cuenta), no marketing Waitomo en fondo. */
  const hasPlanContext = !!(plan && (plan.id || plan.title || plan.name || plan.nombre));

  const { t } = useThemeContext();
  const { t: tStr } = useLocale();

  // ⬇️ OJO: en OAuth NO usamos register(), usamos user actual
  // Intento de compatibilidad: si en tu AuthContext existe alguna función de upsert/ensure profile, la usamos.
  const {
    register,
    user,
    profile,
    upsertProfile,
    ensureProfile,
    updateProfile,
    joinOrganizationWithInviteCode,
    joinOrganizationFromDirectory,
    refreshProfile,
  } = useAuth();

  // ✅ OAuth real: por flag o por provider != email
  const provider = user?.app_metadata?.provider || null;
  const isOAuth = !!fromOAuth || (!!provider && provider !== 'email');

  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // -------------------------
  // Prefill cuando viene de OAuth
  // -------------------------
  useEffect(() => {
    if (!isOAuth) return;

    const meta = user?.user_metadata || {};
    const oauthEmail = user?.email || meta?.email || '';
    const oauthName =
      meta?.full_name || meta?.name || meta?.nombre || meta?.display_name || '';

    if (!email && oauthEmail) setEmail(oauthEmail);
    if (!nombre && oauthName) setNombre(oauthName);
  }, [isOAuth, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Alta global sin plan/abono: no ir a Pago; aplicar código pendiente y entrar al flujo cliente. */
  const finishSignupWithoutPaidPlan = useCallback(
    async (userId) => {
      const { data: sessionWrap } = await supabase.auth.getSession();
      if (!sessionWrap?.session) {
        showAppAlert(tStr('signup_email_confirm_title'), tStr('signup_email_confirm_body'));
        resetToRoute(navigation, 'Login', {
          email: String(email || '').trim().toLowerCase(),
        });
        return;
      }

      const code = await getPendingClientInviteCode();
      let joinedOrgId = null;
      if (code) {
        const res = await joinOrganizationWithInviteCode(code);
        if (!res?.ok) {
          const fatal =
            res?.error === 'invalid_code' ||
            res?.error === 'role_not_client' ||
            res?.error === 'empty_code';
          if (fatal) await clearPendingClientInviteCode();
          showAppAlert(tStr('gym_config_alert_title_error'), mapJoinInviteErrorToMessage(res, tStr));
          resetToRoute(navigation, 'WelcomeClientJoin');
          return;
        }
        await clearPendingClientInviteCode();
        await clearPendingClientOrganizationId();
        joinedOrgId = res?.organization_id || null;
      } else {
        const orgId = await getPendingClientOrganizationId();
        if (orgId) {
          const res = await joinOrganizationFromDirectory(orgId);
          if (!res?.ok) {
            const fatal =
              res?.error === 'invalid_org' ||
              res?.error === 'role_not_client' ||
              res?.error === 'empty_org';
            if (fatal) await clearPendingClientOrganizationId();
            showAppAlert(tStr('gym_config_alert_title_error'), mapJoinInviteErrorToMessage(res, tStr));
            resetToRoute(navigation, 'WelcomeClientJoin');
            return;
          }
          await clearPendingClientOrganizationId();
          joinedOrgId = res?.organization_id || orgId || null;
        }
      }

      await refreshProfile();

      const { data: prof } = await supabase
        .from('profiles')
        .select('plan_actual, organization_id')
        .eq('id', userId)
        .maybeSingle();

      const orgForWelcome = joinedOrgId || prof?.organization_id || null;
      if (orgForWelcome) {
        void sendAppWelcomeEmail('client_joined', { organizationId: orgForWelcome });
      } else {
        void sendAppWelcomeEmail('client');
      }

      const { data: mems } = await supabase
        .from('organization_memberships')
        .select('role, active')
        .eq('user_id', userId);

      const clientMem = (mems || []).some(
        (m) => m.active !== false && String(m.role || '').toLowerCase() === 'cliente',
      );

      const routeName = getClientPostAuthRouteName(prof || {}, { hasClientMembership: clientMem });
      resetToRoute(navigation, routeName);
    },
    [email, joinOrganizationFromDirectory, joinOrganizationWithInviteCode, navigation, refreshProfile, tStr],
  );

  const handleSubmit = async () => {
    if (submitting) return;

    const nombreT = String(nombre || '').trim();
    const telefonoT = String(telefono || '').trim();
    const emailT = String(email || '').trim().toLowerCase();

    // Validaciones por modo
    if (!nombreT || !emailT || !telefonoT) {
      showAppAlert(tStr('reg_ini_alert_faltan_title'), tStr('reg_ini_alert_faltan_body'));
      return;
    }

    if (!isOAuth) {
      if (!password || !confirmPassword) {
        showAppAlert(tStr('reg_ini_alert_faltan_title'), tStr('reg_ini_alert_faltan_body'));
        return;
      }
      if (password.length < 6) {
        showAppAlert(tStr('registro_owner_pass_corta'), tStr('registro_owner_pass_min_body'));
        return;
      }
      if (password !== confirmPassword) {
        showAppAlert(tStr('reg_ini_alert_pass_title'), tStr('reg_ini_alert_pass_body'));
        return;
      }
    }

    if (!acceptTerms) {
      showAppAlert(tStr('trial_alert_terms_title'), tStr('trial_alert_terms_body'));
      return;
    }

    const planActual = (plan && (plan.id || plan.name || plan.title)) || null;

    try {
      setSubmitting(true);

      console.log('🟣 RegistroInicial: submit', { hasPlanContext });
      console.log('isOAuth:', isOAuth, '| fromOAuth:', !!fromOAuth, '| provider:', provider);
      console.log('user?.id:', user?.id || null);
      console.log('route params:', route?.params);

      // =========================================================
      // ✅ MODO A: Registro por Email/Password (crea auth + profile)
      // =========================================================
      if (!isOAuth) {
        const createdUser = await register({
          email: emailT,
          password,
          fullName: nombreT,
          phone: telefonoT,
          planActual,
          username: null,
        });

        if (!createdUser || !createdUser.id) {
          console.log('❌ Registro inicial: user sin id', createdUser);
          showAppAlert(tStr('reg_ini_error_create_title'), tStr('reg_ini_error_create_body'));
          return;
        }

        try {
          await supabase
            .from('profiles')
            .update({ full_name: nombreT, phone: telefonoT })
            .eq('id', createdUser.id);
        } catch (_) {
          /* no bloquea el flujo */
        }

        const { data: sessionAfterSignup } = await supabase.auth.getSession();
        if (sessionAfterSignup?.session) {
          void sendAppWelcomeEmail('client');
        }

        const userData = {
          id: createdUser.id,
          nombre: nombreT,
          telefono: telefonoT,
          email: emailT,
          password,
          ...(abono?.precio != null ? { precio: abono.precio } : {}),
        };

        if (!hasPlanContext) {
          console.log('✅ RegistroInicial (EMAIL) -> flujo global / invitación (sin Pago)', {
            userId: createdUser.id,
          });
          await finishSignupWithoutPaidPlan(createdUser.id);
          return;
        }

        console.log('✅ RegistroInicial (EMAIL) -> navigate Pago', {
          plan,
          userData,
          abono,
        });

        navigation.navigate('Pago', { plan, userData, abono });
        return;
      }

      // =========================================================
      // ✅ MODO B: OAuth (NO crear auth de nuevo)
      // =========================================================
      if (!user?.id) {
        showAppAlert(tStr('reg_ini_error_auth_title'), tStr('reg_ini_error_auth_body'));
        return;
      }

      // ✅ Payload con columnas REALES (no invento)
      const profilePayload = {
        id: user.id,
        full_name: nombre || null,
        phone: telefono || null,
        username: null,
        role: profile?.role || 'cliente',
        plan_actual: planActual || null,
      };

      const fn =
        (typeof ensureProfile === 'function' && ensureProfile) ||
        (typeof upsertProfile === 'function' && upsertProfile) ||
        (typeof updateProfile === 'function' && updateProfile) ||
        null;

      if (!hasPlanContext) {
        if (fn) {
          console.log('🧩 RegistroInicial OAuth: guardando profile antes de unir a org…');
          try {
            await Promise.resolve(fn(profilePayload));
            console.log('✅ RegistroInicial OAuth: profile guardado');
          } catch (e) {
            console.log('🟠 RegistroInicial OAuth: error guardando profile =>', e?.message || e);
            showAppAlert(tStr('gym_config_alert_title_error'), e?.message || tStr('reg_ini_error_generic'));
            return;
          }
        }
        console.log('✅ RegistroInicial (OAUTH) -> flujo global / invitación (sin Pago)', { userId: user.id });
        await finishSignupWithoutPaidPlan(user.id);
        return;
      }

      try {
        if (fn) {
          console.log('🧩 RegistroInicial OAuth: disparando guardado profile (NO bloquea flujo)...');
          Promise.resolve(fn(profilePayload))
            .then(() => console.log('✅ RegistroInicial OAuth: profile guardado/actualizado'))
            .catch((e) =>
              console.log(
                '🟠 RegistroInicial OAuth: profile NO bloquea flujo. Error =>',
                e?.message || e,
              ),
            );
        } else {
          console.log(
            '🟠 RegistroInicial OAuth: no hay ensureProfile/upsertProfile/updateProfile en AuthContext. Sigo igual.',
          );
        }
      } catch (e) {
        console.log('🟠 RegistroInicial OAuth: profile NO bloquea flujo. Error =>', e?.message || e);
      }

      const userData = {
        id: user.id,
        nombre,
        telefono,
        email,
        ...(abono?.precio != null ? { precio: abono.precio } : {}),
      };

      console.log('✅ RegistroInicial (OAUTH) -> navigate Pago', {
        plan,
        userData,
        abono,
      });

      navigation.navigate('Pago', { plan, userData, abono });
    } catch (error) {
      console.log('❌ Error en registro inicial:', error);
      const message = error?.message || tStr('reg_ini_error_generic');
      if (/already registered|already been registered|user_already_exists/i.test(String(message))) {
        showAppAlert(
          tStr('reg_ini_already_registered_title'),
          tStr('reg_ini_already_registered_body'),
        );
        resetToRoute(navigation, 'Login', { email: emailT });
        return;
      }
      showAppAlert(tStr('gym_config_alert_title_error'), message);
    } finally {
      setSubmitting(false);
    }
  };

  const styles = useMemo(() => {
    const shellFe = !hasPlanContext;
    const bg = shellFe ? fe.panelBg : t.boxBg;
    const border = shellFe ? fe.panelBorder : t.overlayBorder;
    const inputBg = shellFe ? fe.inputBg : t.inputBg;
    const textCol = shellFe ? fe.text : t.text;
    const subCol = shellFe ? fe.subText : t.subText;
    return StyleSheet.create({
      button: {
        alignItems: 'center',
        justifyContent: 'center',
        ...(shellFe
          ? {
              backgroundColor: fe.buttonBg,
              borderColor: fe.buttonBorder,
              borderWidth: 1,
            }
          : t.buttonPrimary),
        borderRadius: MOBILE_RADII.sm,
        marginBottom: MOBILE_SPACING.xl,
        marginTop: MOBILE_SPACING.sm + 2,
        minHeight: MOBILE_SIZES.controlHeightLg,
        paddingVertical: MOBILE_SPACING.md,
        paddingHorizontal: MOBILE_SPACING.lg,
        opacity: submitting ? 0.7 : 1,
      },
      buttonText: {
        ...(shellFe ? { color: fe.buttonText } : t.buttonPrimaryText),
        fontWeight: 'bold',
        fontSize: MOBILE_TYPE.bodyStrong,
        textAlign: 'center',
      },
      input: {
        backgroundColor: inputBg,
        borderColor: border,
        borderRadius: MOBILE_RADII.sm,
        borderWidth: 1,
        color: textCol,
        marginBottom: MOBILE_SPACING.md + 3,
        paddingHorizontal: MOBILE_SPACING.md,
        paddingVertical: MOBILE_SPACING.md,
        minHeight: MOBILE_SIZES.controlHeight,
        fontSize: MOBILE_TYPE.body,
      },
      kav: { flex: 1 },
      panel: {
        backgroundColor: bg,
        borderColor: border,
        borderRadius: MOBILE_RADII.lg,
        borderWidth: 1,
        padding: MOBILE_SPACING.xl,
      },
      scroll: {
        backgroundColor: 'transparent',
        flexGrow: 1,
        justifyContent: authScrollContentJustify(),
        padding: MOBILE_SPACING.xl,
        paddingTop: hasPlanContext ? 60 : MOBILE_SPACING.xxl,
        width: '100%',
        maxWidth:
          !hasPlanContext && Platform.OS === 'web'
            ? Math.min(WEB_CONTENT_MAX_WIDTH, WEB_AUTH_SIGNUP_MAX_WIDTH)
            : WEB_CONTENT_MAX_WIDTH,
        alignSelf: 'center',
      },
      title: {
        color: subCol,
        fontSize: MOBILE_TYPE.title,
        fontWeight: 'bold',
        marginBottom: MOBILE_SPACING.xl,
        textAlign: 'center',
      },
      subtitle: {
        color: subCol,
        fontSize: MOBILE_TYPE.body,
        textAlign: 'center',
        opacity: 0.9,
      },
      loginLinkText: {
        color: subCol,
        fontSize: MOBILE_TYPE.caption,
        textAlign: 'center',
        textDecorationLine: 'underline',
      },
      termsRow: { flexDirection: 'row', alignItems: 'center', marginVertical: MOBILE_SPACING.sm, gap: 10 },
      termsText: { color: subCol, flex: 1, fontSize: MOBILE_TYPE.caption },
      termsLink: { color: shellFe ? fe.cyan : t.brand, textDecorationLine: 'underline' },
      inlineRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
      },
      spinner: { marginLeft: MOBILE_SPACING.sm + 2 },
      brandPowered: { color: fe.subText, fontSize: MOBILE_TYPE.caption, marginTop: MOBILE_SPACING.xs },
      brandRow: { width: '100%', alignItems: 'center', marginBottom: MOBILE_SPACING.lg },
    });
  }, [t, submitting, hasPlanContext]);

  const handleYaTengoCuenta = () => {
    navigation.navigate('Login', {
      plan,
      abono,
      fromRegistro: true,
    });
  };

  const placeholderColor = hasPlanContext ? t.placeholder : fe.placeholder;

  return (
    <ScreenShell
      screen={hasPlanContext ? undefined : 'neutral'}
      plan={plan}
      scroll
      keyboardAvoid="form"
      keyboardAvoidProps={{ style: styles.kav }}
      scrollProps={{
        contentContainerStyle: styles.scroll,
        keyboardDismissMode: authScrollKeyboardDismissMode,
      }}
    >
        <AuthDismissKeyboardOutside>
            {!hasPlanContext ? (
              <View style={styles.brandRow}>
                <LogoCompleto height={48} />
                <Text style={styles.brandPowered}>{tStr('login_brand_powered')}</Text>
              </View>
            ) : null}
            <NeoPanel style={styles.panel}>
              <Text style={styles.title}>
                {isOAuth ? tStr('registro_title_oauth') : tStr('registro_title')}
              </Text>
              {isOAuth && (
                <Text style={[styles.subtitle, { marginBottom: MOBILE_SPACING.lg }]}>
                  {tStr('registro_subtitle_oauth')}
                </Text>
              )}

              <TextInput
                style={styles.input}
                placeholder={tStr('registro_placeholder_name')}
                placeholderTextColor={placeholderColor}
                value={nombre}
                onChangeText={setNombre}
              />

              <TextInput
                style={styles.input}
                placeholder={tStr('registro_placeholder_phone')}
                placeholderTextColor={placeholderColor}
                value={telefono}
                onChangeText={setTelefono}
                keyboardType="phone-pad"
              />

              <TextInput
                style={styles.input}
                placeholder={tStr('registro_placeholder_email')}
                placeholderTextColor={placeholderColor}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!isOAuth}
              />

              {!isOAuth && (
                <>
                  <PasswordInput
                    style={styles.input}
                    placeholder={tStr('registro_placeholder_password')}
                    placeholderTextColor={placeholderColor}
                    value={password}
                    onChangeText={setPassword}
                    containerStyle={{ marginBottom: MOBILE_SPACING.md + 3 }}
                  />

                  <PasswordInput
                    style={styles.input}
                    placeholder={tStr('registro_placeholder_confirm_password')}
                    placeholderTextColor={placeholderColor}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    containerStyle={{ marginBottom: MOBILE_SPACING.md + 3 }}
                  />
                </>
              )}

              <View style={styles.termsRow}>
                <Switch value={acceptTerms} onValueChange={setAcceptTerms} trackColor={{ true: '#86C4C7' }} />
                <Text style={styles.termsText}>
                  {tStr('trial_terms_prefix')}{' '}
                  <Text style={styles.termsLink} onPress={() => navigation.navigate('TermsOfUse')}>
                    {tStr('welcome_footer_terms')}
                  </Text>{' '}
                  {tStr('trial_terms_and')}{' '}
                  <Text style={styles.termsLink} onPress={() => navigation.navigate('PrivacyPolicy')}>
                    {tStr('welcome_footer_privacy')}
                  </Text>
                </Text>
              </View>

              <TouchableOpacity
                style={styles.button}
                onPress={handleSubmit}
                disabled={submitting}
                activeOpacity={0.85}
              >
                <View style={styles.inlineRow}>
                  <Text style={styles.buttonText}>
                    {submitting
                      ? tStr('registro_continuing')
                      : tStr(hasPlanContext ? 'registro_continue_pago' : 'registro_continue_fin')}
                  </Text>
                  {submitting ? (
                    <ActivityIndicator size="small" style={styles.spinner} />
                  ) : null}
                </View>
              </TouchableOpacity>

              <TouchableOpacity onPress={handleYaTengoCuenta} disabled={submitting}>
                <Text style={styles.loginLinkText}>
                  {tStr('registro_has_account')}
                </Text>
              </TouchableOpacity>
              <BackNavButton
                onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('WelcomeGlobal'))}
                style={{ marginTop: MOBILE_SPACING.lg }}
              />
            </NeoPanel>
        </AuthDismissKeyboardOutside>
    </ScreenShell>
  );
}
