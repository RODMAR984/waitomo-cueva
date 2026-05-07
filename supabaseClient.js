// supabaseClient.js — Waitomo (CONFIGURACIÓN ESTABLE)
// - AsyncStorage
// - persistSession / autoRefreshToken
// - SIN AbortController global (Supabase maneja sus propios timeouts)

import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// ✅ EXPORTS (para usar en AuthContext REST directo)
export const SUPABASE_URL = 'https://nfjjkvjsssgxxsuocmhj.supabase.co';

export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5mamprdmpzc3NneHhzdW9jbWhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMjQ5NDcsImV4cCI6MjA3ODgwMDk0N30.4B3dZbIRb_PYWM3U_NfvyfaURlN_Ta7FsBq7EK3UDK8';

// ✅ CLIENTE SUPABASE ESTÁNDAR (SIN aborts manuales)
const isWeb = Platform.OS === 'web';
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Web: procesar callback OAuth en URL.
    // Nativo: deep links / sesión manual, sin parseo de URL web.
    detectSessionInUrl: isWeb,
    ...(isWeb ? {} : { storage: AsyncStorage }),
  },
});

// --------------------------------------------------
// DEBUG SIMPLE (SIN Promise.race)
// --------------------------------------------------
export const supabaseHealthCheck = async () => {
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  };

  try {
    const r1 = await fetch(`${SUPABASE_URL}/auth/v1/health`, { headers });
    console.log('✅ health auth:', r1.status);
  } catch (e) {
    console.log('❌ health auth fail:', e?.message || e);
  }

  try {
    const r2 = await fetch(`${SUPABASE_URL}/rest/v1/`, { headers });
    console.log('✅ health rest:', r2.status);
  } catch (e) {
    console.log('❌ health rest fail:', e?.message || e);
  }
};
