import React, { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { navigationRef, resetNavigationRootToWelcome } from '../navigationRef';
import { isProtectedAuthRoute } from '../utils/webAuthRoutePersistence';

/** Debounce para no resetear por un null transitorio (p. ej. durante callback de Google OAuth). */
const AUTHGATE_NULL_DEBOUNCE_MS = 500;

/**
 * Cuando `user` pasa a null (logout real), resetea navegación al welcome global si no estamos en pantallas de entrada.
 */
export default function AuthGate({ children }) {
  const { user } = useAuth() || {};
  const lastUserIdRef = useRef(null);
  const pendingResetRef = useRef(null);

  useEffect(() => {
    const prev = lastUserIdRef.current;
    const curr = user?.id || null;

    if (curr) {
      if (pendingResetRef.current) {
        clearTimeout(pendingResetRef.current);
        pendingResetRef.current = null;
      }
      lastUserIdRef.current = curr;
      return;
    }

    lastUserIdRef.current = curr;

    if (prev && !curr) {
      if (pendingResetRef.current) clearTimeout(pendingResetRef.current);
      pendingResetRef.current = setTimeout(() => {
        pendingResetRef.current = null;
        if (lastUserIdRef.current !== null) return;
        if (!navigationRef.isReady()) {
          void resetNavigationRootToWelcome({ maxWaitMs: 8000 });
          return;
        }
        const routeName = navigationRef.getCurrentRoute()?.name || '';
        if (!isProtectedAuthRoute(routeName)) return;
        void resetNavigationRootToWelcome({ maxWaitMs: 8000 });
      }, AUTHGATE_NULL_DEBOUNCE_MS);
    }

    return () => {
      if (pendingResetRef.current) {
        clearTimeout(pendingResetRef.current);
        pendingResetRef.current = null;
      }
    };
  }, [user?.id]);

  return children;
}
