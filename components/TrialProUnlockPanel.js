import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeContext } from '../contexts/ThemeContext';
import { useLocale } from '../contexts/LocaleContext';
import { TRIAL_PRO_FEATURE_META } from '../utils/trialProFeatures';
import { MOBILE_RADII, MOBILE_SPACING, MOBILE_TYPE } from '../theme/mobileSpec';

const PRO_MAILTO = 'mailto:ventas@fitengine.app?subject=FitEngine%20Pro';

export default function TrialProUnlockPanel({ featureKey, style }) {
  const { t } = useThemeContext();
  const { t: tStr } = useLocale();
  const meta = TRIAL_PRO_FEATURE_META[featureKey] || {};

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          marginTop: MOBILE_SPACING.lg,
          padding: MOBILE_SPACING.lg,
          borderRadius: MOBILE_RADII.lg,
          borderWidth: 1,
          borderColor: t.overlayBorder,
          backgroundColor: t.boxBg,
          alignItems: 'center',
        },
        icon: { marginBottom: MOBILE_SPACING.sm },
        title: {
          color: t.text,
          fontSize: MOBILE_TYPE.title,
          fontWeight: '800',
          textAlign: 'center',
          marginBottom: 8,
        },
        body: {
          color: t.subText,
          fontSize: MOBILE_TYPE.body,
          textAlign: 'center',
          lineHeight: 22,
          marginBottom: MOBILE_SPACING.sm,
        },
        promo: {
          color: t.brand,
          fontSize: MOBILE_TYPE.bodyStrong,
          fontWeight: '700',
          textAlign: 'center',
          marginBottom: MOBILE_SPACING.md,
        },
        btn: {
          backgroundColor: t.brand,
          borderRadius: MOBILE_RADII.md,
          paddingVertical: 12,
          paddingHorizontal: MOBILE_SPACING.lg,
        },
        btnText: { color: '#050a0d', fontWeight: '700', fontSize: MOBILE_TYPE.bodyStrong },
        badge: {
          marginTop: MOBILE_SPACING.sm,
          color: t.subText,
          fontSize: MOBILE_TYPE.caption,
        },
      }),
    [t],
  );

  return (
    <View style={[styles.wrap, style]}>
      <Ionicons name="lock-closed-outline" size={40} color={t.brand} style={styles.icon} />
      <Text style={styles.title}>{tStr(meta.titleKey || 'trial_pro_unlock_title')}</Text>
      <Text style={styles.body}>{tStr(meta.bodyKey || 'trial_pro_unlock_body')}</Text>
      <Text style={styles.promo}>{tStr('trial_pro_promo_line')}</Text>
      <TouchableOpacity
        style={styles.btn}
        activeOpacity={0.88}
        onPress={() => Linking.openURL(PRO_MAILTO).catch(() => {})}
      >
        <Text style={styles.btnText}>{tStr('trial_pro_cta_email')}</Text>
      </TouchableOpacity>
      <Text style={styles.badge}>{tStr('trial_pro_badge')}</Text>
    </View>
  );
}
