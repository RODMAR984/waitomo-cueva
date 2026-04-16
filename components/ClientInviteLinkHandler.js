import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import { setPendingClientInviteCode } from '../utils/pendingClientInviteStorage';

function extractCodeFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  try {
    const parsed = Linking.parse(url);
    const q = parsed.queryParams || {};
    if (q.code != null && String(q.code).trim()) return String(q.code).trim();
  } catch (_) {
    /* fall through */
  }
  try {
    const u = new URL(url);
    const code = u.searchParams.get('code');
    if (code) return code.trim();
  } catch (_) {
    /* no es URL absoluta (p. ej. waitomo://) */
  }
  const m = url.match(/[?&]code=([^&]+)/i);
  return m ? decodeURIComponent(m[1]).trim() : null;
}

/**
 * Guarda el código si el usuario abrió waitomo://join?code=... o https://fitengine.app/join?code=...
 * (mismo query). La aplicación del vínculo ocurre tras login en AuthContext.
 */
export default function ClientInviteLinkHandler() {
  useEffect(() => {
    const apply = (url) => {
      const c = extractCodeFromUrl(url);
      if (c) void setPendingClientInviteCode(c);
    };
    Linking.getInitialURL().then((url) => apply(url));
    const sub = Linking.addEventListener('url', ({ url }) => apply(url));
    return () => sub.remove();
  }, []);
  return null;
}
