// Pantalla intermedia: antes de "Configura tu espacio" — dos caminos claros (FitEngine branding).
import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useLocale } from '../../contexts/LocaleContext';
import { supabase } from '../../supabaseClient';
import { fitengineLogoColors as fe } from '../../theme/colors';
import { WEB_CONTENT_MAX_WIDTH } from '../../theme/webSpec';
import { MOBILE_RADII, MOBILE_SPACING, MOBILE_TYPE } from '../../theme/mobileSpec';
import BackgroundWrapper from '../../components/BackgroundWrapper';
import LogoCompleto from '../../components/LogoCompleto';
import { AuthKeyboardAvoidingView, authScrollKeyboardDismissMode } from '../../components/AuthWebFormShell';

export default function FitEngineSpaceIntroScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { t } = useLocale();
  const { session } = useAuth() || {};
  const [busy, setBusy] = useState(false);

  const email = route?.params?.email || session?.user?.email || '';

  const goConfigure = useCallback(() => {
    navigation.replace('ConfiguraTuEspacio', {
      email: email || undefined,
      fullName: route?.params?.fullName,
    });
  }, [navigation, email, route?.params?.fullName]);

  const goLater = useCallback(async () => {
    setBusy(true);
    try {
      const prev = session?.user?.user_metadata || {};
      const { error } = await supabase.auth.updateUser({
        data: { ...prev, fitengine_defer_space_setup: true },
      });
      if (error) throw error;
      await supabase.auth.refreshSession();
      navigation.reset({ index: 0, routes: [{ name: 'AdminLite' }] });
    } catch (e) {
      console.log('🟠 FitEngineSpaceIntro defer:', e?.message || e);
      navigation.reset({ index: 0, routes: [{ name: 'AdminLite' }] });
    } finally {
      setBusy(false);
    }
  }, [navigation, session?.user?.user_metadata]);

  return (
    <BackgroundWrapper screen="fitenginespaceintro" style={styles.flex}>
      <SafeAreaView style={styles.flex} edges={['top', 'left', 'right']}>
        <AuthKeyboardAvoidingView style={styles.flex}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={authScrollKeyboardDismissMode}
          >
            <View style={styles.inner}>
              <LogoCompleto width={220} />
              <Text style={styles.title}>{t('fe_space_intro_title')}</Text>
              <Text style={styles.sub}>{t('fe_space_intro_subtitle')}</Text>

              <TouchableOpacity
                style={styles.cardPrimary}
                onPress={goConfigure}
                activeOpacity={0.85}
                disabled={busy}
              >
                <Text style={styles.cardPrimaryTitle}>{t('fe_space_intro_configure_now')}</Text>
                <Text style={styles.cardHint}>{t('fe_setup_subtitle')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cardSecondary}
                onPress={goLater}
                activeOpacity={0.85}
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator color={fe.text} />
                ) : (
                  <>
                    <Text style={styles.cardSecondaryTitle}>{t('fe_space_intro_configure_later')}</Text>
                    <Text style={styles.cardHint}>{t('fe_space_intro_later_hint')}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </AuthKeyboardAvoidingView>
      </SafeAreaView>
    </BackgroundWrapper>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: MOBILE_SPACING.lg,
    paddingBottom: MOBILE_SPACING.xl,
    paddingTop: MOBILE_SPACING.md,
    width: '100%',
    maxWidth: WEB_CONTENT_MAX_WIDTH,
    alignSelf: 'center',
  },
  inner: { alignItems: 'center' },
  title: {
    marginTop: MOBILE_SPACING.lg,
    color: fe.text,
    fontSize: MOBILE_TYPE.title,
    fontWeight: '800',
    textAlign: 'center',
  },
  sub: {
    marginTop: MOBILE_SPACING.sm,
    color: fe.subText,
    fontSize: MOBILE_TYPE.body,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: MOBILE_SPACING.lg,
  },
  cardPrimary: {
    width: '100%',
    borderRadius: MOBILE_RADII.lg,
    borderWidth: 1,
    borderColor: fe.panelBorder,
    backgroundColor: 'rgba(129, 140, 248, 0.18)',
    padding: MOBILE_SPACING.lg,
    marginBottom: MOBILE_SPACING.md,
  },
  cardPrimaryTitle: {
    color: fe.text,
    fontSize: MOBILE_TYPE.bodyStrong,
    fontWeight: '800',
    marginBottom: 6,
  },
  cardSecondary: {
    width: '100%',
    minHeight: 88,
    justifyContent: 'center',
    borderRadius: MOBILE_RADII.lg,
    borderWidth: 1,
    borderColor: fe.panelBorder,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    padding: MOBILE_SPACING.lg,
  },
  cardSecondaryTitle: {
    color: fe.text,
    fontSize: MOBILE_TYPE.bodyStrong,
    fontWeight: '700',
    marginBottom: 6,
  },
  cardHint: {
    color: fe.subText,
    fontSize: MOBILE_TYPE.caption,
    lineHeight: 18,
  },
});
