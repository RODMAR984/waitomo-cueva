import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import { getFitEngineUrls } from './fitengineUrls';

const { webAppUrl, linksBaseUrl } = getFitEngineUrls();

export const TRIAL_SIGNUP_QUERY = '14d';

export function isTrialSignupQuery(trial) {
  const v = String(trial || '').trim().toLowerCase();
  return v === '14d' || v === '14';
}

/** ¿La URL web actual es /signup con trial válido? */
export function parseWebTrialSignupFromWindow() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  try {
    const url = new URL(window.location.href);
    const path = (url.pathname || '/').replace(/\/+$/, '') || '/';
    if (path !== '/signup' && !path.endsWith('/signup')) return null;
    const trial = url.searchParams.get('trial');
    if (!isTrialSignupQuery(trial)) return { redirectWelcome: true };
    return { trial: TRIAL_SIGNUP_QUERY };
  } catch {
    return null;
  }
}

export function buildTrialSignupUrl() {
  const base = (webAppUrl || linksBaseUrl || '').replace(/\/+$/, '');
  return `${base}/signup?trial=${TRIAL_SIGNUP_QUERY}`;
}

const prefixes = [
  Linking.createURL('/'),
  ...(webAppUrl ? [webAppUrl.replace(/\/+$/, '')] : []),
  ...(linksBaseUrl ? [linksBaseUrl.replace(/\/+$/, '')] : []),
].filter(Boolean);

/** React Navigation linking — /signup?trial=14d → TrialSignup */
export const webAppLinking = {
  prefixes,
  config: {
    screens: {
      TrialSignup: {
        path: 'signup',
        parse: {
          trial: (trial) => String(trial || ''),
        },
      },
      JoinWithInvite: 'join',
      Login: 'login',
      WelcomeGlobal: '',
    },
  },
};
