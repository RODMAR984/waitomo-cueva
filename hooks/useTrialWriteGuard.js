import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useLocale } from '../contexts/LocaleContext';
import { useTrialStatus } from './useTrialStatus';

/** Bloquea acciones de escritura en admin cuando el trial SaaS venció. */
export default function useTrialWriteGuard() {
  const { organization } = useAuth() || {};
  const { writeBlocked } = useTrialStatus(organization?.id);
  const { t: tStr } = useLocale();

  const guardWrite = useCallback(
    (fn) => {
      if (writeBlocked) {
        Alert.alert(tStr('trial_write_blocked_title'), tStr('trial_write_blocked_body'));
        return false;
      }
      if (typeof fn === 'function') fn();
      return true;
    },
    [writeBlocked, tStr],
  );

  return { writeBlocked, guardWrite };
}
