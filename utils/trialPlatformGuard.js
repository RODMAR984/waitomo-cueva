/** Trial SaaS de plataforma (no confundir con trial_class_grants). */

export function isTrialPlatformExpired(status) {
  return String(status || '').toLowerCase() === 'expired';
}

export function isTrialPlatformWriteBlocked(status, daysLeft) {
  const s = String(status || '').toLowerCase();
  if (s === 'expired' || s === 'canceled' || s === 'suspended') return true;
  if (s === 'trial' && typeof daysLeft === 'number' && daysLeft < 0) return true;
  return false;
}

export function trialDaysLeftFromExpiresAt(expiresAt) {
  if (!expiresAt) return null;
  const exp = new Date(expiresAt);
  if (Number.isNaN(exp.getTime())) return null;
  const now = new Date();
  return Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}
