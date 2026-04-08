// Misma estética que WelcomeGlobal: elección cliente/staff cuando la cuenta es dual (flujo aparte, más prolijo).

import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocale } from '../contexts/LocaleContext';
import LogoCompleto from '../components/LogoCompleto';
import { useAuth } from '../contexts/AuthContext';
import { fitengineLogoColors as fe, fitengineUiTokens as fitT } from '../theme/colors';
import { createWelcomeGlobalLayoutStyles } from '../styles/welcomeGlobalLayoutStyles';
import { useWelcomeRouting } from '../hooks/useWelcomeRouting';

export default function WelcomeDualChoiceScreen() {
  const { t: tStr, locale, setLocale } = useLocale();
  const { session, authNavigationReady, logout } = useAuth() || {};

  const { onDualClient, onDualStaff } = useWelcomeRouting();

  const styles = useMemo(() => createWelcomeGlobalLayoutStyles(fitT, fe), []);

  const onLogout = async () => {
    try {
      if (logout) await logout();
    } catch (_) {}
  };

  if (!session?.user?.id) {
    return (
      <View style={[styles.container, styles.loadingBox, { justifyContent: 'center' }]}>
        <LogoCompleto height={120} />
        <ActivityIndicator size="large" color={fitT.logoCian} />
        <Text style={styles.subtitle}>{tStr('common_loading')}</Text>
      </View>
    );
  }

  if (session?.user?.id && !authNavigationReady) {
    return (
      <View style={[styles.container, styles.loadingBox, { justifyContent: 'center' }]}>
        <LogoCompleto height={120} />
        <ActivityIndicator size="large" color={fitT.logoCian} />
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

        {session?.user?.email ? (
          <Text style={styles.sessionEmail} numberOfLines={1}>
            {session.user.email}
          </Text>
        ) : null}

        <Text style={styles.dualHint}>{tStr('welcome_dual_subtitle')}</Text>

        <View style={styles.ctaWrap}>
          <TouchableOpacity style={styles.ctaPrimary} onPress={onDualClient} activeOpacity={0.85}>
            <Text style={styles.ctaPrimaryText}>{tStr('welcome_dual_as_client')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ctaSecondary} onPress={onDualStaff} activeOpacity={0.85}>
            <Text style={styles.ctaSecondaryText}>{tStr('welcome_dual_as_staff')}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.linkRow} onPress={onLogout} activeOpacity={0.8}>
          <Text style={styles.linkText}>{tStr('welcome_logout_use_other')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
