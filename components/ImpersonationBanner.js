import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useLocale } from '../contexts/LocaleContext';
import { useThemeContext } from '../contexts/ThemeContext';
import { MOBILE_RADII, MOBILE_SPACING, MOBILE_TYPE } from '../theme/mobileSpec';

/**
 * Aviso cuando un admin de plataforma usa “entrar como org” (contexto de app; RLS sigue siendo el usuario real).
 */
export default function ImpersonationBanner() {
  const { t } = useThemeContext();
  const { t: tStr } = useLocale();
  const { impersonatingOrgId, organization, stopImpersonation, isPlatformAdmin } = useAuth() || {};

  const allowed = typeof isPlatformAdmin === 'function' ? isPlatformAdmin() : false;
  const active = Boolean(impersonatingOrgId) && allowed;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          backgroundColor: t.brand,
          paddingVertical: MOBILE_SPACING.sm,
          paddingHorizontal: MOBILE_SPACING.md,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        },
        text: {
          color: '#fff',
          fontSize: MOBILE_TYPE.caption,
          fontWeight: '700',
          flex: 1,
        },
        btn: {
          paddingVertical: 6,
          paddingHorizontal: 12,
          borderRadius: MOBILE_RADII.sm,
          backgroundColor: 'rgba(255,255,255,0.22)',
        },
        btnLabel: { color: '#fff', fontSize: MOBILE_TYPE.meta, fontWeight: '800' },
      }),
    [t.brand],
  );

  if (!active) return null;

  const name = organization?.name || impersonatingOrgId;
  const bannerText = String(tStr('impersonation_banner')).replace(/\{name\}/g, String(name || '—'));

  return (
    <View style={styles.wrap} accessibilityRole="summary">
      <Text style={styles.text} numberOfLines={2}>
        {bannerText}
      </Text>
      <TouchableOpacity
        style={styles.btn}
        onPress={() => void stopImpersonation?.()}
        accessibilityRole="button"
        accessibilityLabel={tStr('impersonation_exit_a11y')}
      >
        <Text style={styles.btnLabel}>{tStr('impersonation_exit')}</Text>
      </TouchableOpacity>
    </View>
  );
}
