// WelcomeGlobalScreen — Tras Splash: siempre ver acciones claras (crear cuenta / iniciar sesión).
// Con sesión: "Continuar" al panel (sin redirección automática que salte esta pantalla).

import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useLocale } from '../contexts/LocaleContext';
import { useThemeContext } from '../contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LogoCompleto from '../components/LogoCompleto';
import { useAuth } from '../contexts/AuthContext';
import { fitengineLogoColors as fe } from '../theme/colors';

export default function WelcomeGlobalScreen() {
  const navigation = useNavigation();
  const { t: tStr, locale, setLocale } = useLocale();
  const { t } = useThemeContext();
  const {
    session,
    profile,
    role,
    loading,
    isDualHatUser,
    activeAppMode,
    persistActiveAppMode,
    ownedOrganizations,
    organizationMemberships,
    hasStaffMembership,
    hasClientMembership,
    authNavigationReady,
    logout,
  } = useAuth() || {};
  const insets = useSafeAreaInsets();

  const navigateForStaffDual = useCallback(() => {
    if (role === 'coach' || role === 'admin') {
      navigation.reset({ index: 0, routes: [{ name: 'AdminLite' }] });
      return;
    }
    if (ownedOrganizations?.length > 0) {
      navigation.reset({ index: 0, routes: [{ name: 'AdminLite' }] });
      return;
    }
    if (!profile) {
      navigation.reset({ index: 0, routes: [{ name: 'RegistroInicial' }] });
      return;
    }
    navigation.reset({
      index: 0,
      routes: [{ name: 'ConfiguraTuEspacio', params: { email: session?.user?.email } }],
    });
  }, [navigation, profile, role, ownedOrganizations?.length, session?.user?.email]);

  const membershipsLoaded = Array.isArray(organizationMemberships);
  const isDualByMemberships = hasClientMembership && hasStaffMembership;

  /** modeOverride: tras persistActiveAppMode el state puede no haber hecho flush aún */
  const navigateToDestination = useCallback(
    (modeOverride) => {
      const mode = modeOverride !== undefined ? modeOverride : activeAppMode;
      // eslint-disable-next-line no-console
      console.log('ROUTING_DEBUG WelcomeGlobal navigateToDestination', {
        modeOverride,
        resolvedMode: mode,
        role,
        hasStaffMembership,
        hasClientMembership,
        isDualByMemberships,
        isDualHatUser,
        ownedOrgsCount: ownedOrganizations?.length ?? 0,
      });

      if (role === 'superadmin') {
        navigation.reset({ index: 0, routes: [{ name: 'Admin' }] });
        return;
      }

      // Modelo serio: primero memberships; luego fallback legacy.
      if (isDualByMemberships && !mode) {
        return;
      }

      // Modo persistido "client" (login cliente o dato viejo) pero la cuenta NO tiene membresía cliente — solo staff.
      if (
        mode === 'client' &&
        membershipsLoaded &&
        hasStaffMembership &&
        !hasClientMembership
      ) {
        if (persistActiveAppMode && session?.user?.id) {
          void persistActiveAppMode('staff', session.user.id);
        }
        navigateForStaffDual();
        return;
      }

      if ((isDualByMemberships || isDualHatUser) && mode === 'client') {
        if (!profile) {
          navigation.reset({ index: 0, routes: [{ name: 'RegistroInicial' }] });
          return;
        }
        navigation.reset({ index: 0, routes: [{ name: 'ClientTabs' }] });
        return;
      }

      if ((isDualByMemberships || isDualHatUser) && mode === 'staff') {
        navigateForStaffDual();
        return;
      }

      if (membershipsLoaded && hasStaffMembership && !hasClientMembership) {
        if (persistActiveAppMode && session?.user?.id) {
          void persistActiveAppMode('staff', session.user.id);
        }
        navigateForStaffDual();
        return;
      }
      if (membershipsLoaded && hasClientMembership && !hasStaffMembership) {
        if (!profile) {
          navigation.reset({ index: 0, routes: [{ name: 'RegistroInicial' }] });
          return;
        }
        navigation.reset({ index: 0, routes: [{ name: 'ClientTabs' }] });
        return;
      }

      // Coach/admin sin org propia en contexto (p. ej. solo organization_id seed Waitomo) → terminar FitEngine primero.
      if (
        (role === 'coach' || role === 'admin') &&
        (!ownedOrganizations || ownedOrganizations.length === 0)
      ) {
        navigation.reset({
          index: 0,
          routes: [{ name: 'ConfiguraTuEspacio', params: { email: session?.user?.email } }],
        });
        return;
      }

      if (role === 'coach' || role === 'admin') {
        navigation.reset({ index: 0, routes: [{ name: 'AdminLite' }] });
        return;
      }
      // Dueño de org / gym cargado en contexto pero sin rol cliente (memberships vacíos o solo staff en otro camino).
      if (ownedOrganizations?.length > 0 && !hasClientMembership) {
        if (persistActiveAppMode && session?.user?.id) {
          void persistActiveAppMode('staff', session.user.id);
        }
        navigateForStaffDual();
        return;
      }
      if (!profile) {
        navigation.reset({ index: 0, routes: [{ name: 'RegistroInicial' }] });
        return;
      }
      navigation.reset({ index: 0, routes: [{ name: 'ClientTabs' }] });
    },
    [
      navigation,
      role,
      profile,
      membershipsLoaded,
      hasStaffMembership,
      hasClientMembership,
      isDualByMemberships,
      isDualHatUser,
      activeAppMode,
      navigateForStaffDual,
      persistActiveAppMode,
      session?.user?.id,
      ownedOrganizations,
    ],
  );

  const onDualClient = useCallback(async () => {
    if (!persistActiveAppMode) return;
    await persistActiveAppMode('client');
    navigateToDestination('client');
  }, [persistActiveAppMode, navigateToDestination]);

  const onDualStaff = useCallback(async () => {
    if (!persistActiveAppMode) return;
    await persistActiveAppMode('staff');
    navigateToDestination('staff');
  }, [persistActiveAppMode, navigateToDestination]);

  const onContinue = useCallback(() => {
    navigateToDestination();
  }, [navigateToDestination]);

  const onLogout = useCallback(async () => {
    try {
      if (logout) await logout();
    } catch (_) {}
  }, [logout]);

  const showDualChoice =
    !!session?.user?.id &&
    authNavigationReady &&
    (isDualByMemberships || isDualHatUser) &&
    !activeAppMode;

  const showContinueSession =
    !!session?.user?.id &&
    authNavigationReady &&
    !showDualChoice;

  const showGuestActions = !session?.user?.id;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: t.bg,
        },
        topBar: {
          position: 'absolute',
          top: 18,
          right: 18,
          zIndex: 20,
        },
        localeGroup: {
          flexDirection: 'row',
          borderRadius: 10,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          overflow: 'hidden',
          backgroundColor: t.inputBg,
        },
        localeBtn: {
          paddingVertical: 6,
          paddingHorizontal: 10,
          minWidth: 44,
          alignItems: 'center',
        },
        localeBtnActive: {
          backgroundColor: fe.buttonBg,
        },
        localeDivider: {
          width: 1,
          backgroundColor: t.overlayBorder,
        },
        localeText: {
          color: t.subText,
          fontSize: 12,
          fontWeight: '800',
          letterSpacing: 0.3,
        },
        localeTextActive: {
          color: fe.buttonText,
        },
        content: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 24,
        },
        logoWrap: {
          alignItems: 'center',
          marginBottom: 34,
        },
        subtitle: {
          color: t.subText,
          fontSize: 14,
          textAlign: 'center',
          marginBottom: 16,
          maxWidth: 320,
        },
        ctaWrap: {
          alignItems: 'center',
          gap: 8,
          width: '100%',
          maxWidth: 280,
        },
        ctaPrimary: {
          backgroundColor: fe.buttonBg,
          borderColor: fe.buttonBorder,
          borderWidth: 1,
          borderRadius: 10,
          paddingVertical: 12,
          paddingHorizontal: 16,
          alignItems: 'center',
          width: '100%',
        },
        ctaSecondary: {
          backgroundColor: fe.buttonBg,
          borderColor: fe.buttonBorder,
          borderWidth: 1,
          borderRadius: 10,
          paddingVertical: 12,
          paddingHorizontal: 16,
          alignItems: 'center',
          width: '100%',
        },
        ctaPrimaryText: {
          color: fe.buttonText,
          fontSize: 15,
          fontWeight: 'bold',
        },
        ctaSecondaryText: {
          color: fe.buttonText,
          fontSize: 15,
          fontWeight: 'bold',
        },
        linkRow: {
          marginTop: 6,
          paddingVertical: 6,
        },
        linkText: {
          color: t.subText,
          fontSize: 13,
          textAlign: 'center',
          textDecorationLine: 'underline',
        },
        dualHint: {
          color: t.subText,
          fontSize: 13,
          textAlign: 'center',
          marginBottom: 6,
          paddingHorizontal: 8,
        },
        sessionEmail: {
          color: t.subText,
          fontSize: 12,
          textAlign: 'center',
          marginBottom: 12,
          opacity: 0.9,
        },
        sessionActionsRow: {
          width: '100%',
          gap: 8,
        },
        loadingBox: {
          alignItems: 'center',
          gap: 12,
        },
      }),
    [t, insets.top, insets.bottom],
  );

  if (session?.user?.id && !authNavigationReady) {
    return (
      <View style={[styles.container, styles.loadingBox, { justifyContent: 'center' }]}>
        <LogoCompleto height={120} />
        <ActivityIndicator size="large" color={t.logoCian} />
        <Text style={styles.subtitle}>{tStr('common_loading')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <View style={styles.localeGroup}>
          <TouchableOpacity
            style={[styles.localeBtn, locale === 'es' && styles.localeBtnActive]}
            onPress={() => setLocale('es')}
            activeOpacity={0.85}
          >
            <Text style={[styles.localeText, locale === 'es' && styles.localeTextActive]}>ES</Text>
          </TouchableOpacity>
          <View style={styles.localeDivider} />
          <TouchableOpacity
            style={[styles.localeBtn, locale === 'en' && styles.localeBtnActive]}
            onPress={() => setLocale('en')}
            activeOpacity={0.85}
          >
            <Text style={[styles.localeText, locale === 'en' && styles.localeTextActive]}>EN</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.logoWrap}>
          <LogoCompleto height={160} />
        </View>

        <Text style={styles.subtitle}>{tStr('welcome_global_subtitle')}</Text>

        {showGuestActions && (
          <View style={styles.ctaWrap}>
            <TouchableOpacity
              style={styles.ctaPrimary}
              onPress={() => navigation.navigate('Login', { forStaff: false })}
              activeOpacity={0.85}
            >
              <Text style={styles.ctaPrimaryText}>{tStr('welcome_action_login')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.ctaSecondary}
              onPress={() => navigation.navigate('CreateAccount')}
              activeOpacity={0.85}
            >
              <Text style={styles.ctaSecondaryText}>{tStr('welcome_action_create_account')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.linkRow}
              onPress={() => navigation.navigate('Login', { forStaff: true })}
              activeOpacity={0.8}
            >
              <Text style={styles.linkText}>{tStr('welcome_login_staff_short')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.linkRow}
              onPress={() => navigation.navigate('RegistroOwner')}
              activeOpacity={0.8}
            >
              <Text style={styles.linkText}>{tStr('welcome_create_gym_coach_short')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {showDualChoice && (
          <View style={styles.ctaWrap}>
            <Text style={styles.dualHint}>{tStr('welcome_dual_subtitle')}</Text>
            <TouchableOpacity style={styles.ctaPrimary} onPress={onDualClient} activeOpacity={0.85}>
              <Text style={styles.ctaPrimaryText}>{tStr('welcome_dual_as_client')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ctaSecondary} onPress={onDualStaff} activeOpacity={0.85}>
              <Text style={styles.ctaSecondaryText}>{tStr('welcome_dual_as_staff')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {showContinueSession && (
          <View style={styles.ctaWrap}>
            {session?.user?.email ? (
              <Text style={styles.sessionEmail} numberOfLines={1}>
                {session.user.email}
              </Text>
            ) : null}
            <View style={styles.sessionActionsRow}>
              <TouchableOpacity style={styles.ctaPrimary} onPress={onContinue} activeOpacity={0.85}>
                <Text style={styles.ctaPrimaryText}>{tStr('welcome_action_continue')}</Text>
              </TouchableOpacity>
              {hasStaffMembership ? (
                <TouchableOpacity
                  style={styles.ctaSecondary}
                  onPress={async () => {
                    if (persistActiveAppMode && session?.user?.id) {
                      await persistActiveAppMode('staff', session.user.id);
                    }
                    navigateToDestination('staff');
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.ctaSecondaryText}>{tStr('welcome_dual_as_staff')}</Text>
                </TouchableOpacity>
              ) : null}
              {hasClientMembership ? (
                <TouchableOpacity
                  style={styles.ctaSecondary}
                  onPress={async () => {
                    if (persistActiveAppMode && session?.user?.id) {
                      await persistActiveAppMode('client', session.user.id);
                    }
                    navigateToDestination('client');
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.ctaSecondaryText}>{tStr('welcome_dual_as_client')}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            <TouchableOpacity style={styles.linkRow} onPress={onLogout} activeOpacity={0.8}>
              <Text style={styles.linkText}>{tStr('welcome_logout_use_other')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}
