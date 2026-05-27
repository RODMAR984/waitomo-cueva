import * as WebBrowser from 'expo-web-browser';
import * as ExpoLinking from 'expo-linking';

/**
 * OAuth de pagos en web: popup/redirect controlado (no pestaña suelta con Linking.openURL).
 * @returns {Promise<{ status: string, reason?: string } | null>} null si canceló
 */
export async function runWebPaymentConnectOAuth(oauthUrl, returnUri) {
  WebBrowser.maybeCompleteAuthSession();
  const result = await WebBrowser.openAuthSessionAsync(oauthUrl, returnUri, {
    preferEphemeralSession: false,
  });
  if (result.type === 'cancel' || result.type === 'dismiss') {
    return null;
  }
  if (result.type !== 'success' || !result.url) {
    throw new Error('payment_connect_unknown_result');
  }
  const parsed = ExpoLinking.parse(result.url);
  return {
    status: String(parsed.queryParams?.status || '').trim() || 'error',
    reason: String(parsed.queryParams?.reason || '').trim() || undefined,
  };
}
