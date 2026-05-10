import React, { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { navigationRef } from '../navigationRef';

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
        if (!navigationRef.isReady()) return;
        const routeName = navigationRef.getCurrentRoute()?.name || '';
        const isEntryScreen =
          routeName === 'Splash' ||
          routeName === 'WelcomeGlobal' ||
          routeName === 'Welcome' ||
          routeName === 'WelcomeScreen' ||
          routeName === 'Login' ||
          routeName === 'LoginScreen' ||
          routeName === 'JoinWithInvite' ||
          routeName === 'PublicDirectory' ||
          routeName === 'Directory' ||
          routeName === 'RegistroOwner' ||
          routeName === 'ConfiguraTuEspacio';
        if (isEntryScreen) return;
        try {
          navigationRef.resetRoot({ index: 0, routes: [{ name: 'WelcomeGlobal' }] });
        } catch (e) {
          // no romper
        }
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
