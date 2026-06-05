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
  const { user, isPostLogoutUiActive } = useAuth() || {};
  const lastUserIdRef = useRef(null);
  const pendingResetRef = useRef(null);

  const maybeResetToWelcome = (immediate) => {
    const run = () => {
      if (lastUserIdRef.current !== null) return;
      if (!navigationRef.isReady()) {
        void resetNavigationRootToWelcome({ maxWaitMs: 8000 });
        return;
      }
      const routeName = navigationRef.getCurrentRoute()?.name || '';
      if (!isProtectedAuthRoute(routeName)) return;
      void resetNavigationRootToWelcome({ maxWaitMs: 8000 });
    };
    if (immediate) {
      run();
      return;
    }
    if (pendingResetRef.current) clearTimeout(pendingResetRef.current);
    pendingResetRef.current = setTimeout(() => {
      pendingResetRef.current = null;
      run();
    }, AUTHGATE_NULL_DEBOUNCE_MS);
  };

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
      const postLogout =
        typeof isPostLogoutUiActive === 'function' && isPostLogoutUiActive();
      maybeResetToWelcome(postLogout);
    }

    return () => {
      if (pendingResetRef.current) {
        clearTimeout(pendingResetRef.current);
        pendingResetRef.current = null;
      }
    };
  }, [user?.id, isPostLogoutUiActive]);

  return children;
}
