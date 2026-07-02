import { TRIAL_SIGNUP_QUERY } from './webAppLinking';

const TRIAL_OWNER_INTENT = 'gym_owner_trial';

/** Coach trial con cuenta pero sin gym persistido en perfil / memberships. */
export function isIncompleteTrialOwner({
  signupIntent,
  profileOrganizationId = null,
  ownedOrganizationsCount = 0,
  hasStaffMembership = false,
} = {}) {
  const intent = String(signupIntent || '').toLowerCase();
  if (intent !== TRIAL_OWNER_INTENT) return false;
  const orgIdHint = !!(profileOrganizationId && String(profileOrganizationId).trim());
  const hasStaffOrgHint =
    (ownedOrganizationsCount || 0) > 0 || hasStaffMembership === true || orgIdHint;
  return !hasStaffOrgHint;
}

export function readSignupIntent(session, user) {
  return (
    session?.user?.user_metadata?.signup_intent ||
    user?.user_metadata?.signup_intent ||
    ''
  );
}

export function trialSignupStackRoute() {
  return { name: 'TrialSignup', params: { trial: TRIAL_SIGNUP_QUERY } };
}
