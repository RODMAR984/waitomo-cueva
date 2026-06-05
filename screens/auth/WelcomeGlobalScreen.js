// WelcomeGlobalScreen — Logo + marca, Empezar / gym-coach, iniciar sesión, idioma, pie legal.

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ActivityIndicator,
  Platform,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useLocale } from '../../contexts/LocaleContext';
import LogoCompleto from '../../components/LogoCompleto';
import WelcomeLocaleDropdown from '../../components/WelcomeLocaleDropdown';
import { useAuth } from '../../contexts/AuthContext';
import { fitengineLogoColors as fe, fitengineUiTokens as fitT } from '../../theme/colors';
import { createWelcomeGlobalLayoutStyles } from '../../styles/welcomeGlobalLayoutStyles';
import { useWelcomeRouting } from '../../hooks/useWelcomeRouting';
import { clearWebAuthRoute } from '../../utils/webAuthRoutePersistence';
import { WEB_DESKTOP_BREAKPOINT } from '../../theme/webSpec';
import { MOBILE_RADII, MOBILE_SIZES, MOBILE_SPACING, MOBILE_TYPE } from '../../theme/mobileSpec';
import { authTrace } from '../../utils/authTrace';

export { MOBILE_RADII, MOBILE_SIZES, MOBILE_SPACING, MOBILE_TYPE };

