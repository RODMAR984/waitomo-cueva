/** Features Pro bloqueadas durante trial SaaS (subscription_status === 'trial'). */

export const TRIAL_PRO_FEATURE_KEYS = {
  AI_ASSISTANT: 'ai_assistant',
  GYM_APPEARANCE: 'gym_appearance',
  MEMBERSHIP_FREEZE: 'membership_freeze',
  STATS_TOTAL: 'stats_total',
};

/** Tabs de GymConfig que requieren Pro (marca / apariencia completa). */
export const TRIAL_PRO_GYM_CONFIG_TABS = new Set(['appearance', 'branding', 'brand_ai']);

export const TRIAL_PRO_FEATURE_META = {
  [TRIAL_PRO_FEATURE_KEYS.AI_ASSISTANT]: {
    titleKey: 'trial_pro_ai_title',
    bodyKey: 'trial_pro_ai_body',
  },
  [TRIAL_PRO_FEATURE_KEYS.GYM_APPEARANCE]: {
    titleKey: 'trial_pro_appearance_title',
    bodyKey: 'trial_pro_appearance_body',
  },
  [TRIAL_PRO_FEATURE_KEYS.MEMBERSHIP_FREEZE]: {
    titleKey: 'trial_pro_freeze_title',
    bodyKey: 'trial_pro_freeze_body',
  },
  [TRIAL_PRO_FEATURE_KEYS.STATS_TOTAL]: {
    titleKey: 'trial_pro_stats_title',
    bodyKey: 'trial_pro_stats_body',
  },
};

export function isTrialProLocked(subscriptionStatus, { bypass = false } = {}) {
  if (bypass) return false;
  return String(subscriptionStatus || '').toLowerCase() === 'trial';
}
