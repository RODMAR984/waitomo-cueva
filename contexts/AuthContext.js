// contexts/AuthContext.js — Waitomo (FIX definitivo)
// ✅ Logout REAL: borra el key canónico sb-<ref>-auth-token + variantes + barrido
// ✅ Plan canónico: activePlanId (desde profile.plan_actual) + persist AsyncStorage
// Mantiene todo tu comportamiento actual (ensureProfile, updateProfile REST, OAuth, etc.)

import React, {
  createContext,
  useContext,
  useState,
  useMemo,
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
} from 'react';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../supabaseClient';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import {
  readActiveAppMode,
  writeActiveAppMode,
  clearActiveAppMode,
} from '../utils/activeAppModeStorage';
import { imageUriToArrayBuffer } from '../utils/imageUriToArrayBuffer';
import {
  getPendingClientInviteCode,
  clearPendingClientInviteCode,
} from '../utils/pendingClientInviteStorage';
import { getOAuthRedirectUriForSupabase } from '../utils/fitengineUrls';
import { trackEvent } from '../utils/observability';
import { resetNavigationRootToWelcome } from '../navigationRef';

/** Dónde se inició OAuth en web: si Google vuelve a otro origen, redirigimos acá con el mismo ?code=. */
const WEB_OAUTH_START_REDIRECT_KEY = 'waitomo_oauth_web_redirect';

// No llamar aquí: al cargar la app "completa" una sesión pendiente y la siguiente openAuthSessionAsync
// devuelve esa URL al instante (sesión fantasma). Se llama solo dentro de signInWithProvider.

const AuthContext = createContext(null);
const DEV_USER_ID = 'dev-user-local-waitomo';

const STORAGE_KEYS = {
  PLAN_ACTUAL: 'waitomo_plan_actual',
  OAUTH_SIGNUP_STAFF: 'waitomo_oauth_signup_staff',
};

const impersonateOrgStorageKey = (userId) =>
  userId ? `waitomo_impersonate_org_v1:${String(userId)}` : null;

// Columnas profiles (incluye preferencias: theme_mode, notif_*; Fase 2: organization_id)
const PROFILE_COLS =
  'id,created_at,role,username,full_name,phone,plan_actual,edad,peso,objetivos,lesiones,avatar_url,apto_medico_url,apto_medico_uploaded_at,apto_medico_expires_at,observaciones,sexo,theme_mode,notif_messages,notif_trabajo_dia,notif_novedades,notif_plan_pago,organization_id';

/**
 * Cuentas creadas antes del signUp con role: coach + signup_intent: quedaron con profiles.role = cliente.
 * Si auth.user_metadata ya indica staff y el perfil sigue en cliente, alineamos con PATCH (una vez por sync).
 */