export default function WelcomeGlobalScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { t: tStr, locale, setLocale } = useLocale();
  const {
    session,
    profile,
    isDualHatUser,
    activeAppMode,
    persistActiveAppMode,
    hasStaffMembership,
    hasClientMembership,
    authNavigationReady,
    initialProfileSyncDone,
    authSessionRestored = true,
    logout,
    isPostLogoutUiActive,
  } = useAuth() || {};

  const { navigateToDestination, onContinue, isDualByMemberships } = useWelcomeRouting();

  const resetStackTo = useCallback(
    (routes) => {
      const state = { index: 0, routes };
      try {
        navigation.reset(state);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.log('ROUTING_DEBUG WelcomeGlobal reset failed', e?.message || e);
      }
    },
    [navigation],
  );

  // Sync terminado + perfil ausente → Continuar habilitado (rutea a RegistroInicial).
  // Perfil de otro usuario (stale) → seguir en “cargando” hasta que AuthContext alinee.
  // No exigir authNavigationReady aquí: bloqueaba Continuar; el routing lo usa aparte (sessionRoutingReady).
  const profileReady =
    !!session?.user?.id &&
    initialProfileSyncDone === true &&
    (profile?.id == null || profile.id === session.user.id);
  const sessionRoutingReady =
    !!session?.user?.id && authNavigationReady && initialProfileSyncDone === true;

  const isDualSession = sessionRoutingReady && (isDualByMemberships || isDualHatUser);

  const needsDualRedirect =
    sessionRoutingReady && (isDualByMemberships || isDualHatUser) && activeAppMode == null;

  const suppressSessionAfterLogout =
    typeof isPostLogoutUiActive === 'function' && isPostLogoutUiActive();

  useEffect(() => {
    if (!needsDualRedirect) return;
    navigation.replace('WelcomeDualChoice');
  }, [needsDualRedirect, navigation]);

  const webBootstrapDoneRef = useRef(false);
  const webBootstrapUidRef = useRef(null);
  useEffect(() => {
    const uid = session?.user?.id || null;
    if (uid !== webBootstrapUidRef.current) {
      webBootstrapUidRef.current = uid;
      webBootstrapDoneRef.current = false;
    }
  }, [session?.user?.id]);

  // Sesión restaurada sin fila profiles: descartar ruta guardada (evita F5 → panel fantasma).
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!session?.user?.id || initialProfileSyncDone !== true) return;
    if (profile?.id && profile.id === session.user.id) return;
    clearWebAuthRoute();
  }, [session?.user?.id, profile?.id, initialProfileSyncDone]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (suppressSessionAfterLogout) return;
    if (!sessionRoutingReady) return;
    if (needsDualRedirect) return;
    const uid = session?.user?.id || null;
    if (!uid) return;
    if (!initialProfileSyncDone) return;
    // Invariante web: no restaurar ruta ni auto-Continuar sin fila profiles alineada (evita usuario fantasma).
    if (!profile?.id || profile.id !== uid) return;
    if (webBootstrapDoneRef.current) return;
    webBootstrapDoneRef.current = true;

    // Invariante web: no restaurar ruta profunda guardada (pantallas sin guard de perfil → fantasma).
    try {
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        // eslint-disable-next-line no-console
        console.log('ROUTING_DEBUG WelcomeGlobal first bootstrap onContinue', { uid });
      }
    } catch (_) {}
    authTrace('welcome_web_auto_onContinue', {
      initialProfileSyncDone: initialProfileSyncDone === true,
      authNavigationReady: authNavigationReady === true,
      hasProfile: !!profile?.id,
      hasClientMembership,
      hasStaffMembership,
      needsDualRedirect,
    });
    onContinue();
  }, [
    Platform.OS,
    suppressSessionAfterLogout,
    sessionRoutingReady,
    needsDualRedirect,
    session?.user?.id,
    profile?.id,
    onContinue,
    initialProfileSyncDone,
    authNavigationReady,
    hasClientMembership,
    hasStaffMembership,
    resetStackTo,
  ]);

  const onLogout = async () => {
    try {
      if (logout) await logout();
    } catch (_) {}
  };

  const showContinueSession =
    !!session?.user?.id && profileReady && !needsDualRedirect && !suppressSessionAfterLogout;
  const showGuestActions = !session?.user?.id || suppressSessionAfterLogout;
  const showSessionResume = !!session?.user?.id && !showGuestActions && !suppressSessionAfterLogout;

  const resumeSubtitleKey = showContinueSession
    ? isDualSession
      ? 'welcome_dual_resume_subtitle'
      : 'welcome_session_resume_subtitle'
    : 'welcome_global_subtitle';

  const isWideWeb = Platform.OS === 'web' && width >= WEB_DESKTOP_BREAKPOINT;
  const layoutStyles = useMemo(
    () => createWelcomeGlobalLayoutStyles(fitT, fe, insets.top, { isWide: isWideWeb }),
    [insets.top, isWideWeb],
  );

  return (
    <View style={layoutStyles.container}>
      <View style={layoutStyles.topBar}>
        <WelcomeLocaleDropdown
          locale={locale}
          setLocale={setLocale}
          layoutStyles={layoutStyles}
          fitT={fitT}
        />
      </View>

      <View
        style={[layoutStyles.content, showGuestActions ? { justifyContent: 'center' } : null]}
        testID="welcome-global-content"
        collapsable={false}
      >
        {showGuestActions && !showSessionResume ? (
          <>
            <View style={[layoutStyles.logoWrap, { marginBottom: MOBILE_SPACING.lg }]}>
              <LogoCompleto height={152} />
            </View>

            <View style={[layoutStyles.ctaWrap, { marginTop: MOBILE_SPACING.sm }]}>
              <TouchableOpacity
                style={layoutStyles.ctaPrimary}
                onPress={() => navigation.navigate('WelcomeClientJoin')}
                activeOpacity={0.85}
                testID="welcome-cta-start"
              >
                <Text style={layoutStyles.ctaPrimaryText}>{tStr('welcome_cta_start')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={layoutStyles.ctaSecondaryOutlineBrand}
                onPress={() => navigation.navigate('RegistroOwner')}
                activeOpacity={0.85}
                testID="welcome-cta-gym-or-coach"
              >
                <Text style={layoutStyles.ctaSecondaryOutlineBrandText}>{tStr('welcome_cta_gym_or_coach')}</Text>
              </TouchableOpacity>

              <View style={layoutStyles.loginPromptRow}>
                <Text style={layoutStyles.loginPromptMuted}>{tStr('welcome_login_prompt_lead')} </Text>
                <TouchableOpacity
                  onPress={() => navigation.navigate('Login')}
                  activeOpacity={0.75}
                  testID="welcome-cta-login-client"
                >
                  <Text style={layoutStyles.loginPromptAction}>{tStr('welcome_login_prompt_action')}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={[layoutStyles.footerLegalRow, { paddingBottom: Math.max(insets.bottom, MOBILE_SPACING.lg) }]}>
              <TouchableOpacity onPress={() => navigation.navigate('TermsOfUse')} activeOpacity={0.75}>
                <Text style={layoutStyles.footerLegalText}>{tStr('welcome_footer_terms')}</Text>
              </TouchableOpacity>
              <Text style={layoutStyles.footerLegalDot}>·</Text>
              <TouchableOpacity onPress={() => navigation.navigate('PrivacyPolicy')} activeOpacity={0.75}>
                <Text style={layoutStyles.footerLegalText}>{tStr('welcome_footer_privacy')}</Text>
              </TouchableOpacity>
            </View>

          </>
        ) : (
          <>
            <View style={layoutStyles.logoWrap}>
              <LogoCompleto height={160} />
            </View>
            <Text style={layoutStyles.subtitle}>{tStr(resumeSubtitleKey)}</Text>

            <View style={layoutStyles.ctaWrap}>
              {session?.user?.email ? (
                <Text style={layoutStyles.sessionEmail} numberOfLines={1}>
                  {session.user.email}
                </Text>
              ) : null}
              <View style={layoutStyles.sessionActionsRow}>
                {(() => {
                  const mode = activeAppMode;
                  const dualUnknownMode = isDualSession && mode !== 'staff' && mode !== 'client';

                  if (!isDualSession || dualUnknownMode) {
                    return (
                      <>
                        <TouchableOpacity
                          style={[layoutStyles.ctaPrimary, !profileReady ? { opacity: 0.55 } : null]}
                          onPress={onContinue}
                          activeOpacity={0.85}
                          disabled={!profileReady}
                          testID="welcome-session-continue"
                        >
                          <Text style={layoutStyles.ctaPrimaryText}>
                            {!profileReady ? tStr('common_loading') : tStr('welcome_action_continue')}
                          </Text>
                        </TouchableOpacity>
                        {dualUnknownMode ? (
                          <>
                            {hasStaffMembership ? (
                              <TouchableOpacity
                                style={layoutStyles.ctaSecondary}
                                onPress={async () => {
                                  if (persistActiveAppMode && session?.user?.id) {
                                    await persistActiveAppMode('staff', session.user.id);
                                  }
                                  navigateToDestination('staff');
                                }}
                                activeOpacity={0.85}
                              >
                                <Text style={layoutStyles.ctaSecondaryText}>
                                  {tStr('welcome_dual_as_staff')}
                                </Text>
                              </TouchableOpacity>
                            ) : null}
                            {hasClientMembership ? (
                              <TouchableOpacity
                                style={layoutStyles.ctaSecondary}
                                onPress={async () => {
                                  if (persistActiveAppMode && session?.user?.id) {
                                    await persistActiveAppMode('client', session.user.id);
                                  }
                                  navigateToDestination('client');
                                }}
                                activeOpacity={0.85}
                              >
                                <Text style={layoutStyles.ctaSecondaryText}>
                                  {tStr('welcome_dual_as_client')}
                                </Text>
                              </TouchableOpacity>
                            ) : null}
                          </>
                        ) : null}
                      </>
                    );
                  }

                  const primaryLabel =
                    mode === 'staff'
                      ? tStr('welcome_continue_as_staff_last')
                      : tStr('welcome_continue_as_client_last');
                  const showSwitchToStaff = hasStaffMembership && mode !== 'staff';
                  const showSwitchToClient = hasClientMembership && mode !== 'client';

                  return (
                    <>
                      <TouchableOpacity
                        style={[layoutStyles.ctaPrimary, !profileReady ? { opacity: 0.55 } : null]}
                        onPress={onContinue}
                        activeOpacity={0.85}
                        disabled={!profileReady}
                        testID="welcome-session-continue"
                      >
                        <Text style={layoutStyles.ctaPrimaryText}>
                          {!profileReady ? tStr('common_loading') : primaryLabel}
                        </Text>
                      </TouchableOpacity>
                      {showSwitchToStaff ? (
                        <TouchableOpacity
                          style={layoutStyles.ctaSecondary}
                          onPress={async () => {
                            if (persistActiveAppMode && session?.user?.id) {
                              await persistActiveAppMode('staff', session.user.id);
                            }
                            navigateToDestination('staff');
                          }}
                          activeOpacity={0.85}
                        >
                          <Text style={layoutStyles.ctaSecondaryText}>
                            {tStr('welcome_switch_role_staff')}
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                      {showSwitchToClient ? (
                        <TouchableOpacity
                          style={layoutStyles.ctaSecondary}
                          onPress={async () => {
                            if (persistActiveAppMode && session?.user?.id) {
                              await persistActiveAppMode('client', session.user.id);
                            }
                            navigateToDestination('client');
                          }}
                          activeOpacity={0.85}
                        >
                          <Text style={layoutStyles.ctaSecondaryText}>
                            {tStr('welcome_switch_role_client')}
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                    </>
                  );
                })()}
              </View>
              <TouchableOpacity style={layoutStyles.linkRow} onPress={onLogout} activeOpacity={0.8}>
                <Text style={layoutStyles.linkText}>{tStr('welcome_logout_use_other')}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </View>
  );
}
