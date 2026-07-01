import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocale } from '../contexts/LocaleContext';
import { useThemeContext } from '../contexts/ThemeContext';
import { useTrialStatus } from '../hooks/useTrialStatus';
import { MOBILE_RADII, MOBILE_SPACING, MOBILE_TYPE } from '../theme/mobileSpec';

function fmtTemplate(str, vars) {
  let s = String(str || '');
  Object.entries(vars || {}).forEach(([k, v]) => {
    s = s.split(`{{${k}}}`).join(String(v));
  });
  return s;
}

export default function TrialPlatformBanner({ organizationId }) {
  const { t: tStr } = useLocale();
  const { t } = useThemeContext();
  const { status, daysLeft, isExpired, isTrial, loading } = useTrialStatus(organizationId);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          marginHorizontal: MOBILE_SPACING.md,
          marginBottom: MOBILE_SPACING.sm,
          padding: MOBILE_SPACING.md,
          borderRadius: MOBILE_RADII.md,
          borderWidth: 1,
        },
        warn: {
          backgroundColor: 'rgba(245, 158, 11, 0.12)',
          borderColor: 'rgba(245, 158, 11, 0.45)',
        },
        danger: {
          backgroundColor: 'rgba(239, 68, 68, 0.14)',
          borderColor: 'rgba(239, 68, 68, 0.55)',
        },
        title: { color: t.text, fontWeight: '700', fontSize: MOBILE_TYPE.bodyStrong },
        body: { color: t.subText, fontSize: MOBILE_TYPE.body, marginTop: 4, lineHeight: 20 },
      }),
    [t],
  );

  if (!organizationId || loading) return null;
  if (!isTrial && !isExpired && status !== 'expired') return null;

  if (isExpired || status === 'expired') {
    return (
      <View style={[styles.wrap, styles.danger]} testID="trial-platform-banner-expired">
        <Text style={styles.title}>{tStr('trial_banner_expired_title')}</Text>
        <Text style={styles.body}>{tStr('trial_banner_expired_body')}</Text>
      </View>
    );
  }

  if (isTrial && daysLeft != null && daysLeft <= 3) {
    return (
      <View style={[styles.wrap, styles.warn]} testID="trial-platform-banner-ending">
        <Text style={styles.title}>{fmtTemplate(tStr('trial_banner_ending_title'), { days: daysLeft })}</Text>
        <Text style={styles.body}>{tStr('trial_banner_ending_body')}</Text>
      </View>
    );
  }

  if (isTrial && daysLeft != null) {
    return (
      <View style={[styles.wrap, styles.warn]} testID="trial-platform-banner-active">
        <Text style={styles.title}>{fmtTemplate(tStr('trial_banner_active_title'), { days: daysLeft })}</Text>
        <Text style={styles.body}>
          {tStr('trial_banner_active_body')}
          {' '}
          {tStr('trial_pro_banner_hint')}
        </Text>
      </View>
    );
  }

  return null;
}
