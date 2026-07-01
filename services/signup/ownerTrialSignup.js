import { supabase } from '../../supabaseClient';
import { imageUriToArrayBuffer } from '../../utils/imageUriToArrayBuffer';

const BUCKET_ORG_LOGOS = 'org-logos';

function isStorageBucketMissingError(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  return /bucket not found/i.test(msg);
}

export async function uploadOrgLogo(orgId, uri) {
  if (!orgId || !uri) return null;
  const ext = (uri.split('.').pop() || 'jpg').split('?')[0];
  const safeExt = /^[a-z0-9]+$/i.test(ext) ? ext.toLowerCase() : 'jpg';
  const path = `${orgId}/logo.${safeExt}`;
  const contentType = safeExt === 'png' ? 'image/png' : 'image/jpeg';
  const body = await imageUriToArrayBuffer(uri);
  const { error: uploadError } = await supabase.storage
    .from(BUCKET_ORG_LOGOS)
    .upload(path, body, { contentType, upsert: true });
  if (uploadError) throw uploadError;
  const { data } = supabase.storage.from(BUCKET_ORG_LOGOS).getPublicUrl(path);
  return data?.publicUrl || null;
}

/**
 * Crea org + membership owner + trial 14d vía RPC.
 * @returns {{ organizationId: string, trialExpiresAt: string }}
 */
export async function completeOwnerTrialSignup({
  orgName,
  businessModel,
  country,
  city,
  sizeRange,
  accentColor,
  activityType,
  billingCurrency,
  timezone,
  logoLocalUri,
}) {
  const { data, error } = await supabase.rpc('signup_owner_with_trial', {
    p_org_name: orgName,
    p_business_model: businessModel,
    p_country: country,
    p_city: city,
    p_size_range: sizeRange,
    p_accent_color: accentColor || '#86C4C7',
    p_activity_type: activityType || null,
    p_billing_currency: billingCurrency || 'ARS',
    p_timezone: timezone || 'America/Argentina/Buenos_Aires',
  });
  if (error) throw error;
  const row = data && typeof data === 'object' ? data : {};
  const organizationId = row.organization_id;
  if (!organizationId) throw new Error('signup_owner_with_trial_missing_org');

  let storageSkipped = false;
  if (logoLocalUri) {
    try {
      const logoUrl = await uploadOrgLogo(organizationId, logoLocalUri);
      if (logoUrl) {
        const { error: logoErr } = await supabase
          .from('organizations')
          .update({ logo_url: logoUrl })
          .eq('id', organizationId);
        if (logoErr) throw logoErr;
      }
    } catch (e) {
      if (isStorageBucketMissingError(e)) {
        storageSkipped = true;
      } else {
        throw e;
      }
    }
  }

  return {
    organizationId,
    trialExpiresAt: row.trial_expires_at,
    subscriptionStatus: row.subscription_status,
    storageSkipped,
  };
}
