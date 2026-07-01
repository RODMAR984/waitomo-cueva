import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { isTrialPlatformWriteBlocked, trialDaysLeftFromExpiresAt } from '../utils/trialPlatformGuard';

/**
 * Estado del trial SaaS de la organización activa.
 * Si el trial venció, actualiza subscription_status → expired (owner puede UPDATE su org).
 */
export function useTrialStatus(organizationId) {
  const [status, setStatus] = useState(null);
  const [daysLeft, setDaysLeft] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null);
  const [loading, setLoading] = useState(!!organizationId);

  const refresh = useCallback(async () => {
    if (!organizationId) {
      setStatus(null);
      setDaysLeft(null);
      setExpiresAt(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('subscription_status, trial_expires_at')
        .eq('id', organizationId)
        .maybeSingle();
      if (error || !data) {
        setStatus(null);
        setDaysLeft(null);
        setExpiresAt(null);
        return;
      }
      let nextStatus = data.subscription_status || null;
      const exp = data.trial_expires_at || null;
      setExpiresAt(exp);
      let left = trialDaysLeftFromExpiresAt(exp);
      if (nextStatus === 'trial' && exp && left != null && left < 0) {
        await supabase
          .from('organizations')
          .update({ subscription_status: 'expired' })
          .eq('id', organizationId);
        nextStatus = 'expired';
        left = 0;
      }
      setStatus(nextStatus);
      setDaysLeft(left);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      await refresh();
      if (!alive) return;
    })();
    return () => {
      alive = false;
    };
  }, [refresh]);

  const writeBlocked = isTrialPlatformWriteBlocked(status, daysLeft);

  return {
    status,
    daysLeft,
    expiresAt,
    loading,
    writeBlocked,
    refresh,
    isTrial: String(status || '').toLowerCase() === 'trial',
    isExpired: String(status || '').toLowerCase() === 'expired' || writeBlocked,
  };
}
