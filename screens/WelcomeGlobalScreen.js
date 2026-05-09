// WelcomeGlobalScreen — Tras Splash: acciones claras (crear cuenta / iniciar sesión).
// Cuenta dual: se redirige a WelcomeDualChoice (misma estética, flujo aparte).

import React, { useEffect, useMemo, useRef } from 'react';
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
import { useLocale } from '../contexts/LocaleContext';
import LogoCompleto from '../components/LogoCompleto';
import { useAuth } from '../contexts/AuthContext';
import { fitengineLogoColors as fe, fitengineUiTokens as fitT } from '../theme/colors';
import { createWelcomeGlobalLayoutStyles } from '../styles/welcomeGlobalLayoutStyles';
import { useWelcomeRouting } from '../hooks/useWelcomeRouting';
import { WEB_DESKTOP_BREAKPOINT } from '../theme/webSpec';
/** Misma escala que `createWelcomeGlobalLayoutStyles` → `theme/mobileSpec` */
export { MOBILE_RADII, MOBILE_SIZES, MOBILE_SPACING, MOBILE_TYPE } from '../theme/mobileSpec';

export default function WelcomeGlobalScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { t: tStr, locale, setLocale } = useLocale();
  const {
    session,
    isDualHatUser,
    activeAppMode,
    persistActiveAppMode,
    hasStaffMembership,
    hasClientMembership,
    authNavigationReady,
    initialProfileSyncDone,
    logout,
  } = useAuth() || {};

  const { navigateToDestination, onContinue, isDualByMemberships } = useWelcomeRouting();

  /** Sin esto, "Continuar" puede dispararse con profile=null (OAuth) y el routing manda a Registro o no-op. */
  const sessionRoutingReady =
    !!session?.user?.id &&
    authNavigationReady &&
    (Platform.OS !== 'web' || initialProfileSyncDone === true);

  const isDualSession = sessionRoutingReady && (isDualByMemberships || isDualHatUser);

  // Dual solo si aún no hay modo guardado (ej. login staff ya persistió "staff" → no mostrar elección).
  const needsDualRedirect =
    sessionRoutingReady && (isDualByMemberships || isDualHatUser) && activeAppMode == null;

  useEffect(() => {
    if (!needsDualRedirect) return;
    navigation.replace('WelcomeDualChoice');
  }, [needsDualRedirect, navigation]);

  // En web: al volver de OAuth deberíamos caer directo al panel (no depender del botón).
  // En móvil lo dejamos intacto (ya funciona).
  const lastAutoNavUserIdRef = useRef(null);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!sessionRoutingReady) return;
    if (needsDualRedirect) return;
    const uid = session?.user?.id || null;
    if (!uid) return;
    if (lastAutoNavUserIdRef.current === uid) return;
    lastAutoNavUserIdRef.current = uid;
    try {
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        // eslint-disable-next-line no-console
        console.log('ROUTING_DEBUG WelcomeGlobal autoContinue', { uid });
      }
    } catch (_) {}
    onContinue();
  }, [Platform.OS, sessionRoutingReady, needsDualRedirect, session?.user?.id, onContinue]);

  const onLogout = async () => {
    try {
      if (logout) await logout();
    } catch (_) {}
  };

  const showContinueSession = sessionRoutingReady && !needsDualRedirect;

  const showGuestActions = !session?.user?.id;

  const welcomeHeadlineKey = showGuestActions
    ? 'welcome_global_subtitle'
    : showContinueSession
      ? isDualSession
        ? 'welcome_dual_resume_subtitle'
        : 'welcome_session_resume_subtitle'
      : 'welcome_global_subtitle';

  const isWideWeb = Platform.OS === 'web' && width >= WEB_DESKTOP_BREAKPOINT;
  const layoutStyles = useMemo(
    () => createWelcomeGlobalLayoutStyles(fitT, fe, insets.top, { isWide: isWideWeb }),
    [insets.top, isWideWeb],
  );

  if (
    session?.user?.id &&
    (!authNavigationReady || (Platform.OS === 'web' && initialProfileSyncDone !== true))
  ) {
    return (
      <View style={[layoutStyles.container, layoutStyles.loadingBox, { justifyContent: 'center' }]}>
        <LogoCompleto height={120} />
        <ActivityIndicator size="large" color={fitT.logoCian} />
        <Text style={layoutStyles.subtitle}>{tStr('common_loading')}</Text>
      </View>
    );
  }

  if (needsDualRedirect) {
    return (
      <View style={[layoutStyles.container, layoutStyles.loadingBox, { justifyContent: 'center' }]}>
        <LogoCompleto height={120} />
        <ActivityIndicator size="large" color={fitT.logoCian} />
        <Text style={layoutStyles.subtitle}>{tStr('common_loading')}</Text>
      </View>
    );
  }

  return (
    <View style={layoutStyles.container}>
      <View style={layoutStyles.topBar}>
        <View style={layoutStyles.localeGroup}>
          <TouchableOpacity
            style={[layoutStyles.localeBtn, locale === 'es' && layoutStyles.localeBtnActive]}
            onPress={() => setLocale('es')}
            activeOpacity={0.85}
          >
            <Text style={[layoutStyles.localeText, locale === 'es' && layoutStyles.localeTextActive]}>
              ES
            </Text>
          </TouchableOpacity>
          <View style={layoutStyles.localeDivider} />
          <TouchableOpacity
            style={[layoutStyles.localeBtn, locale === 'en' && layoutStyles.localeBtnActive]}
            onPress={() => setLocale('en')}
            activeOpacity={0.85}
          >
            <Text style={[layoutStyles.localeText, locale === 'en' && layoutStyles.localeTextActive]}>
              EN
            </Text>
          </TouchableOpacity>
          <View style={layoutStyles.localeDivider} />
          <TouchableOpacity
            style={[layoutStyles.localeBtn, locale === 'pt' && layoutStyles.localeBtnActive]}
            onPress={() => setLocale('pt')}
            activeOpacity={0.85}
          >
            <Text style={[layoutStyles.localeText, locale === 'pt' && layoutStyles.localeTextActive]}>
              PT
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={layoutStyles.content}>
        <View style={layoutStyles.logoWrap}>
          <LogoCompleto height={160} />
        </View>

        <Text style={layoutStyles.subtitle}>{tStr(welcomeHeadlineKey)}</Text>

        {showGuestActions && (
          <View style={layoutStyles.ctaWrap}>
            <View style={layoutStyles.joinHub}>
              <Text style={layoutStyles.joinHubTitle}>{tStr('welcome_join_hub_title')}</Text>
              <Text style={layoutStyles.joinHubHint}>{tStr('welcome_join_hub_hint')}</Text>
              <View style={layoutStyles.joinSubRow}>
                <TouchableOpacity
                  style={[
                    layoutStyles.ctaPrimary,
                    isWideWeb ? layoutStyles.joinSubBtnWide : layoutStyles.joinSubBtnStack,
                  ]}
                  onPress={() => navigation.navigate('JoinWithInvite')}
                  activeOpacity={0.85}
                >
                  <Text style={layoutStyles.ctaPrimaryText}>{tStr('welcome_join_code_cta')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    layoutStyles.ctaSecondary,
                    isWideWeb ? layoutStyles.joinSubBtnWide : layoutStyles.joinSubBtnStack,
                  ]}
                  onPress={() => navigation.navigate('PublicDirectory')}
                  activeOpacity={0.85}
                >
                  <Text style={layoutStyles.ctaSecondaryText}>{tStr('welcome_find_gym_cta')}</Text>
                </TouchableOpacity>
              </View>
              <Text style={layoutStyles.joinHubHint}>{tStr('welcome_find_gym_soon_body')}</Text>
            </View>

            <TouchableOpacity
              style={layoutStyles.ctaPrimary}
              onPress={() => navigation.navigate('Login', { forStaff: false })}
              activeOpacity={0.85}
            >
              <Text style={layoutStyles.ctaPrimaryText}>{tStr('welcome_action_login')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={layoutStyles.ctaSecondary}
              onPress={() => navigation.navigate('CreateAccount')}
              activeOpacity={0.85}
            >
              <Text style={layoutStyles.ctaSecondaryText}>{tStr('welcome_action_create_account')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={layoutStyles.linkRow}
              onPress={() => navigation.navigate('Login', { forStaff: true })}
              activeOpacity={0.8}
            >
              <Text style={layoutStyles.linkText}>{tStr('welcome_login_staff_short')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={layoutStyles.linkRow}
              onPress={() => navigation.navigate('RegistroOwner')}
              activeOpacity={0.8}
            >
              <Text style={layoutStyles.linkText}>{tStr('welcome_create_gym_coach_short')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {showContinueSession && (
          <View style={layoutStyles.ctaWrap}>
            {session?.user?.email ? (
              <Text style={layoutStyles.sessionEmail} numberOfLines={1}>
                {session.user.email}
              </Text>
            ) : null}
            <View style={layoutStyles.sessionActionsRow}>
              {(() => {
                const mode = activeAppMode;
                const dualUnknownMode =
                  isDualSession && mode !== 'staff' && mode !== 'client';

                if (!isDualSession || dualUnknownMode) {
                  return (
                    <>
                      <TouchableOpacity
                        style={layoutStyles.ctaPrimary}
                        onPress={onContinue}
                        activeOpacity={0.85}
                      >
                        <Text style={layoutStyles.ctaPrimaryText}>{tStr('welcome_action_continue')}</Text>
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
                      style={layoutStyles.ctaPrimary}
                      onPress={onContinue}
                      activeOpacity={0.85}
                    >
                      <Text style={layoutStyles.ctaPrimaryText}>{primaryLabel}</Text>
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
        )}
      </View>
    </View>
  );
}
