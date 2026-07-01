import { useCallback, useMemo } from 'react';
import { Alert, Linking } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useLocale } from '../contexts/LocaleContext';
import { isTrialProLocked, TRIAL_PRO_FEATURE_META } from '../utils/trialProFeatures';

const PRO_MAILTO = 'mailto:ventas@fitengine.app?subject=FitEngine%20Pro';

/** Candados Pro durante trial SaaS (no confundir con writeBlocked al vencer). */
export default function useTrialProGuard() {
  const { organization, isSuperAdmin, isPlatformAdmin } = useAuth() || {};
  const { t: tStr } = useLocale();

  const proLocked = useMemo(() => {
    const sa = typeof isSuperAdmin === 'function' && isSuperAdmin();
    const pa = typeof isPlatformAdmin === 'function' && isPlatformAdmin();
    return isTrialProLocked(organization?.subscription_status, { bypass: sa || pa });
  }, [organization?.subscription_status, isSuperAdmin, isPlatformAdmin]);

  const showProUnlock = useCallback(
    (featureKey) => {
      const meta = TRIAL_PRO_FEATURE_META[featureKey] || {};
      const title = tStr(meta.titleKey || 'trial_pro_unlock_title');
      const body = tStr(meta.bodyKey || 'trial_pro_unlock_body');
      const promo = tStr('trial_pro_promo_line');
      Alert.alert(title, `${body}\n\n${promo}`, [
        { text: tStr('common_cancel'), style: 'cancel' },
        {
          text: tStr('trial_pro_cta_email'),
          onPress: () => {
            Linking.openURL(PRO_MAILTO).catch(() => {});
          },
        },
      ]);
    },
    [tStr],
  );

  const guardPro = useCallback(
    (featureKey, fn) => {
      if (!proLocked) {
        if (typeof fn === 'function') fn();
        return true;
      }
      showProUnlock(featureKey);
      return false;
    },
    [proLocked, showProUnlock],
  );

  return { proLocked, guardPro, showProUnlock };
}