async function healProfileRoleFromUserMetadata(userId, accessToken, row, userMetadata) {
  if (!userId || !accessToken || !row?.id) return row;
  const meta = userMetadata || {};
  const mr = String(meta.role || '').toLowerCase();
  const intent = String(meta.signup_intent || '').toLowerCase();
  const wantsStaff =
    intent === 'gym_owner' ||
    intent === 'gym' ||
    mr === 'coach' ||
    mr === 'admin' ||
    mr === 'superadmin';
  if (!wantsStaff) return row;
  if (String(row.role || '').toLowerCase() !== 'cliente') return row;

  const url = `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({ role: 'coach' }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    console.log('🟠 healProfileRoleFromUserMetadata PATCH', res.status, t.slice(0, 200));
    return row;
  }
  const json = await res.json().catch(() => null);
  const patched = Array.isArray(json) ? json[0] : json;
  if (patched?.id) {
    // eslint-disable-next-line no-console
    console.log('ROUTING_DEBUG healProfileRole: cliente → coach (user_metadata staff)');
    return { ...row, ...patched, role: patched.role || 'coach' };
  }
  return { ...row, role: 'coach' };
}

// -------------------------
// Helpers: project ref + keys reales supabase
// -------------------------
const getProjectRef = () => {
  try {
    const host = new URL(SUPABASE_URL).hostname; // nfjj...supabase.co
    return String(host).split('.')[0];
  } catch {
    // fallback por si URL no parsea
    const s = String(SUPABASE_URL || '');
    const m = s.match(/https?:\/\/([a-z0-9-]+)\.supabase\.co/i);
    return m?.[1] || null;
  }
};

// Base64url decode compatible con RN (atob puede no existir en Hermes).
const base64UrlDecode = (str) => {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  if (pad) base64 += '===='.slice(0, 4 - pad);
  if (typeof atob !== 'undefined') return atob(base64);
  if (typeof Buffer !== 'undefined') return Buffer.from(base64, 'base64').toString('utf8');
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < base64.length; i += 4) {
    const a = chars.indexOf(base64[i]);
    const b = chars.indexOf(base64[i + 1]);
    const c = chars.indexOf(base64[i + 2]);
    const d = chars.indexOf(base64[i + 3]);
    if (a < 0 || b < 0) break;
    const n = (a << 18) | (b << 12) | (c >= 0 ? c << 6 : 0) | (d >= 0 ? d : 0);
    out += String.fromCharCode((n >> 16) & 255);
    if (c >= 0) out += String.fromCharCode((n >> 8) & 255);
    if (d >= 0) out += String.fromCharCode(n & 255);
  }
  return out;
};

// Decodifica el payload de un JWT (solo lectura) para obtener sub, email, etc.
const decodeJwtPayload = (token) => {
  try {
    const parts = String(token || '').split('.');
    if (parts.length !== 3) return null;
    const decoded = base64UrlDecode(parts[1]);
    return decoded ? JSON.parse(decoded) : null;
  } catch {
    return null;
  }
};

const getLikelyAuthKeys = () => {
  const ref = getProjectRef();
  const keys = [];
  if (ref) {
    // ✅ key canónico en supabase-js v2
    keys.push(`sb-${ref}-auth-token`);
    // variantes vistas en algunos entornos
    keys.push(`sb-${ref}-auth-token-code-verifier`);
    keys.push(`sb-${ref}-auth-token-expires-at`);
    keys.push(`sb-${ref}-auth-token-refresh-token`);
    keys.push(`sb-${ref}-auth-token-access-token`);
  }
  // además, keys legacy comunes
  keys.push('supabase.auth.token');
  keys.push('supabase.auth.refreshToken');
  return keys;
};

const isOAuthCallbackUrl = (url) => {
  if (!url || typeof url !== 'string') return false;
  const u = url.trim();
  if (!u.startsWith('waitomo://') && !u.startsWith('exp://')) return false;
  if (/[?&]code=/.test(u)) return true;
  return u.includes('#') && (u.includes('access_token') || u.includes('code='));
};

const getWebOAuthSessionFromHash = () => {
  if (Platform.OS !== 'web') return null;
  if (typeof window === 'undefined') return null;
  const hash = String(window.location?.hash || '');
  if (!hash || !hash.includes('access_token=')) return null;
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  const p = new URLSearchParams(raw);
  const access_token = String(p.get('access_token') || '').trim();
  const refresh_token = String(p.get('refresh_token') || '').trim();
  if (!access_token || !refresh_token) return null;
  return { access_token, refresh_token };
};

const getWebOAuthCodeFromQuery = () => {
  if (Platform.OS !== 'web') return '';
  if (typeof window === 'undefined') return '';
  const readCode = (raw) => {
    const s = String(raw || '').trim();
    if (!s) return '';
    const q = s.startsWith('?') || s.startsWith('#') ? s.slice(1) : s;
    try {
      return String(new URLSearchParams(q).get('code') || '').trim();
    } catch {
      return '';
    }
  };
  const fromSearch = readCode(window.location?.search || '');
  if (fromSearch) return fromSearch;
  return readCode(window.location?.hash || '');
};

// -------------------------
// Limpieza storage auth (definitiva)
// -------------------------
/** En web: barre localStorage/sessionStorage de tokens Supabase y restos OAuth (evita “se volvió a entrar”). */
function clearWebBrowserSupabaseAuthStorage() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  const ref = getProjectRef();
  const exactKey = ref ? `sb-${ref}-auth-token` : null;
  const shouldRemove = (k) => {
    const s = String(k || '').toLowerCase();
    return (
      (!!exactKey && k === exactKey) ||
      /^sb-[\w-]+-auth-token/.test(String(k || '')) ||
      s.includes('auth-token') ||
      (s.includes('sb-') && s.includes('auth')) ||
      (s.includes('supabase') && s.includes('auth'))
    );
  };
  for (const storage of [window.localStorage, window.sessionStorage]) {
    if (!storage || typeof storage.length !== 'number') continue;
    const toRemove = [];
    for (let i = 0; i < storage.length; i += 1) {
      const k = storage.key(i);
      if (k && shouldRemove(k)) toRemove.push(k);
    }
    toRemove.forEach((k) => {
      try {
        storage.removeItem(k);
      } catch (_) {
        /* ignore */
      }
    });
  }
}

/** Web: claves auxiliares que no son el token SB pero pueden rehidratar OAuth o confundir el bootstrap. */
function clearWebLogoutSidecarStorage() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    window.sessionStorage?.removeItem?.(WEB_OAUTH_START_REDIRECT_KEY);
    window.localStorage?.removeItem?.(WEB_OAUTH_START_REDIRECT_KEY);
  } catch (_) {
    /* ignore */
  }
}

const clearSupabaseAuthStorage = async () => {
  clearWebBrowserSupabaseAuthStorage();
  clearWebLogoutSidecarStorage();
  try {
    const ref = getProjectRef();
    const exactKey = ref ? `sb-${ref}-auth-token` : null;
    const allKeys = await AsyncStorage.getAllKeys();
    const explicit = new Set(getLikelyAuthKeys());
    if (exactKey) explicit.add(exactKey);

    const candidates = allKeys.filter((k) => {
      const s = String(k || '').toLowerCase();
      if (explicit.has(k)) return true;
      return (
        s.includes('auth-token') ||
        (s.includes('sb-') && s.includes('auth')) ||
        (s.includes('supabase') && s.includes('auth')) ||
        s.includes('supabase.auth')
      );
    });

    const sidecars = allKeys.filter((k) => {
      const s = String(k || '');
      return (
        s === STORAGE_KEYS.OAUTH_SIGNUP_STAFF ||
        s === STORAGE_KEYS.PLAN_ACTUAL ||
        s.startsWith('waitomo_impersonate_org_v1:') ||
        s.startsWith('waitomo_active_app_mode:')
      );
    });

    const toRemove = [...new Set([...candidates, ...sidecars])];

    if (toRemove.length) {
      await AsyncStorage.multiRemove(toRemove);
      console.log('🧹 clearSupabaseAuthStorage: removed', toRemove.length, 'keys');
    } else {
      if (exactKey) {
        try {
          await AsyncStorage.removeItem(exactKey);
          console.log('🧹 clearSupabaseAuthStorage: removed exact key', exactKey);
        } catch (_) {}
      } else {
        console.log('🧹 clearSupabaseAuthStorage: no keys found');
      }
    }
  } catch (e) {
    console.log('🟠 clearSupabaseAuthStorage error:', e?.message || e);
  }
};

const setPlanActualStorage = async (planId) => {
  try {
    if (planId) await AsyncStorage.setItem(STORAGE_KEYS.PLAN_ACTUAL, String(planId));
    else await AsyncStorage.removeItem(STORAGE_KEYS.PLAN_ACTUAL);
  } catch (e) {
    console.log('🟠 setPlanActualStorage error:', e?.message || e);
  }
};

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const profileRef = useRef(null);
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);
  const [organization, setOrganization] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(false);
  const [userPlans, setUserPlans] = useState([]);
  const [activePlanId, setActivePlanId] = useState(null);
  /** Orgs donde auth.uid() es owner (coach / gym propio). RLS: policy "Owners read...". */
  const [ownedOrganizations, setOwnedOrganizations] = useState([]);
  /** Memberships activas (user + organization + role) para routing serio multi-org. */
  const [organizationMemberships, setOrganizationMemberships] = useState([]);
  const [ownedOrgsLoading, setOwnedOrgsLoading] = useState(false);
  /** Incrementar tras join por código para forzar refetch de organization_memberships (evita UI “sin org”). */
  const [membershipsFetchKey, setMembershipsFetchKey] = useState(0);
  /** Misma persona cliente en un gym + coach en otra org: modo activo en el dispositivo. */
  const [activeAppMode, setActiveAppModeState] = useState(null);
  /** false con sesión hasta leer AsyncStorage (evita ir a ClientTabs antes de tiempo). */
  const [activeAppModeHydrated, setActiveAppModeHydrated] = useState(true);
  /**
   * true = ya terminó el primer sync de perfil para la sesión actual (o no hay usuario).
   * Evita que pantallas interpreten `profile===null` como "sin cuenta" mientras el fetch sigue en vuelo.
   */
  const [initialProfileSyncDone, setInitialProfileSyncDone] = useState(true);
  /**
   * false hasta que termine el primer `restore()` de sesión (getSession / OAuth URL).
   * Evita mostrar el welcome de invitado unos segundos con `session` aún null (parece “usuario vacío”).
   */
  const [authSessionRestored, setAuthSessionRestored] = useState(false);
  /**
   * Admin de plataforma vía tabla `platform_admins` (migración 20260510120000).
   * null = sin dato aún, error de red, o tabla no desplegada; true/false = resultado del SELECT.
   */
  const [platformAdminActive, setPlatformAdminActive] = useState(null);
  /** Misma semántica que `platformAdminActive` pero se actualiza antes del `setState` (login/routing mismo tick). */
  const platformAdminActiveRef = useRef(null);

  /** Fase 5: vista staff como otra org (solo plataforma; RLS sigue siendo el usuario real). */
  const [impersonatingOrgId, setImpersonatingOrgId] = useState(null);
  const impersonatingOrgIdRef = useRef(null);

  const ensureProfileInFlightRef = useRef(new Map());
  const lastFetchedUserIdRef = useRef(null);
  /** Evita solapar varios fetchProfile por onAuthStateChange + restore a la vez. */
  const profileSyncInFlightRef = useRef(null);
  /** Evita spamear consola con el mismo "omitido en curso" en cada callback duplicado. */
  const profileSyncConcurrentSkipLoggedRef = useRef(false);
  const lastAvatarCleanupUserIdRef = useRef(null);
  const justLoggedOutAtRef = useRef(null);
  /** URL inicial OAuth (waitomo://#...) con la que se abrió la app; si luego openAuthSessionAsync devuelve esta misma URL, la rechazamos como sesión fantasma */
  const staleInitialOAuthUrlRef = useRef(null);
  /** Watchdog de membresías: solo se reinicia al cambiar `session.user.id`, no al actualizar `profile.organization_id`. */
  const ownedOrgsWallTimerRef = useRef(null);
  const ownedOrgsWallTimerUserRef = useRef(null);
  const LOGOUT_IGNORE_MS = 8000;

  // -------------------------
  // FETCH PROFILE (REST) ✅ TOKEN OVERRIDE
  // -------------------------
  const fetchProfile = async (userOrId, accessTokenOverride = null) => {
    const userId =
      typeof userOrId === 'string'
        ? userOrId
        : userOrId?.id || session?.user?.id || null;

    if (!userId) {
      console.log('🧠 fetchProfileREST: sin userId');
      return null;
    }

    const START = Date.now();
    const REQUEST_TIMEOUT_MS = 8000;
    const PROFILE_FETCH_ATTEMPTS = 2;
    const PROFILE_RETRY_DELAY_MS = 500;

    const accessToken = accessTokenOverride || session?.access_token || null;

    const cols = PROFILE_COLS;

    const withAbort = async (fn, label) => {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      try {
        const out = await fn(controller.signal);
        const ms = Date.now() - START;
        console.log(`🧠 fetchProfileREST:${label} OK (${ms}ms)`);
        return out;
      } catch (e) {
        const ms = Date.now() - START;
        const msg = String(e?.message || e || '');
        console.log(`❌ fetchProfileREST:${label} FAIL (${ms}ms):`, msg);
        throw e;
      } finally {
        clearTimeout(t);
      }
    };

    const baseHeaders = {
      apikey: SUPABASE_ANON_KEY,
      Accept: 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    };

    const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));

    // 1) SELECT (1 reintento con backoff si red/5xx/429 — evita RegistroInicial fantasma en mobile lento)
    try {
      console.log('🧠 fetchProfileREST: SELECT start', {
        userId,
        hasToken: !!accessToken,
        tokenLen: accessToken ? String(accessToken).length : 0,
      });

      const url =
        `${SUPABASE_URL}/rest/v1/profiles` +
        `?id=eq.${encodeURIComponent(userId)}` +
        `&select=${encodeURIComponent(cols)}` +
        `&limit=1`;

      let res;
      let text = '';
      let attempt = 0;
      while (attempt < PROFILE_FETCH_ATTEMPTS) {
        try {
          res = await withAbort(
            (signal) =>
              fetch(url, {
                method: 'GET',
                headers: { ...baseHeaders },
                signal,
              }),
            'select_http'
          );
          text = await res.text();
          break;
        } catch (e) {
          attempt += 1;
          if (attempt >= PROFILE_FETCH_ATTEMPTS) {
            console.log('❌ fetchProfileREST SELECT catch:', e?.message || e, e);
            return null;
          }
          console.log('🟠 fetchProfileREST: reintento tras error red/abort', e?.message || e);
          await sleepMs(PROFILE_RETRY_DELAY_MS);
        }
      }

      let json = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }

      if (!res.ok) {
        const retryable = res.status >= 500 || res.status === 429;
        if (retryable) {
          console.log('🟠 fetchProfileREST: reintento tras HTTP', res.status);
          await sleepMs(PROFILE_RETRY_DELAY_MS);
          try {
            res = await withAbort(
              (signal) =>
                fetch(url, {
                  method: 'GET',
                  headers: { ...baseHeaders },
                  signal,
                }),
              'select_http_retry'
            );
            text = await res.text();
            try {
              json = text ? JSON.parse(text) : null;
            } catch {
              json = null;
            }
          } catch (e2) {
            console.log('❌ fetchProfileREST retry catch:', e2?.message || e2);
            return null;
          }
        }
        if (!res.ok) {
          console.log('❌ fetchProfileREST SELECT http error:', {
            status: res.status,
            body: (text || '').slice(0, 300),
          });
          return null;
        }
      }

      let row = Array.isArray(json) ? json[0] : null;

      if (row?.id) {
        const avatarRaw = row?.avatar_url;
        if (avatarRaw && String(avatarRaw).startsWith('file://')) {
          row = { ...row, avatar_url: null };
          if (lastAvatarCleanupUserIdRef.current !== userId) {
            lastAvatarCleanupUserIdRef.current = userId;
            fetch(
              `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`,
              {
                method: 'PATCH',
                headers: {
                  apikey: SUPABASE_ANON_KEY,
                  Authorization: `Bearer ${accessToken}`,
                  'Content-Type': 'application/json',
                  Prefer: 'return=minimal',
                },
                body: JSON.stringify({ avatar_url: null }),
              }
            ).catch(() => {});
          }
        }

        // Si entró por staff + Google: solo marcar coach si la cuenta NO es ya cliente (no sobrescribir cliente → coach)
        const staffOAuth = await AsyncStorage.getItem(STORAGE_KEYS.OAUTH_SIGNUP_STAFF);
        if (staffOAuth && row?.role !== 'cliente' && row?.role !== 'coach' && row?.role !== 'admin' && row?.role !== 'superadmin') {
          await AsyncStorage.removeItem(STORAGE_KEYS.OAUTH_SIGNUP_STAFF);
          try {
            const patchRes = await fetch(
              `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`,
              {
                method: 'PATCH',
                headers: {
                  ...baseHeaders,
                  'Content-Type': 'application/json',
                  Prefer: 'return=representation',
                },
                body: JSON.stringify({ role: 'coach' }),
              }
            );
            const patchJson = await patchRes.json().catch(() => null);
            const updated = Array.isArray(patchJson) ? patchJson[0] : null;
            if (updated?.role === 'coach') {
              row = { ...row, role: 'coach' };
            }
          } catch (e) {
            console.log('🟠 fetchProfileREST: PATCH role coach (staff OAuth) falló:', e?.message || e);
          }
        }

        console.log('✅ fetchProfileREST: EXISTE profile', row.id);
        setProfile(row);
        setRole(row?.role || null);

        const pAct = row?.plan_actual ? String(row.plan_actual) : null;
        setActivePlanId(pAct);
        await setPlanActualStorage(pAct);

        // Organización: se resuelve en useEffect (dual hat + activeAppMode + organization_id)
        return row;
      }

      // No hay fila: no crear aquí. Devolver null; ensureProfile (solo si el usuario sigue en Auth) crea el perfil.
      console.log('🟠 fetchProfileREST: NO existe profile → return null (no UPSERT aquí)');
      return null;
    } catch (e) {
      console.log('❌ fetchProfileREST SELECT catch:', e?.message || e, e);
      return null;
    }
  };

  // -------------------------
  // Fase 2: fetch organization (por organization_id del profile)
  // -------------------------
  const fetchOrganization = useCallback(async (orgId) => {
    if (!orgId) return null;
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select(
          'id,name,type,logo_url,accent_color,theme_preset,background_type,background_url,owner_id,active,plan_fitengine,features,created_at,client_invite_code,membership_freeze_enabled,membership_freeze_max_days,stripe_connect_account_id,stripe_checkout_enabled,mercadopago_checkout_enabled,mercadopago_oauth_linked,public_directory_enabled,google_place_id,google_place_summary'
        )
        .eq('id', orgId)
        .maybeSingle();
      if (error) {
        console.log('❌ fetchOrganization error:', error?.message || error);
        return null;
      }
      return data || null;
    } catch (e) {
      console.log('❌ fetchOrganization exception:', e?.message || e);
      return null;
    }
  }, []);

  const staffRoles = useMemo(() => new Set(['owner', 'coach', 'admin', 'superadmin']), []);
  const hasStaffMembership = useMemo(
    () => (organizationMemberships || []).some((m) => m?.active && staffRoles.has(m?.role)),
    [organizationMemberships, staffRoles]
  );
  const hasClientMembership = useMemo(
    () => (organizationMemberships || []).some((m) => m?.active && m?.role === 'cliente'),
    [organizationMemberships]
  );

  /**
   * Orgs donde vos sos el dueño (FitEngine propio). NO incluye ser coach/cliente en otro club.
   * Importante: el SELECT de memberships hace embed `organization:organizations(...)`. Si RLS devuelve
   * `organization: null` pero la fila tiene `role = owner`, antes se descartaba todo (`!org?.id`) y
   * `organizationsOwnedByUser` quedaba vacío → tema / routing equivocados aunque el perfil tenga
   * `organization_id` correcto (carreras) o con membresía Waitomo+propia mal ordenada.
   */
  const organizationsOwnedByUser = useMemo(() => {
    const uid = session?.user?.id;
    if (!uid || !Array.isArray(organizationMemberships)) return [];
    const out = [];
    const seen = new Set();
    for (const m of organizationMemberships) {
      if (!m?.active) continue;
      const oid = m.organization_id && String(m.organization_id).trim();
      if (!oid || seen.has(oid)) continue;
      const org = m.organization;
      const isOwnerMembership = String(m.role || '').toLowerCase() === 'owner';
      const isOwnerByEmbed =
        !!org?.id && String(org.owner_id || '').trim() && String(org.owner_id) === String(uid);
      if (!isOwnerMembership && !isOwnerByEmbed) continue;
      seen.add(oid);
      if (org?.id) {
        out.push(org);
      } else {
        // Stub mínimo: `resolveEffectiveOrganizationId` y fetchOrganization(orgId) siguen teniendo id.
        out.push({
          id: oid,
          owner_id: uid,
          name: '',
          type: null,
          active: true,
        });
      }
    }
    return out;
  }, [session?.user?.id, organizationMemberships]);

  const isDualHatUser = useMemo(() => {
    if (!session?.user?.id || !profile?.organization_id) return false;
    if (!organizationsOwnedByUser?.length) return false;
    const profileOrgId = profile.organization_id;
    return organizationsOwnedByUser.some((o) => o.id !== profileOrgId);
  }, [session?.user?.id, profile?.organization_id, organizationsOwnedByUser]);

  /**
   * Coach/admin: panel FitEngine solo si aún no tenés **ningún** vínculo staff a un gym (ni propio ni ajeno).
   * Antes solo mirábamos `organizationsOwnedByUser` (orgs donde sos owner vía membership); una coach empleada
   * en un club ajeno quedaba vacío → `needsFitEngineSpaceSetup === true` → **ConfiguraTuEspacio** por error.
   * Excepción explícita (metadata): empleado solo en gym ajeno → no forzar ConfiguraTuEspacio.
   */
  const needsFitEngineSpaceSetup = useMemo(() => {
    const r = String(role || '').toLowerCase();
    if (r !== 'coach' && r !== 'admin') return false;
    // Fuente de verdad en DB: si el perfil ya apunta a un centro, no es “pendiente de crear espacio”
    // (evita carrera donde memberships/embed aún no cargaron y ownedOrgs queda vacío).
    if (profile?.organization_id && String(profile.organization_id).trim()) return false;
    if (organizationsOwnedByUser?.length > 0) return false;
    // Ya sos staff (coach/admin/owner) en al menos un centro → no es el flujo “crear mi espacio FitEngine”.
    if (hasStaffMembership) return false;
    const meta = session?.user?.user_metadata || {};
    if (meta.fitengine_defer_space_setup === true) return false;
    if (meta.fitengine_staff_only === true) return false;
    const intent = String(meta.signup_intent || '').toLowerCase();
    if (intent === 'staff_employee' || intent === 'gym_employee') return false;
    return true;
  }, [
    role,
    profile?.organization_id,
    organizationsOwnedByUser,
    hasStaffMembership,
    session?.user?.user_metadata,
  ]);

  const resolveEffectiveOrganizationId = useCallback(() => {
    if (!session?.user?.id) return null;
    const r = String(role || '').toLowerCase();
    const isPlatformAdminUser =
      r === 'superadmin' ||
      platformAdminActiveRef.current === true ||
      platformAdminActive === true;
    const imp = String(impersonatingOrgIdRef.current || '').trim();
    if (imp && isPlatformAdminUser) return imp;

    const owned = organizationsOwnedByUser || [];
    const profOrg =
      profile?.organization_id && String(profile.organization_id).trim()
        ? String(profile.organization_id).trim()
        : null;

    // Sin sombrero dual: un solo gym donde sos dueña/o → siempre ese (evita org “equivocada” por RLS / orden / estado).
    if (!isDualHatUser) {
      if (owned.length === 1) return owned[0].id;
      if (owned.length > 1) {
        if (profOrg && owned.some((o) => String(o.id) === profOrg)) return profOrg;
        return owned[0]?.id || null;
      }
      return profOrg || null;
    }

    if (!activeAppMode) return null;
    if (activeAppMode === 'client') return profOrg || null;
    const primaryOwned =
      owned.find((o) => o.id !== profile.organization_id) || owned[0];
    return primaryOwned?.id || profOrg || null;
  }, [
    session?.user?.id,
    role,
    platformAdminActive,
    impersonatingOrgId,
    profile?.organization_id,
    organizationsOwnedByUser,
    activeAppMode,
    isDualHatUser,
  ]);

  useEffect(() => {
    let cancelled = false;
    async function applyOrg() {
      const orgId = resolveEffectiveOrganizationId();
      if (!orgId) {
        if (!cancelled) setOrganization(null);
        return;
      }
      const org = await fetchOrganization(orgId);
      if (cancelled) return;
      if (org) setOrganization(org);
      else setOrganization(null);
    }
    applyOrg();
    return () => {
      cancelled = true;
    };
  }, [resolveEffectiveOrganizationId, fetchOrganization]);

  /** Restaurar impersonación persistida (solo admins de plataforma). */
  useEffect(() => {
    if (!session?.user?.id) {
      impersonatingOrgIdRef.current = null;
      setImpersonatingOrgId(null);
      return;
    }
    const r = String(role || '').toLowerCase();
    // Solo superadmin o platform admin explícito — si `platformAdminActive === false`, antes igual
    // entrábamos al async (el guard solo cortaba `=== null`) y coaches podían heredar estado raro.
    const allowImpersonationRestore =
      r === 'superadmin' ||
      platformAdminActiveRef.current === true ||
      platformAdminActive === true;
    if (!allowImpersonationRestore) return;

    let cancelled = false;
    (async () => {
      try {
        const key = impersonateOrgStorageKey(session.user.id);
        if (!key) return;
        const raw = await AsyncStorage.getItem(key);
        const oid = String(raw || '').trim();
        if (!oid) return;
        const isPa =
          r === 'superadmin' ||
          platformAdminActiveRef.current === true ||
          platformAdminActive === true;
        if (!isPa) {
          await AsyncStorage.removeItem(key);
          return;
        }
        const org = await fetchOrganization(oid);
        if (cancelled) return;
        if (!org?.id) {
          await AsyncStorage.removeItem(key);
          return;
        }
        impersonatingOrgIdRef.current = oid;
        setImpersonatingOrgId(oid);
        setOrganization(org);
      } catch (e) {
        console.log('🟠 impersonation restore:', e?.message || e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, role, platformAdminActive, fetchOrganization]);

  // Antes del primer paint con sesión: marcar carga de orgs propias (si no, WelcomeGlobal navega con owned=[]).
  useLayoutEffect(() => {
    if (session?.user?.id) {
      setOwnedOrgsLoading(true);
      setActiveAppModeHydrated(false);
    } else {
      setOwnedOrgsLoading(false);
      setActiveAppModeHydrated(true);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    if (!session?.user?.id) {
      if (ownedOrgsWallTimerRef.current) {
        clearTimeout(ownedOrgsWallTimerRef.current);
        ownedOrgsWallTimerRef.current = null;
      }
      ownedOrgsWallTimerUserRef.current = null;
      setOwnedOrganizations([]);
      setOrganizationMemberships([]);
      setOwnedOrgsLoading(false);
      return;
    }
    const uid = session.user.id;
    if (ownedOrgsWallTimerUserRef.current !== uid) {
      if (ownedOrgsWallTimerRef.current) clearTimeout(ownedOrgsWallTimerRef.current);
      ownedOrgsWallTimerUserRef.current = uid;
      ownedOrgsWallTimerRef.current = setTimeout(() => {
        console.log(
          '🟠 organization_memberships: watchdog 20s (por usuario) → ownedOrgsLoading=false',
        );
        setOwnedOrgsLoading(false);
        ownedOrgsWallTimerRef.current = null;
      }, 20000);
    }

    let cancelled = false;
    setOwnedOrgsLoading(true);
    (async () => {
      try {
        // Ruta principal (modelo serio): memberships por usuario
        const { data: memberships, error: membershipsError } = await supabase
          .from('organization_memberships')
          .select(
            'id,organization_id,role,active,is_default,organization:organizations(id,name,type,logo_url,accent_color,theme_preset,background_type,background_url,owner_id,active,plan_fitengine,features,created_at,membership_freeze_enabled,membership_freeze_max_days,stripe_connect_account_id,stripe_checkout_enabled,mercadopago_checkout_enabled,mercadopago_oauth_linked,public_directory_enabled,google_place_id,google_place_summary)'
          )
          .eq('user_id', session.user.id)
          .eq('active', true);

        if (!membershipsError && Array.isArray(memberships)) {
          const mapped = memberships
            .filter((m) => !!m?.organization_id)
            .map((m) => ({
              id: m.id,
              organization_id: m.organization_id,
              role: m.role,
              active: !!m.active,
              is_default: !!m.is_default,
              organization: m.organization || null,
            }));

          // Si ya hay filas en memberships (p. ej. solo "cliente"), antes se hacía return y NUNCA corría el
          // fallback por owner_id → dueño de gym con registro incompleto quedaba como cliente puro.
          const { data: ownerOrgRows, error: ownerOrgErr } = await supabase
            .from('organizations')
            .select(
              'id,name,type,logo_url,accent_color,theme_preset,background_type,background_url,owner_id,active,plan_fitengine,features,created_at,membership_freeze_enabled,membership_freeze_max_days,stripe_connect_account_id,stripe_checkout_enabled,mercadopago_checkout_enabled,mercadopago_oauth_linked,public_directory_enabled,google_place_id,google_place_summary'
            )
            .eq('owner_id', session.user.id);
          if (!ownerOrgErr && Array.isArray(ownerOrgRows)) {
            for (const org of ownerOrgRows) {
              if (!org?.id) continue;
              const alreadyStaffForOrg = mapped.some(
                (m) => m.organization_id === org.id && staffRoles.has(m.role)
              );
              if (!alreadyStaffForOrg) {
                mapped.push({
                  id: null,
                  organization_id: org.id,
                  role: 'owner',
                  active: true,
                  is_default: false,
                  organization: org,
                });
              }
            }
          }

          if (!cancelled) setOrganizationMemberships(mapped);

          // Si RLS u otra causa deja `organization` null en el embed pero la membresía existe,
          // igual contamos el centro para routing (evita ownedOrganizations=[] → ConfiguraTuEspacio).
          const staffOrgs = mapped
            .filter((m) => staffRoles.has(m.role) && (m.organization?.id || m.organization_id))
            .map((m) => {
              if (m.organization?.id) return m.organization;
              return {
                id: m.organization_id,
                name: '',
                type: null,
                owner_id: null,
                active: true,
              };
            });
          const unique = [];
          const seen = new Set();
          for (const org of staffOrgs) {
            if (!org?.id || seen.has(org.id)) continue;
            seen.add(org.id);
            unique.push(org);
          }
          if (!cancelled) setOwnedOrganizations(unique);
          if (!cancelled) setOwnedOrgsLoading(false);
          return;
        }

        if (membershipsError) {
          console.log('🟠 organization_memberships fallback:', membershipsError?.message || membershipsError);
        }

        // Fallback legacy: owner_id en organizations
        const { data, error } = await supabase
          .from('organizations')
          .select(
            'id,name,type,logo_url,accent_color,theme_preset,background_type,background_url,owner_id,active,plan_fitengine,features,created_at,membership_freeze_enabled,membership_freeze_max_days,stripe_connect_account_id,stripe_checkout_enabled,mercadopago_checkout_enabled,mercadopago_oauth_linked,public_directory_enabled,google_place_id,google_place_summary'
          )
          .eq('owner_id', session.user.id);
        if (cancelled) return;
        if (error) {
          console.log('❌ fetchOwnedOrganizations:', error?.message || error);
          setOwnedOrganizations([]);
          setOrganizationMemberships([]);
        } else {
          const orgs = data || [];
          setOwnedOrganizations(orgs);
          setOrganizationMemberships(
            orgs.map((org) => ({
              id: null,
              organization_id: org.id,
              role: 'owner',
              active: true,
              is_default: false,
              organization: org,
            }))
          );
        }
      } finally {
        if (!cancelled) setOwnedOrgsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      // No limpiar ownedOrgsWallTimerRef aquí: si solo cambió `profile.organization_id`, el watchdog
      // sigue anclado al mismo usuario y evita ownedOrgsLoading colgado; al cambiar de usuario el efecto
      // de arriba reinicia el timer.
      // Si el fetch se cancela, el `finally` del async no hace setOwnedOrgsLoading(false).
      setOwnedOrgsLoading(false);
    };
  }, [session?.user?.id, profile?.organization_id, staffRoles, membershipsFetchKey]);

  /** Evita WelcomeGlobal en “cargando” eterno si sync / AsyncStorage / Supabase no terminan. */
  useEffect(() => {
    if (!session?.user?.id) return undefined;
    const watchdogMs = 7000;
    const t = setTimeout(() => {
      console.log(
        '🟠 AUTH_BOOTSTRAP_WATCHDOG: desbloqueando Welcome (initialProfileSync + orgs + modo persistido)',
      );
      setInitialProfileSyncDone(true);
      setOwnedOrgsLoading(false);
      setActiveAppModeHydrated(true);
    }, watchdogMs);
    return () => clearTimeout(t);
  }, [session?.user?.id]);

  useEffect(() => {
    if (!session?.user?.id) {
      setActiveAppModeState(null);
      setActiveAppModeHydrated(true);
      return;
    }
    let cancelled = false;
    const readModeWithCapMs = 5000;
    (async () => {
      try {
        const mode = await Promise.race([
          readActiveAppMode(session.user.id),
          new Promise((resolve) => setTimeout(() => resolve(null), readModeWithCapMs)),
        ]);
        if (cancelled) return;
        setActiveAppModeState(mode);
      } finally {
        if (!cancelled) setActiveAppModeHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
      // Si el read se cancela, el `finally` no pone hydrated=true → WelcomeGlobal puede quedar
      // para siempre en “cargando” (mismo aspecto que splash) con authNavigationReady en false.
      setActiveAppModeHydrated(true);
    };
  }, [session?.user?.id]);

  // Si no hay modo guardado aún, elegir uno sano según memberships:
  // - solo staff => staff
  // - solo cliente => client
  // - cliente + staff (mismo usuario) => no auto: WelcomeGlobal / login con forStaff eligen.
  // - sombrero dual legacy (perfil cliente + gym propio): tampoco auto; debe elegir.
  useEffect(() => {
    if (!session?.user?.id) return;
    if (!activeAppModeHydrated) return;
    if (activeAppMode) return;
    if (!organizationMemberships?.length) return;
    if (ownedOrgsLoading) return;
    if (!profile?.id) return;
    if (isDualHatUser) return;

    const active = organizationMemberships.filter((m) => !!m?.active);
    if (!active.length) return;
    const onlyStaff = active.every((m) => staffRoles.has(m.role));
    const onlyClient = active.every((m) => m.role === 'cliente');

    if (onlyStaff) {
      setActiveAppModeState('staff');
      writeActiveAppMode(session.user.id, 'staff').catch(() => {});
      return;
    }
    if (onlyClient) {
      setActiveAppModeState('client');
      writeActiveAppMode(session.user.id, 'client').catch(() => {});
      return;
    }

    // Mezcla cliente + staff en memberships: no elegir aquí (UI dual en WelcomeGlobal).
  }, [
    session?.user?.id,
    activeAppModeHydrated,
    activeAppMode,
    organizationMemberships,
    staffRoles,
    isDualHatUser,
    ownedOrgsLoading,
    profile?.id,
  ]);

  const persistActiveAppMode = useCallback(async (mode, userIdOverride) => {
    const uid = userIdOverride || session?.user?.id;
    if (!uid) return;
    if (mode !== 'client' && mode !== 'staff') return;

    // Canonizar contexto en BD (multi-dispositivo): set_default_membership(...)
    let membershipOrgIdForTrack = null;
    try {
      const active = (organizationMemberships || []).filter((m) => !!m?.active);
      let candidate = null;
      if (mode === 'staff') {
        const uidStr = String(uid);
        /** Staff en centro propio (dueña del gym) — prioridad sobre coach empleada con is_default en otra org. */
        const staffAtOwnedGym = active.filter(
          (m) =>
            staffRoles.has(m?.role) &&
            (m?.role === 'owner' ||
              (m?.organization?.owner_id && String(m.organization.owner_id) === uidStr)),
        );
        const profOrg =
          profile?.organization_id && String(profile.organization_id).trim()
            ? String(profile.organization_id).trim()
            : null;
        candidate =
          (profOrg && staffAtOwnedGym.find((m) => String(m.organization_id) === profOrg)) ||
          staffAtOwnedGym.find((m) => m?.role === 'owner') ||
          staffAtOwnedGym[0] ||
          active.find((m) => m?.is_default && staffRoles.has(m?.role)) ||
          active.find((m) => staffRoles.has(m?.role)) ||
          null;
      } else {
        candidate =
          active.find((m) => m?.is_default && m?.role === 'cliente') ||
          active.find((m) => m?.role === 'cliente');
      }
      membershipOrgIdForTrack = candidate?.organization_id || null;

      if (candidate?.id) {
        const { error: rpcError } = await supabase.rpc('set_default_membership', {
          p_membership_id: candidate.id,
        });
        if (rpcError) {
          console.log('🟠 persistActiveAppMode rpc set_default_membership:', rpcError?.message || rpcError);
        } else {
          setOrganizationMemberships((prev) =>
            (prev || []).map((m) => ({
              ...m,
              is_default: m?.id === candidate.id,
            }))
          );
        }
      }
    } catch (e) {
      console.log('🟠 persistActiveAppMode rpc exception:', e?.message || e);
    }

    await writeActiveAppMode(uid, mode);
    setActiveAppModeState(mode);
    trackEvent('auth_app_mode_changed', {
      mode: String(mode),
      organization_id: membershipOrgIdForTrack,
    });
  }, [session?.user?.id, organizationMemberships, staffRoles, profile?.organization_id]);

  /** WelcomeGlobal / login: no navegar hasta tener orgs propias + modo guardado leído (evita carrera a ClientTabs). */
  const authNavigationReady = useMemo(() => {
    if (!session?.user?.id) return true;
    return !ownedOrgsLoading && activeAppModeHydrated;
  }, [session?.user?.id, ownedOrgsLoading, activeAppModeHydrated]);

  useEffect(() => {
    if (!session?.user?.id) return;
    if (ownedOrgsLoading) return;
    // eslint-disable-next-line no-console
    console.log('ROUTING_DEBUG AuthContext snapshot', {
      userId: session.user.id,
      activeAppMode,
      activeAppModeHydrated,
      profileRole: profile?.role,
      hasStaffMembership,
      hasClientMembership,
      ownedOrgsCount: ownedOrganizations?.length ?? 0,
      orgsOwnedByUserCount: organizationsOwnedByUser?.length ?? 0,
      needsFitEngineSpaceSetup,
      membershipCount: organizationMemberships?.length ?? 0,
      isDualHatUser,
      authNavigationReady,
    });
  }, [
    session?.user?.id,
    ownedOrgsLoading,
    activeAppMode,
    activeAppModeHydrated,
    profile?.role,
    hasStaffMembership,
    hasClientMembership,
    ownedOrganizations,
    organizationsOwnedByUser,
    needsFitEngineSpaceSetup,
    organizationMemberships,
    isDualHatUser,
    authNavigationReady,
  ]);

  /**
   * Refresca la org activa para tema / BackgroundWrapper.
   * Pasá `explicitOrgId` tras crear espacio (FitEngine): si no, se usa profile/memberships y puede
   * haber carrera donde profile aún no tiene el nuevo organization_id → tema Waitomo por error.
   */
  const refreshOrganization = useCallback(
    async (explicitOrgId) => {
      const r = String(role || '').toLowerCase();
      const isPa =
        r === 'superadmin' ||
        platformAdminActiveRef.current === true ||
        platformAdminActive === true;
      const imp = String(impersonatingOrgIdRef.current || '').trim();
      if (imp && isPa) {
        const org = await fetchOrganization(imp);
        if (org) setOrganization(org);
        else setOrganization(null);
        return;
      }
      const orgId =
        explicitOrgId != null && String(explicitOrgId).trim() !== ''
          ? String(explicitOrgId).trim()
          : resolveEffectiveOrganizationId();
      if (!orgId) {
        setOrganization(null);
        return;
      }
      const org = await fetchOrganization(orgId);
      if (org) setOrganization(org);
      else setOrganization(null);
    },
    [resolveEffectiveOrganizationId, fetchOrganization, role, platformAdminActive]
  );

  const insertPlatformAudit = useCallback(
    async (action, entityType, entityId, payload) => {
      const uid = session?.user?.id;
      if (!uid) return;
      try {
        const { error } = await supabase.from('platform_audit_log').insert({
          actor_id: uid,
          action: String(action || ''),
          entity_type: entityType != null ? String(entityType) : null,
          entity_id: entityId != null ? String(entityId) : null,
          payload: payload && typeof payload === 'object' ? payload : {},
        });
        if (error) console.log('platform_audit_log:', error.message || error);
      } catch (e) {
        console.log('platform_audit_log catch:', e?.message || e);
      }
    },
    [session?.user?.id]
  );

  const startImpersonation = useCallback(
    async (orgId) => {
      const oid = String(orgId || '').trim();
      if (!oid) return { ok: false, error: 'empty' };
      const r = String(role || '').toLowerCase();
      const isPa =
        r === 'superadmin' ||
        platformAdminActiveRef.current === true ||
        platformAdminActive === true;
      if (!isPa) return { ok: false, error: 'forbidden' };
      const org = await fetchOrganization(oid);
      if (!org?.id) return { ok: false, error: 'org_not_found' };
      impersonatingOrgIdRef.current = oid;
      setImpersonatingOrgId(oid);
      setOrganization(org);
      const key = impersonateOrgStorageKey(session?.user?.id);
      if (key) {
        try {
          await AsyncStorage.setItem(key, oid);
        } catch (_) {}
      }
      void insertPlatformAudit('impersonation_start', 'organization', oid, {
        org_name: org.name || null,
      });
      void trackEvent('platform_impersonation_start', { organization_id: oid });
      return { ok: true };
    },
    [role, platformAdminActive, session?.user?.id, fetchOrganization, insertPlatformAudit]
  );

  const stopImpersonation = useCallback(async () => {
    const had = String(impersonatingOrgIdRef.current || '').trim();
    impersonatingOrgIdRef.current = null;
    setImpersonatingOrgId(null);
    const key = impersonateOrgStorageKey(session?.user?.id);
    if (key) {
      try {
        await AsyncStorage.removeItem(key);
      } catch (_) {}
    }
    if (had) {
      void insertPlatformAudit('impersonation_end', 'organization', had, {});
      void trackEvent('platform_impersonation_end', { organization_id: had });
    }
    await refreshOrganization();
  }, [session?.user?.id, insertPlatformAudit, refreshOrganization]);

  const refreshProfile = useCallback(async () => {
    const userId = session?.user?.id;
    if (!userId) return;
    await fetchProfile(userId, session?.access_token);
  }, [session?.user?.id, session?.access_token]);

  const joinOrganizationWithInviteCode = useCallback(
    async (rawCode) => {
      const code = String(rawCode || '').trim();
      if (!code) return { ok: false, error: 'empty_code' };
      try {
        const { data, error } = await supabase.rpc('join_organization_with_invite', { p_code: code });
        if (error) {
          console.log('join_organization_with_invite rpc:', error?.message || error);
          return { ok: false, error: 'rpc', message: error.message };
        }
        const j = data && typeof data === 'object' ? data : {};
        if (!j.ok) return j;
        await refreshProfile();
        if (j.organization_id) await refreshOrganization(String(j.organization_id));
        else await refreshOrganization();
        setMembershipsFetchKey((k) => k + 1);
        return j;
      } catch (e) {
        console.log('join_organization_with_invite exception:', e?.message || e);
        return { ok: false, error: 'exception', message: e?.message };
      }
    },
    [refreshProfile, refreshOrganization]
  );

  const pendingInviteAppliedRef = useRef(null);

  /**
   * Aplica código de invitación guardado (AsyncStorage) para la sesión actual.
   * Se llama desde sync (antes de abrir post-auth) y desde un efecto de respaldo.
   * No borra el código ante fallos transitorios (red/RPC) para poder reintentar.
   */
  async function applyPendingClientInviteOnce() {
    try {
      const code = await getPendingClientInviteCode();
      if (!code) return;
      if (pendingInviteAppliedRef.current === code) return;
      const res = await joinOrganizationWithInviteCode(code);
      if (res?.ok) {
        pendingInviteAppliedRef.current = code;
        await clearPendingClientInviteCode();
        return;
      }
      const fatal = res?.error === 'invalid_code' || res?.error === 'role_not_client' || res?.error === 'empty_code';
      if (fatal) {
        await clearPendingClientInviteCode();
        console.log('🟠 pending client invite descartado:', res?.error || res);
        return;
      }
      console.log('🟠 pending client invite no aplicado (se conserva el código):', res?.error || res);
    } catch (e) {
      console.log('🟠 applyPendingClientInviteOnce:', e?.message || e);
    }
  }

  useEffect(() => {
    if (!session?.user?.id) {
      pendingInviteAppliedRef.current = null;
    }
  }, [session?.user?.id]);

  useEffect(() => {
    if (!session?.user?.id) return;
    if (initialProfileSyncDone === false) return;
    let cancelled = false;
    (async () => {
      const code = await getPendingClientInviteCode();
      if (!code || cancelled) return;
      if (pendingInviteAppliedRef.current === code) return;
      const res = await joinOrganizationWithInviteCode(code);
      if (cancelled) return;
      if (res?.ok) {
        pendingInviteAppliedRef.current = code;
        await clearPendingClientInviteCode();
      } else if (
        res?.error === 'invalid_code' ||
        res?.error === 'role_not_client' ||
        res?.error === 'empty_code'
      ) {
        await clearPendingClientInviteCode();
        console.log('🟠 pending client invite (effect) descartado:', res?.error || res);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, initialProfileSyncDone, joinOrganizationWithInviteCode]);

  // -------------------------
  // ✅ ENSURE PROFILE (igual a tu versión, sin tocar lógica)
  // -------------------------
  const ensureProfile = async (payload = {}) => {
    const userId = payload?.id || payload?.userId || session?.user?.id || null;

    if (!userId) {
      console.log('❌ ensureProfile: no userId');
      return null;
    }

    if (profile?.id === userId) return profile;

    if (ensureProfileInFlightRef.current.has(userId)) {
      return await ensureProfileInFlightRef.current.get(userId);
    }

    const buildPatch = () => {
      const patch = {};
      if (payload.full_name != null) patch.full_name = payload.full_name;
      if (payload.phone != null) patch.phone = payload.phone;
      if (payload.username != null) patch.username = payload.username;
      if (payload.plan_actual != null) patch.plan_actual = payload.plan_actual;
      return patch;
    };

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const REQUEST_TIMEOUT_MS = 8000;

    const withAbort = async (fn, label) => {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        return await fn(controller.signal);
      } catch (e) {
        const msg = String(e?.message || e || '');
        console.log(`❌ ensureProfile ${label} exception:`, msg);
        throw e;
      } finally {
        clearTimeout(t);
      }
    };

    const selectProfile = async () => {
      return await withAbort(
        async (signal) => {
          const sel = await supabase
            .from('profiles')
            .select(PROFILE_COLS)
            .eq('id', userId)
            .maybeSingle()
            .abortSignal(signal);

          if (sel?.error) {
            console.log('❌ ensureProfile select error:', {
              message: sel.error?.message,
              code: sel.error?.code,
              details: sel.error?.details,
              hint: sel.error?.hint,
            });
            return { data: null, error: sel.error };
          }
          return { data: sel?.data || null, error: null };
        },
        'select'
      );
    };

    const upsertProfile = async (patch) => {
      return await withAbort(
        async (signal) => {
          let roleFromMeta = session?.user?.user_metadata?.role;
          if (roleFromMeta !== 'coach' && roleFromMeta !== 'admin' && roleFromMeta !== 'superadmin') {
            const staffOAuth = await AsyncStorage.getItem(STORAGE_KEYS.OAUTH_SIGNUP_STAFF);
            if (staffOAuth) {
              await AsyncStorage.removeItem(STORAGE_KEYS.OAUTH_SIGNUP_STAFF);
              roleFromMeta = 'coach';
            }
          }
          const metaRole = roleFromMeta;
          const upsertPayload = {
            id: userId,
            role: metaRole === 'coach' || metaRole === 'admin' || metaRole === 'superadmin' ? metaRole : 'cliente',
            ...patch,
          };

          const ins = await supabase
            .from('profiles')
            .upsert(upsertPayload, { onConflict: 'id' })
            .select(PROFILE_COLS)
            .single()
            .abortSignal(signal);

          if (ins?.error) {
            console.log('❌ ensureProfile upsert error:', {
              message: ins.error?.message,
              code: ins.error?.code,
              details: ins.error?.details,
              hint: ins.error?.hint,
            });
            return { data: null, error: ins.error };
          }
          return { data: ins?.data || null, error: null };
        },
        'upsert'
      );
    };

    const updateProfileDb = async (patch) => {
      return await withAbort(
        async (signal) => {
          const upd = await supabase
            .from('profiles')
            .update(patch)
            .eq('id', userId)
            .select(PROFILE_COLS)
            .single()
            .abortSignal(signal);

          if (upd?.error) {
            console.log('❌ ensureProfile update error:', {
              message: upd.error?.message,
              code: upd.error?.code,
              details: upd.error?.details,
              hint: upd.error?.hint,
            });
            return { data: null, error: upd.error };
          }
          return { data: upd?.data || null, error: null };
        },
        'update'
      );
    };

    const run = (async () => {
      try {
        let patch = buildPatch();
        const staffOAuth = await AsyncStorage.getItem(STORAGE_KEYS.OAUTH_SIGNUP_STAFF);
        let { data: existing, error: selErr } = await selectProfile();
        if (selErr) return null;

        if (staffOAuth) {
          await AsyncStorage.removeItem(STORAGE_KEYS.OAUTH_SIGNUP_STAFF);
          if (!existing?.id || existing?.role !== 'cliente') patch = { ...patch, role: 'coach' };
        }

        if (existing?.id) {
          if (Object.keys(patch).length === 0) {
            setProfile(existing);
            setRole(existing?.role || null);

            const pAct = existing?.plan_actual ? String(existing.plan_actual) : null;
            setActivePlanId(pAct);
            await setPlanActualStorage(pAct);

            return existing;
          }

          const { data: updated, error: updErr } = await updateProfileDb(patch);
          const finalRow = updErr ? existing : updated;

          setProfile(finalRow);
          setRole(finalRow?.role || null);

          const pAct = finalRow?.plan_actual ? String(finalRow.plan_actual) : null;
          setActivePlanId(pAct);
          await setPlanActualStorage(pAct);

          return finalRow;
        }

        let { data: created, error: upErr } = await upsertProfile(patch);
        if (!upErr && created?.id) {
          setProfile(created);
          setRole(created?.role || null);

          const pAct = created?.plan_actual ? String(created.plan_actual) : null;
          setActivePlanId(pAct);
          await setPlanActualStorage(pAct);

          return created;
        }

        const upCode = upErr?.code || '';
        const upMsg = String(upErr?.message || '').toLowerCase();
        const looksLikeRls =
          upCode === '42501' ||
          upMsg.includes('row level security') ||
          upMsg.includes('permission');

        if (looksLikeRls) {
          console.log('🟡 ensureProfile: UPSERT bloqueado por RLS → espero trigger y reintento SELECT...');
          for (let i = 0; i < 3; i++) {
            await sleep(300 + i * 250);
            const reSel = await selectProfile();
            if (reSel?.data?.id) {
              setProfile(reSel.data);
              setRole(reSel.data?.role || null);

              const pAct = reSel.data?.plan_actual ? String(reSel.data.plan_actual) : null;
              setActivePlanId(pAct);
              await setPlanActualStorage(pAct);

              return reSel.data;
            }
          }
        }

        return null;
      } catch (e) {
        console.log('❌ ensureProfile catch:', String(e?.message || e || ''));
        return null;
      } finally {
        ensureProfileInFlightRef.current.delete(userId);
      }
    })();

    ensureProfileInFlightRef.current.set(userId, run);
    return await run;
  };

  // -------------------------
  // FETCH USER PLANS (lo dejás igual)
  // -------------------------
  const fetchUserPlans = async (userId) => {
    if (!userId) return [];

    try {
      const { data: abonos, error: abErr } = await supabase
        .from('user_abonos')
        .select('id, plan_id, status, start_date, end_date, abono_id, created_at')
        .eq('user_id', userId)
        .in('status', ['pending', 'active'])
        .order('created_at', { ascending: false });

      if (!abErr && abonos?.length) {
        const activePlan = abonos.find((x) => x?.status === 'active') || abonos[0];
        const activePlanIdFromAbonos = activePlan?.plan_id ? String(activePlan.plan_id) : null;

        const seen = new Set();
        const unique = [];

        for (const r of abonos) {
          if (r?.plan_id && !seen.has(r.plan_id)) {
            seen.add(r.plan_id);
            unique.push({
              id: r.id,
              plan_id: r.plan_id,
              activo: String(r.plan_id) === String(activePlanIdFromAbonos),
              fuente: 'user_abonos',
              status: r.status,
              start_date: r.start_date,
              end_date: r.end_date,
              abono_id: r.abono_id,
              created_at: r.created_at,
            });
          }
        }

        setUserPlans(unique);

        // fallback plan id
        if (!activePlanId && activePlanIdFromAbonos) {
          setActivePlanId(activePlanIdFromAbonos);
          await setPlanActualStorage(activePlanIdFromAbonos);
        }

        return unique;
      }
    } catch {
      // fallback
    }

    const { data, error } = await supabase
      .from('user_plans')
      .select('*')
      .eq('user_id', userId)
      .order('fecha_compra', { ascending: false });

    if (error) {
      console.error('Error cargando planes del usuario:', error.message);
      setUserPlans([]);
      return [];
    }

    setUserPlans(data || []);
    return data || [];
  };

  const refreshPlatformAdminFromSession = useCallback(async (uid) => {
    if (!uid) {
      platformAdminActiveRef.current = null;
      setPlatformAdminActive(null);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('platform_admins')
        .select('active')
        .eq('user_id', uid)
        .maybeSingle();
      if (error) {
        const code = String(error.code || '');
        const msg = String(error.message || '').toLowerCase();
        if (code === '42P01' || (msg.includes('platform_admins') && msg.includes('does not exist'))) {
          platformAdminActiveRef.current = null;
          setPlatformAdminActive(null);
          return;
        }
        console.log('🟠 platform_admins fetch:', error.message || error);
        platformAdminActiveRef.current = null;
        setPlatformAdminActive(null);
        return;
      }
      const active = data?.active === true;
      platformAdminActiveRef.current = active;
      setPlatformAdminActive(active);
    } catch (e) {
      console.log('🟠 platform_admins fetch catch:', e?.message || e);
      platformAdminActiveRef.current = null;
      setPlatformAdminActive(null);
    }
  }, []);

  // -------------------------
  // SYNC
  // -------------------------
  const syncFromSession = async (nextSession) => {
    setSession(nextSession || null);

    const userId = nextSession?.user?.id || null;
    const accessToken = nextSession?.access_token || null;

    if (!userId) {
      console.log('🧠 SYNC: sin userId → limpio estado');
      impersonatingOrgIdRef.current = null;
      setImpersonatingOrgId(null);
      platformAdminActiveRef.current = null;
      setPlatformAdminActive(null);
      setProfile(null);
      setRole(null);
      setUserPlans([]);
      setActivePlanId(null);
      setOrganization(null);
      setOwnedOrganizations([]);
      setOrganizationMemberships([]);
      setOwnedOrgsLoading(false);
      setActiveAppModeState(null);
      await setPlanActualStorage(null);
      lastFetchedUserIdRef.current = null;
      lastAvatarCleanupUserIdRef.current = null;
      setInitialProfileSyncDone(true);
      setAuthSessionRestored(true);
      return null;
    }

    // No usar `!profile` aquí: en llamadas seguidas (restore + onAuthStateChange) el closure
    // sigue viendo profile=null y re-dispara fetch en bucle.
    if (lastFetchedUserIdRef.current === userId) {
      // Si el ref dice "ya sincronicé" pero el estado perdió profile (carrera / remount / limpieza parcial),
      // NO omitir: si no, Login ve profile=null + initialProfileSyncDone=true y manda a RegistroInicial.
      if (profileRef.current?.id === userId) {
        // No await: si join_organization_with_invite cuelga, bloqueaba setInitialProfileSyncDone
        // y WelcomeGlobal quedaba en “cargando” para siempre en web.
        setInitialProfileSyncDone(true);
        void applyPendingClientInviteOnce().catch(() => {});
        console.log('🧠 SYNC: omitido (perfil ya sincronizado para este usuario)', {
          userId,
          lastFetchedUserId: lastFetchedUserIdRef.current,
          note: 'profile en log puede ser null por closure de React; no indica estado real',
        });
        await refreshPlatformAdminFromSession(userId);
        return profileRef.current;
      }
      console.log('🧠 SYNC: ref coincide pero sin profile en estado → fetch forzado', { userId });
    }
    if (profileSyncInFlightRef.current === userId) {
      if (!profileSyncConcurrentSkipLoggedRef.current) {
        profileSyncConcurrentSkipLoggedRef.current = true;
        console.log('🧠 SYNC: omitido (fetch de perfil en curso)', {
          userId,
          note: 'restore + onAuthStateChange suelen disparar 2+; el primero hace el SELECT',
        });
      }
      return profileRef.current?.id === userId ? profileRef.current : null;
    }

    console.log('🧠 SYNC CHECK', {
      lastFetched: lastFetchedUserIdRef.current,
      userId,
      hasAccessToken: !!accessToken,
      tokenLen: accessToken ? String(accessToken).length : 0,
    });

    setInitialProfileSyncDone(false);
    profileSyncInFlightRef.current = userId;
    let syncedProfile = null;
    try {
      console.log('🧠 SYNC → fetchProfile(userId, accessToken)');
      let p = await fetchProfile(userId, accessToken);

      if (p?.id) {
        p = await healProfileRoleFromUserMetadata(
          userId,
          accessToken,
          p,
          nextSession?.user?.user_metadata
        );
        setProfile(p);
        setRole(p?.role || null);
        const pAct = p?.plan_actual ? String(p.plan_actual) : null;
        setActivePlanId(pAct);
        await setPlanActualStorage(pAct);
        syncedProfile = p;
        await refreshPlatformAdminFromSession(userId);
      } else {
        // Sin fila en profiles (trigger falló, OAuth reciente, etc.): refresh + re-SELECT + ensureProfile.
        // Antes: refresh OK pero dejábamos profile=null → “perfil vacío” y join/membresías incoherentes.
        const { data: refData, error: refErr } = await supabase.auth.refreshSession();
        if (refErr || !refData?.user || !refData?.session) {
          await clearSupabaseAuthStorage();
          try {
            await supabase.auth.signOut({ scope: 'local' });
          } catch (_) {}
          setSession(null);
          impersonatingOrgIdRef.current = null;
          setImpersonatingOrgId(null);
          platformAdminActiveRef.current = null;
          setPlatformAdminActive(null);
          setProfile(null);
          setOrganization(null);
          setRole(null);
          setUserPlans([]);
          setActivePlanId(null);
          lastFetchedUserIdRef.current = null;
          lastAvatarCleanupUserIdRef.current = null;
          await setPlanActualStorage(null);
          return null;
        }
        setSession(refData.session);
        const newToken = refData.session.access_token;
        let pRetry = await fetchProfile(userId, newToken);
        if (!pRetry?.id) {
          const um = refData.session.user?.user_metadata || {};
          const fullName = String(um.full_name || um.name || um.nombre || '').trim() || 'Cliente';
          console.log('🧠 SYNC: sin fila profile tras refresh → ensureProfile');
          await ensureProfile({ id: userId, full_name: fullName });
          pRetry = await fetchProfile(userId, refData.session.access_token);
        }
        if (pRetry?.id) {
          pRetry = await healProfileRoleFromUserMetadata(
            userId,
            newToken,
            pRetry,
            refData.session.user?.user_metadata
          );
          setProfile(pRetry);
          setRole(pRetry?.role || null);
          const pAct = pRetry?.plan_actual ? String(pRetry.plan_actual) : null;
          setActivePlanId(pAct);
          await setPlanActualStorage(pAct);
          syncedProfile = pRetry;
          setMembershipsFetchKey((k) => k + 1);
          await refreshPlatformAdminFromSession(userId);
        } else {
          impersonatingOrgIdRef.current = null;
          setImpersonatingOrgId(null);
          platformAdminActiveRef.current = null;
          setPlatformAdminActive(null);
          setProfile(null);
          setOrganization(null);
          setRole(null);
          syncedProfile = null;
        }
      }

      lastFetchedUserIdRef.current = userId;
    } finally {
      profileSyncInFlightRef.current = null;
      profileSyncConcurrentSkipLoggedRef.current = false;
      // Marcar sync listo antes de invitación pendiente: el RPC puede tardar o colgarse;
      // el efecto con initialProfileSyncDone vuelve a intentar applyPendingClientInviteOnce.
      setInitialProfileSyncDone(true);
      void applyPendingClientInviteOnce().catch(() => {});
    }

    // En segundo plano para no bloquear OAuth/Login (fetchUserPlans puede hacer timeout con RLS).
    fetchUserPlans(userId).catch(() => {});
    return syncedProfile;
  };

  // -------------------------
  // RESTORE + LISTENER
  // -------------------------
  useEffect(() => {
    let mounted = true;

    const restore = async () => {
      // WelcomeGlobal muestra el mismo “splash” hasta authSessionRestored. Antes solo pasaba a true
      // al terminar TODO restore (syncFromSession + fetch perfil + refresh…), pudiendo colgarse minutos.
      let welcomeUiUnblocked = false;
      const unblockWelcomeBootstrapUI = () => {
        if (welcomeUiUnblocked || !mounted) return;
        welcomeUiUnblocked = true;
        setAuthSessionRestored(true);
      };
      /** Tope duro: el usuario debe ver Welcome (CTAs o spinner de sesión) en ~≤3s, no esperar restore completo. */
      const RESTORE_UI_CAP_MS = 2600;
      const uiCapTimer = setTimeout(() => {
        console.log(
          '🟠 restore: RESTORE_UI_CAP — desbloqueando WelcomeGlobal (restore/sync puede seguir en vuelo)',
        );
        unblockWelcomeBootstrapUI();
      }, RESTORE_UI_CAP_MS);
      try {
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          const authCode = getWebOAuthCodeFromQuery();
          // Volver al mismo origen donde quedó el code_verifier PKCE (localStorage por host).
          if (authCode && typeof sessionStorage !== 'undefined') {
            try {
              const saved = sessionStorage.getItem(WEB_OAUTH_START_REDIRECT_KEY);
              if (saved) {
                const savedBase = new URL(saved);
                if (window.location.origin !== savedBase.origin) {
                  const path = window.location.pathname || '/';
                  const target = `${savedBase.origin}${path}${window.location.search}${window.location.hash}`;
                  window.location.replace(target);
                  return;
                }
              }
            } catch (e) {
              console.log('🟠 restore web oauth origin redirect:', e?.message || e);
            }
          }

          const hashSession = getWebOAuthSessionFromHash();
          const hasOAuthInUrl = Boolean(authCode || hashSession);
          if (hasOAuthInUrl) {
            // supabaseClient: detectSessionInUrl (web) canjea ?code= una sola vez al leer sesión.
            let { data: urlSessionData } = await supabase.auth.getSession();
            if (!urlSessionData?.session?.user?.id && authCode) {
              for (let i = 0; i < 10 && !urlSessionData?.session?.user?.id; i += 1) {
                await new Promise((r) => setTimeout(r, 100));
                ({ data: urlSessionData } = await supabase.auth.getSession());
              }
            }
            if (!urlSessionData?.session?.user?.id && authCode && typeof window !== 'undefined') {
              try {
                const href = String(window.location.href || '');
                const { data: exchanged, error: exErr } = await supabase.auth.exchangeCodeForSession(href);
                if (!exErr && exchanged?.session?.user?.id) {
                  urlSessionData = { session: exchanged.session };
                }
              } catch (e) {
                console.log('🟠 restore web exchangeCodeForSession:', e?.message || e);
              }
            }
            if (urlSessionData?.session?.user?.id) {
              try {
                sessionStorage.removeItem(WEB_OAUTH_START_REDIRECT_KEY);
                const cleanUrl = `${window.location.origin}${window.location.pathname}`;
                window.history.replaceState({}, document.title, cleanUrl);
              } catch (_) {}
              if (mounted) await syncFromSession(urlSessionData.session);
              return;
            }

            if (hashSession) {
              const { data: setData, error: setError } = await supabase.auth.setSession(hashSession);
              if (!setError && setData?.session?.user?.id) {
                try {
                  sessionStorage.removeItem(WEB_OAUTH_START_REDIRECT_KEY);
                  const cleanUrl = `${window.location.origin}${window.location.pathname}${window.location.search}`;
                  window.history.replaceState({}, document.title, cleanUrl);
                } catch (_) {}
                if (mounted) await syncFromSession(setData.session);
                return;
              }
              console.log('🟠 restore web hash session error:', setError?.message || setError);
            } else if (authCode) {
              console.log(
                '🟠 restore web: hay ?code= pero sin sesión (revisá Redirect URLs en Supabase o mezcla de hosts).',
              );
            }
          }
        }

        const initialUrl = await Linking.getInitialURL();
        console.log('🧠 restore: getInitialURL =>', initialUrl ? initialUrl.substring(0, 50) + '...' : 'null');
        if (initialUrl && isOAuthCallbackUrl(initialUrl)) {
          staleInitialOAuthUrlRef.current = initialUrl;
          await clearSupabaseAuthStorage();
          try {
            await supabase.auth.signOut({ scope: 'local' });
          } catch (_) {}
          if (mounted) await syncFromSession(null);
          return;
        }

        const { data, error } = await supabase.auth.getSession();

        if (error) {
          const msg = String(error?.message || error || '').toLowerCase();
          console.log('getSession error:', error);

          const isRefreshTokenProblem =
            msg.includes('invalid refresh token') ||
            msg.includes('refresh token not found') ||
            (msg.includes('refresh token') && msg.includes('not found')) ||
            msg.includes('jwt expired') ||
            msg.includes('session not found');

          if (isRefreshTokenProblem) {
            // Refresh token roto → signOut local, limpiar. Queda como usuario nuevo.
            try {
              await supabase.auth.signOut({ scope: 'local' });
            } catch (e) {
              console.log('signOut local (refresh token problem) error:', e);
            }
            await clearSupabaseAuthStorage();
            if (mounted) await syncFromSession(null);
            return;
          }
        }

        if (!mounted) return;

        const sessionFromStorage = data?.session || null;
        const justLoggedOutAt = justLoggedOutAtRef.current;
        if (justLoggedOutAt != null && Date.now() - justLoggedOutAt < LOGOUT_IGNORE_MS) {
          console.log('🧨 restore: acabo de cerrar sesión → ignoro sesión restaurada');
          await clearSupabaseAuthStorage();
          try {
            await supabase.auth.signOut({ scope: 'local' });
          } catch (_) {}
          if (mounted) await syncFromSession(null);
          return;
        }
        if (sessionFromStorage?.user?.id) {
          // getSession() lee storage local: si borraste el usuario en Supabase, el JWT puede seguir
          // “fresco” y la app creía que seguías logueado. getUser() pega al servidor y valida el token.
          const { data: ju, error: juErr } = await supabase.auth.getUser();
          if (juErr || !ju?.user?.id) {
            const msg = String(juErr?.message || juErr || '').toLowerCase();
            const status = juErr?.status ?? juErr?.statusCode;
            const looksNetwork =
              msg.includes('failed to fetch') ||
              msg.includes('networkerror') ||
              msg.includes('network request failed') ||
              msg.includes('load failed') ||
              String(juErr?.name || '') === 'AuthRetryableFetchError';
            const looksRevoked =
              !ju?.user?.id ||
              status === 401 ||
              status === 403 ||
              msg.includes('user not found') ||
              msg.includes('invalid jwt') ||
              msg.includes('jwt expired') ||
              msg.includes('session not found') ||
              msg.includes('session missing');
            if (!looksNetwork && looksRevoked) {
              console.log('🧨 restore: sesión local inválida o usuario borrado (getUser) → signOut local', {
                status,
                snippet: msg.slice(0, 120),
              });
              await clearSupabaseAuthStorage();
              try {
                await supabase.auth.signOut({ scope: 'local' });
              } catch (_) {}
              if (mounted) await syncFromSession(null);
              return;
            }
          }
        }
        if (sessionFromStorage?.user?.id) {
          const exp = sessionFromStorage.expires_at;
          const nowSec = Date.now() / 1000;
          const tokenStillFresh = typeof exp === 'number' && Number.isFinite(exp) && exp > nowSec + 120;
          if (tokenStillFresh) {
            if (mounted) await syncFromSession(sessionFromStorage);
            return;
          }
          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError || !refreshData?.session?.user) {
            // Sesión no válida → limpiar. Queda como usuario nuevo.
            await clearSupabaseAuthStorage();
            try {
              await supabase.auth.signOut({ scope: 'local' });
            } catch (_) {}
            if (mounted) await syncFromSession(null);
            return;
          }
          if (mounted) await syncFromSession(refreshData.session);
          return;
        }

        await syncFromSession(sessionFromStorage);
      } catch (e) {
        console.log('restore session catch:', e);
        if (mounted) {
          await clearSupabaseAuthStorage();
          await syncFromSession(null);
        }
      } finally {
        clearTimeout(uiCapTimer);
        unblockWelcomeBootstrapUI();
      }
    };

    restore();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!mounted) return;
      const justLoggedOutAt = justLoggedOutAtRef.current;
      if (justLoggedOutAt != null && Date.now() - justLoggedOutAt < LOGOUT_IGNORE_MS && nextSession?.user) {
        console.log('🧨 onAuthStateChange: acabo de cerrar sesión → rechazo sesión fantasma');
        try {
          await supabase.auth.signOut({ scope: 'local' });
        } catch (_) {}
        await clearSupabaseAuthStorage();
        if (mounted) await syncFromSession(null);
        return;
      }
      try {
        await syncFromSession(nextSession || null);
      } catch (e) {
        console.log('onAuthStateChange catch:', e);
      }
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []); // ✅ no deps

  // -------------------------
  // UPDATE PROFILE (REST) — tu versión (sin tocar) + sync plan_actual
  // -------------------------
  const updateProfile = async (partial = {}) => {
    const userId = session?.user?.id || profile?.id || null;

    if (!userId) {
      console.log('❌ updateProfileREST: no userId (session/profile null)');
      return null;
    }

    const accessToken = session?.access_token || null;
    if (!accessToken) {
      console.log('❌ updateProfileREST: sin access_token (no puedo pasar RLS)');
      return null;
    }

    const payload = { ...(partial || {}) };
    const keys = Object.keys(payload);

    const START = Date.now();
    const REQUEST_TIMEOUT_MS = 10000;

    console.log('🧠 updateProfileREST: START', { userId, keys });

    const runWithTimeout = async (fn, label) => {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      const hardTimeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`${label} TIMEOUT ${REQUEST_TIMEOUT_MS}ms`)), REQUEST_TIMEOUT_MS + 300)
      );

      try {
        const out = await Promise.race([fn(controller.signal), hardTimeout]);
        console.log(`🧠 updateProfileREST:${label} OK (${Date.now() - START}ms)`);
        return out;
      } catch (e) {
        const msg = String(e?.message || e || '');
        console.log(`❌ updateProfileREST:${label} FAIL (${Date.now() - START}ms):`, msg);
        throw e;
      } finally {
        clearTimeout(t);
      }
    };

    const cols = PROFILE_COLS;

    const headers = {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    };

    const baseUrl = `${SUPABASE_URL}/rest/v1/profiles`;

    const patchUrl =
      `${baseUrl}` +
      `?id=eq.${encodeURIComponent(userId)}` +
      `&select=${encodeURIComponent(cols)}`;

    try {
      const res = await runWithTimeout(
        (signal) =>
          fetch(patchUrl, {
            method: 'PATCH',
            headers,
            body: JSON.stringify(payload),
            signal,
          }),
        'patch_http'
      );

      const text = await res.text();
      let json = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }

      if (!res.ok) {
        console.log('❌ updateProfileREST HTTP error:', {
          status: res.status,
          body: (text || '').slice(0, 800),
        });
        return null;
      }

      const row = Array.isArray(json) ? json[0] : null;

      if (row?.id) {
        console.log('✅ updateProfileREST: UPDATED', { ms: Date.now() - START, id: row.id });
        setProfile(row);
        if (row?.role) setRole(row.role);

        const pAct = row?.plan_actual ? String(row.plan_actual) : null;
        setActivePlanId(pAct);
        await setPlanActualStorage(pAct);

        return row;
      }

      // fallback select
      const selUrl =
        `${baseUrl}` +
        `?id=eq.${encodeURIComponent(userId)}` +
        `&select=${encodeURIComponent(cols)}` +
        `&limit=1`;

      const selRes = await runWithTimeout(
        (signal) =>
          fetch(selUrl, {
            method: 'GET',
            headers: {
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${accessToken}`,
              Accept: 'application/json',
            },
            signal,
          }),
        'select_fallback_http'
      );

      const selText = await selRes.text();
      let selJson = null;
      try {
        selJson = selText ? JSON.parse(selText) : null;
      } catch {
        selJson = null;
      }

      if (!selRes.ok) return null;

      const row2 = Array.isArray(selJson) ? selJson[0] : null;
      if (!row2?.id) return null;

      setProfile(row2);
      if (row2?.role) setRole(row2.role);

      const pAct2 = row2?.plan_actual ? String(row2.plan_actual) : null;
      setActivePlanId(pAct2);
      await setPlanActualStorage(pAct2);

      return row2;
    } catch (e) {
      console.log('❌ updateProfileREST catch:', e?.message || e, e);
      return null;
    }
  };

  const updateProfileData = async (fields = {}) => updateProfile(fields);

  const base64ToArrayBuffer = (base64) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  };

  const uploadAvatar = async (uri, base64Data = null) => {
    const userId = session?.user?.id || profile?.id || null;
    if (!userId || !uri) return null;
    const ext = (uri.split('.').pop() || 'jpg').split('?')[0];
    const safeExt = /^[a-z0-9]+$/i.test(ext) ? ext : 'jpg';
    const path = `${userId}/avatar.${safeExt}`;
    const contentType = `image/${safeExt === 'png' ? 'png' : 'jpeg'}`;
    try {
      let body;
      if (base64Data) {
        body = base64ToArrayBuffer(base64Data);
      } else {
        body = await imageUriToArrayBuffer(uri);
      }
      const { error } = await supabase.storage
        .from('avatars')
        .upload(path, body, { contentType, upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      const publicUrl = data?.publicUrl || null;
      if (!publicUrl) throw new Error('No se obtuvo URL pública');
      const updated = await updateProfile({ avatar_url: publicUrl });
      return updated?.avatar_url || publicUrl;
    } catch (e) {
      console.log('Error uploadAvatar:', e?.message || e);
      return null;
    }
  };

  // -------------------------
  // REGISTER / LOGIN (igual)
  // -------------------------
  const register = async ({ email, password, fullName, phone, planActual, username, role: roleParam }) => {
    setLoading(true);
    try {
      const normalizedEmail = (email || '').trim().toLowerCase();
      const role = roleParam || 'cliente';

      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            full_name: fullName || null,
            phone: phone || null,
            username: username || null,
            role,
            plan_actual: planActual || null,
          },
        },
      });

      if (error) throw error;

      const user = data?.user || null;
      if (!user) return null;

      let nextSession = data?.session || null;
      if (!nextSession) {
        const { data: sessionData } = await supabase.auth.getSession();
        nextSession = sessionData?.session || null;
      }

      if (nextSession) await syncFromSession(nextSession);
      return user;
    } finally {
      setLoading(false);
    }
  };

  const login = async ({ email, password }) => {
    setLoading(true);
    try {
      const normalized = (email || '').trim().toLowerCase();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalized,
        password,
      });
      if (error) throw error;
      const syncedProfile = await syncFromSession(data?.session || null);
      return { user: data?.user || null, profile: syncedProfile ?? null };
    } finally {
      setLoading(false);
    }
  };

  // -------------------------
  // OAUTH Google / Apple
  // -------------------------
  const signInWithProvider = async (provider) => {
    const finishOAuthWithReturnUrl = async (returnedUrl) => {
      const hasHash = returnedUrl.includes('#');
      const hasCode = /[?&]code=/.test(returnedUrl);
      console.log('🟡 OAuth [DEBUG] returnedUrl hasHash:', hasHash, 'hasCode:', hasCode);

      if (!hasHash || hasCode) {
        console.log('🟡 OAuth [DEBUG] paso: intentando exchangeCodeForSession (timeout 3s)');
        try {
          const exchangePromise = supabase.auth.exchangeCodeForSession(returnedUrl);
          const timeoutPromise = new Promise((_, rej) => setTimeout(() => rej(new Error('exchange timeout')), 3000));
          const { data: exchangedUrl, error: exUrlError } = await Promise.race([exchangePromise, timeoutPromise]);
          if (!exUrlError && exchangedUrl?.session) {
            console.log('🟢 OAuth [DEBUG] sesión desde exchangeCodeForSession');
            await syncFromSession(exchangedUrl.session);
            return exchangedUrl;
          }
        } catch (e) {
          console.log('🟠 OAuth [DEBUG] exchangeCodeForSession:', e?.message || e);
        }
      } else {
        console.log('🟡 OAuth [DEBUG] paso: skip exchange, URL solo tiene fragmento → parsear #');
      }

      const parsed = Linking.parse(returnedUrl);
      const code = parsed?.queryParams?.code;

      if (code) {
        const { data: exchanged, error: exError } = await supabase.auth.exchangeCodeForSession(returnedUrl);
        if (exError) throw exError;
        await syncFromSession(exchanged?.session || null);
        return exchanged;
      }

      if (returnedUrl.includes('#')) {
        const fragment = returnedUrl.split('#')[1] || '';
        const params = new URLSearchParams(fragment);
        const at = params.get('access_token');
        const rt = params.get('refresh_token');
        if (at && rt) {
          const accessToken = decodeURIComponent(at);
          const refreshToken = decodeURIComponent(rt);
          const payload = decodeJwtPayload(accessToken);
          if (payload?.sub) {
            const user = {
              id: payload.sub,
              email: payload.email ?? undefined,
              user_metadata: payload.user_metadata ?? payload,
              phone: payload.phone ?? undefined,
            };
            const session = {
              access_token: accessToken,
              refresh_token: refreshToken,
              user,
            };
            const justLoggedOutAt = justLoggedOutAtRef.current;
            if (justLoggedOutAt != null && Date.now() - justLoggedOutAt < LOGOUT_IGNORE_MS) {
              console.log('🧨 OAuth fragmento: acabo de cerrar sesión → rechazo sesión fantasma');
              try {
                await supabase.auth.signOut({ scope: 'local' });
              } catch (_) {}
              await clearSupabaseAuthStorage();
              await syncFromSession(null);
              throw new Error('OAuth ignorado tras cierre de sesión.');
            }
            const staleUrl = staleInitialOAuthUrlRef.current;
            if (staleUrl && returnedUrl && returnedUrl === staleUrl) {
              console.log('🧨 OAuth fragmento: misma URL que abrió la app (sesión fantasma) → rechazo');
              staleInitialOAuthUrlRef.current = null;
              try {
                await supabase.auth.signOut({ scope: 'local' });
              } catch (_) {}
              await clearSupabaseAuthStorage();
              await syncFromSession(null);
              throw new Error('OAuth ignorado: sesión de apertura anterior.');
            }
            staleInitialOAuthUrlRef.current = null;
            console.log('🟢 OAuth: sesión desde fragmento (JWT), sincronizando.');
            await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
            await syncFromSession(session);
            return { session, user };
          }
        }
      }

      const justLoggedOutAt = justLoggedOutAtRef.current;
      if (justLoggedOutAt != null && Date.now() - justLoggedOutAt < LOGOUT_IGNORE_MS) {
        console.log('🧨 OAuth getSession: acabo de cerrar sesión → rechazo sesión fantasma');
        try {
          await supabase.auth.signOut({ scope: 'local' });
        } catch (_) {}
        await clearSupabaseAuthStorage();
        await syncFromSession(null);
        throw new Error('OAuth ignorado tras cierre de sesión.');
      }
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session?.user) {
        console.log('🟢 OAuth fallback: sesión ya presente, sincronizando.');
        await syncFromSession(sessionData.session);
        return { session: sessionData.session, user: sessionData.session.user };
      }

      throw new Error('OAuth volvió sin code ni tokens.');
    };

    try {
      setLoading(true);
      const allowed = ['google', 'apple'];
      if (!allowed.includes(provider)) throw new Error('Proveedor no habilitado.');

      // Expo Go: OAuth nativo + waitomo:// no es fiable. En web (npm run web) sí usamos Google
      // en el navegador; no bloquear por appOwnership === 'expo'.
      if (Constants.appOwnership === 'expo' && Platform.OS !== 'web') {
        throw new Error(
          'Google/Apple login no está soportado en Expo Go. Usá un development build (npm run start:dev-client) o la app instalada.',
        );
      }

      const redirectTo = getOAuthRedirectUriForSupabase();
      console.log('🟡 OAUTH redirectTo =>', redirectTo);
      if (Platform.OS === 'web' && typeof sessionStorage !== 'undefined') {
        try {
          sessionStorage.setItem(WEB_OAUTH_START_REDIRECT_KEY, redirectTo);
        } catch (_) {}
      }

      const oauthOptions =
        Platform.OS === 'web'
          ? { redirectTo, skipBrowserRedirect: false }
          : { redirectTo, skipBrowserRedirect: true };
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: oauthOptions,
      });
      if (error) throw error;
      if (Platform.OS === 'web') {
        // En web el navegador redirige automáticamente al proveedor.
        // No usar openAuthSessionAsync porque dispara flujo nativo y rompe localhost.
        return { session: null, user: null };
      }
      if (!data?.url) throw new Error('OAuth: proveedor no devolvió URL.');

      WebBrowser.maybeCompleteAuthSession();

      // Nativo: SIEMPRE `openAuthSessionAsync` (Custom Tabs / ASWebAuthenticationSession). Expo documenta
      // que en Android esto ya usa Linking internamente; `openBrowserAsync` + listener manual no recibe
      // el `waitomo://` y termina en timeout (el error que viste en LogBox).
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo, { showInRecents: true });

      if (result.type !== 'success' || !result.url) {
        console.log('🟠 OAuth openAuthSessionAsync result:', result.type, result.url ? '(con url)' : '(sin url)');
        if (result.type === 'cancel' || result.type === 'dismiss') {
          throw new Error(
            'OAuth se cerró sin completar. En web, el login debe terminar en la misma URL de la app (no en una landing intermedia).',
          );
        }
        throw new Error(
          'OAuth: sin URL de retorno. Si te quedaste en la web de bienvenida, revisá en Supabase que Redirect URLs incluya exactamente: ' +
            redirectTo,
        );
      }

      const returnedUrl = result.url;

      console.log('🟡 OAuth [DEBUG] processing return URL');
      return await finishOAuthWithReturnUrl(returnedUrl);
    } finally {
      setLoading(false);
    }
  };

  // -------------------------
  // LOGOUT ✅ DEFINITIVO
  // -------------------------
  const logout = async () => {
    console.log('🚪 logout: global->local + limpiar storage');
    justLoggedOutAtRef.current = Date.now();

    const uidBeforeLogout = session?.user?.id || null;
    // Web: borrar token y restos OAuth ANTES de signOut (evita que el cliente re-escriba sesión al revocar).
    await clearSupabaseAuthStorage();
    if (uidBeforeLogout) {
      try {
        await clearActiveAppMode(uidBeforeLogout);
      } catch (_) {}
      try {
        const k = impersonateOrgStorageKey(uidBeforeLogout);
        if (k) await AsyncStorage.removeItem(k);
      } catch (_) {}
    }
    impersonatingOrgIdRef.current = null;
    setImpersonatingOrgId(null);

    // ✅ Limpiar estado YA para que la UI no vea sesión (evita que "Ya tengo cuenta" mande al panel)
    setSession(null);
    platformAdminActiveRef.current = null;
    setPlatformAdminActive(null);
    setProfile(null);
    setRole(null);
    setUserPlans([]);
    setActivePlanId(null);
    setOrganization(null);
    setOwnedOrganizations([]);
    setOrganizationMemberships([]);
    setOwnedOrgsLoading(false);
    setActiveAppModeState(null);
    setInitialProfileSyncDone(true);
    setActiveAppModeHydrated(true);
    setAuthSessionRestored(true);
    lastFetchedUserIdRef.current = null;
    lastAvatarCleanupUserIdRef.current = null;

    try {
      await supabase.auth.signOut({ scope: 'global' });
    } catch (e) {
      console.log('🟠 logout signOut(global) error:', e?.message || e);
    }
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (e) {
      console.log('🟠 logout signOut(local) error:', e?.message || e);
    } finally {
      await clearSupabaseAuthStorage();
      await setPlanActualStorage(null);
      await syncFromSession(null);
      setTimeout(() => { justLoggedOutAtRef.current = null; }, LOGOUT_IGNORE_MS);
      // `navigationRef.isReady()` a veces es false en el primer tick tras limpiar estado: un solo reset
      // no corre y el stack queda en staff/cliente sin sesión → pantalla en blanco. Reintentar hasta listo.
      void resetNavigationRootToWelcome({ maxWaitMs: 10000 });
    }
  };

  // ROLES
  const isAdmin = () => role === 'admin' || role === 'superadmin';
  const isCoach = () => role === 'coach';
  const isSuperAdmin = () => role === 'superadmin';
  /** Legado `profiles.role = superadmin` o fila activa en `platform_admins` (ver roadmap panel plataforma). */
  const isPlatformAdmin = () =>
    role === 'superadmin' ||
    platformAdminActiveRef.current === true ||
    platformAdminActive === true;

  const signInDev = async (arg) => {
    let devRole = 'superadmin';
    let planActual = null;

    if (typeof arg === 'string') devRole = arg;
    else if (arg && typeof arg === 'object') {
      if (arg.role) devRole = arg.role;
      if (arg.planActual) planActual = arg.planActual;
    }

    const fakeUser = { id: DEV_USER_ID, email: 'dev@waitomo.local' };

    setSession({ user: fakeUser });
    setProfile({
      id: DEV_USER_ID,
      full_name: 'Dev User',
      role: devRole,
      plan_actual: planActual,
    });
    setRole(devRole);
    setUserPlans([]);

    const pAct = planActual ? String(planActual) : null;
    setActivePlanId(pAct);
    await setPlanActualStorage(pAct);

    lastFetchedUserIdRef.current = DEV_USER_ID;
    setInitialProfileSyncDone(true);
    await refreshPlatformAdminFromSession(DEV_USER_ID);
    return fakeUser;
  };

  const deleteAccount = async () => {
    const token = session?.access_token || null;
    if (!token) {
      throw new Error('No hay sesión activa');
    }
    const url = `${SUPABASE_URL}/functions/v1/delete-user`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.log('❌ delete-user API:', res.status, json?.error || json);
      throw new Error(json?.error || `Error ${res.status}`);
    }
    console.log('✅ delete-user API: cuenta eliminada en el servidor');
    await logout();
  };

  const value = useMemo(
    () => ({
      session,
      user: session?.user || null,
      profile,
      organization,
      role,
      loading,

      userPlans,

      // ✅ CANÓNICO
      activePlanId,

      /** Doble rol: cliente en profiles.organization_id + dueño de otra org */
      ownedOrganizations,
      /** Solo orgs con owner_id = usuario (FitEngine propio). */
      organizationsOwnedByUser,
      /** Coach/admin: falta crear/completar espacio propio (no confundir con staff en Waitomo). */
      needsFitEngineSpaceSetup,
      organizationMemberships,
      ownedOrgsLoading,
      isDualHatUser,
      hasStaffMembership,
      hasClientMembership,
      activeAppMode,
      activeAppModeHydrated,
      authNavigationReady,
      /** false hasta que syncFromSession termine el fetch de perfil (o decida skip por ya sincronizado). */
      initialProfileSyncDone,
      /** false hasta el primer restore de sesión; evita welcome “invitado” con session aún null. */
      authSessionRestored,
      persistActiveAppMode,

      register,
      login,
      signInWithProvider,
      logout,
      deleteAccount,

      ensureProfile,
      updateProfile,
      updateProfileData,
      uploadAvatar,
      refreshOrganization,
      refreshProfile,
      joinOrganizationWithInviteCode,

      isAdmin,
      isCoach,
      isSuperAdmin,
      isPlatformAdmin,
      /** null = aún no consultado o error; true/false = fila en `platform_admins`. */
      platformAdminActive,
      /** Fase 5: contexto de org “como si” fuera del perfil (solo plataforma). */
      impersonatingOrgId,
      startImpersonation,
      stopImpersonation,
      signInDev,
    }),
    [
      session,
      profile,
      organization,
      role,
      platformAdminActive,
      impersonatingOrgId,
      loading,
      userPlans,
      activePlanId,
      ownedOrganizations,
      organizationsOwnedByUser,
      needsFitEngineSpaceSetup,
      organizationMemberships,
      ownedOrgsLoading,
      isDualHatUser,
      hasStaffMembership,
      hasClientMembership,
      activeAppMode,
      activeAppModeHydrated,
      authNavigationReady,
      initialProfileSyncDone,
      authSessionRestored,
      persistActiveAppMode,
      refreshOrganization,
      refreshProfile,
      joinOrganizationWithInviteCode,
      startImpersonation,
      stopImpersonation,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);