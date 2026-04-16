// App.js — Waitomo Claro / Oscuro / Automático
// ✅ FIX: reset global al Welcome cuando session/user cae (logout REAL)
// ✅ Tema desde ThemeContext (theme + t para navegación y opciones)

import React, { useEffect, useMemo, useRef } from 'react';
import { Text, StyleSheet, Image } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { supabaseHealthCheck } from './supabaseClient';

// Contextos
import { ThemeProvider, useThemeContext } from './contexts/ThemeContext';
import { LocaleProvider } from './contexts/LocaleContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { TrainingDataProvider } from './contexts/TrainingDataContext';
import { PlanProvider } from './contexts/PlanContext';

// Screens
import WelcomeScreen from './screens/WelcomeScreen';
import WelcomeGlobalScreen from './screens/WelcomeGlobalScreen';
import WelcomeOrganizationScreen from './screens/WelcomeOrganizationScreen';
import WelcomeDualChoiceScreen from './screens/WelcomeDualChoiceScreen';
import HomeScreen from './screens/HomeScreen';

import ClientScreen from './screens/ClientScreen';
import ClientTabs from './screens/ClientTabs';

import PlanSelectorScreen from './screens/PlanSelectorScreen';
import PlanDetailScreen from './screens/PlanDetailScreen';

import CalendarioScreen from './screens/CalendarioScreen';
import TrabajoDelDiaScreen from './screens/TrabajoDelDiaScreen';
import HistorialScreen from './screens/HistorialScreen';
import ProgresoScreen from './screens/ProgresoScreen';
import PerfilUsuarioScreen from './screens/PerfilUsuarioScreen';
import ConfigScreen from './screens/ConfigScreen';
import AboutFitEngineScreen from './screens/AboutFitEngineScreen';
import PrivacyScreen from './screens/PrivacyScreen';
import TermsScreen from './screens/TermsScreen';
import SeguridadScreen from './screens/SeguridadScreen';

import FreeClassRequestScreen from './screens/FreeClassRequestScreen';
import AbonosPasesScreen from './screens/AbonosPasesScreen';
import PagoScreen from './screens/PagoScreen';

import RegistroInicialScreen from './screens/RegistroInicialScreen';
import RegistroCompletoScreen from './screens/RegistroCompletoScreen';
import CreaCuentaScreen from './screens/CreaCuentaScreen';
import RegistroDesdeCiclo from './screens/RegistroDesdeCiclo';
import RegistroEvolucionScreen from './screens/RegistroEvolucionScreen';

import ReservaScreen from './screens/ReservaScreen';
import ReservaClaseScreen from './screens/ReservaClaseScreen';

// Detalle del abono (inicio / vencimiento / estado)
import DetalleAbonoScreen from './screens/DetalleAbonoScreen';

// Novedades + Chat
import NovedadesScreen from './screens/NovedadesScreen';
import ChatCanalesScreen from './screens/ChatCanalesScreen';
import ChatScreen from './screens/ChatScreen';

// Admin
import AdminScreen from './screens/AdminScreen';
import AdminLiteScreen from './screens/AdminLiteScreen';
import AdminFinanzasScreen from './screens/AdminFinanzasScreen';
import AdminNovedadesScreen from './screens/AdminNovedadesScreen';
import GymConfigScreen from './screens/GymConfigScreen';
import AdminPlanesScreen from './screens/AdminPlanesScreen';
import AdminAbonosScreen from './screens/AdminAbonosScreen';
import AsignarCoachesScreen from './screens/AsignarCoachesScreen';
import OrgMembersScreen from './screens/OrgMembersScreen';

// Splash (marca FitEngine + by WAITOMO)
import SplashScreen from './screens/SplashScreen';
// Login + Crear cuenta staff + Acceso administrador
import LoginScreen from './screens/LoginScreen';
import CreaCuentaStaffScreen from './screens/CreaCuentaStaffScreen';
import AdminLoginScreen from './screens/AdminLoginScreen';
import RegistroOwnerScreen from './screens/RegistroOwnerScreen';
import ConfiguraTuEspacioScreen from './screens/ConfiguraTuEspacioScreen';
import JoinWithInviteCodeScreen from './screens/JoinWithInviteCodeScreen';

import ClientInviteLinkHandler from './components/ClientInviteLinkHandler';

// Imágenes generales (fondos dinámicos)
import { registerGeneralImages } from './utils/getRandomGeneralImage';
import { IMAGENES_POR_PLAN, IMAGEN_WELCOME } from './utils/imagenesFijas';

import { navigationRef } from './navigationRef';

// =====================================
//   PRECARGA DE IMÁGENES (top-level OK)
// =====================================
Object.values(IMAGENES_POR_PLAN).forEach((image) => {
  if (image && typeof image === 'number') {
    const imageSource = Image.resolveAssetSource(image);
    if (imageSource?.uri) Image.prefetch(imageSource.uri);
  }
});

if (IMAGEN_WELCOME && typeof IMAGEN_WELCOME === 'number') {
  const welcomeSource = Image.resolveAssetSource(IMAGEN_WELCOME);
  if (welcomeSource?.uri) Image.prefetch(welcomeSource.uri);
}

registerGeneralImages([
  IMAGEN_WELCOME,
  IMAGENES_POR_PLAN.cross,
  IMAGENES_POR_PLAN.openbox,
  IMAGENES_POR_PLAN.evolucion,
  IMAGENES_POR_PLAN.stretching,
  IMAGENES_POR_PLAN.yoga,
  IMAGENES_POR_PLAN.hyrox,
  IMAGENES_POR_PLAN.oly,
]);

const Stack = createNativeStackNavigator();

// ✅ FIX: cuando user pasa a null (logout real), resetea al Welcome.
// Debounce 500ms para no resetear por un null transitorio (p. ej. durante callback de Google OAuth).
const AUTHGATE_NULL_DEBOUNCE_MS = 500;

function AuthGate({ children }) {
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
        // No resetear si ya estamos en Welcome o Login (usuario puede estar por elegir Google)
        const routeName = navigationRef.getCurrentRoute()?.name || '';
        const isEntryScreen =
          routeName === 'Splash' ||
          routeName === 'WelcomeGlobal' ||
          routeName === 'Welcome' ||
          routeName === 'WelcomeScreen' ||
          routeName === 'Login' ||
          routeName === 'LoginScreen' ||
          routeName === 'JoinWithInvite' ||
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

function AppContent() {
  const { theme, t } = useThemeContext();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        headerTitleText: { color: t.text, fontWeight: '700' },
      }),
    [t]
  );
  const defaultScreenOptions = useMemo(
    () => ({
      headerShown: false,
      headerStyle: {
        backgroundColor: t.overlayBg,
        borderBottomColor: t.overlayBorder,
      },
      headerTintColor: t.text,
      headerTitle: () => <Text style={styles.headerTitleText}>FitEngine</Text>,
    }),
    [t, styles]
  );
  return (
    <PlanProvider>
      <TrainingDataProvider>
          <NavigationContainer
            ref={navigationRef}
            theme={theme}
            onReady={() => {
              try {
                const r = navigationRef.getCurrentRoute?.();
                // eslint-disable-next-line no-console
                console.log('ROUTING_DEBUG NavigationContainer onReady', {
                  route: r?.name,
                  params: r?.params,
                });
              } catch (_) {}
            }}
            onStateChange={() => {
              try {
                const r = navigationRef.getCurrentRoute?.();
                // eslint-disable-next-line no-console
                console.log('ROUTING_DEBUG stateChange', {
                  route: r?.name,
                  params: r?.params,
                });
              } catch (_) {}
            }}
          >
            <ClientInviteLinkHandler />
            <AuthGate>
                <Stack.Navigator
                  initialRouteName="Splash"
                  screenOptions={defaultScreenOptions}
                >
                  {/* Entrada pública */}
                  <Stack.Screen name="Splash" component={SplashScreen} />
                  <Stack.Screen name="WelcomeGlobal" component={WelcomeGlobalScreen} />
                  <Stack.Screen
                    name="WelcomeOrganization"
                    component={WelcomeOrganizationScreen}
                  />
                  <Stack.Screen
                    name="WelcomeOrganizationScreen"
                    component={WelcomeOrganizationScreen}
                  />
                  <Stack.Screen name="WelcomeDualChoice" component={WelcomeDualChoiceScreen} />
                  <Stack.Screen name="Welcome" component={WelcomeScreen} />
                  {/* Alias legacy */}
                  <Stack.Screen name="WelcomeScreen" component={WelcomeScreen} />

                  <Stack.Screen name="Home" component={HomeScreen} />
                  {/* Alias legacy */}
                  <Stack.Screen name="HomeScreen" component={HomeScreen} />

                  <Stack.Screen name="Login" component={LoginScreen} />
                  {/* Alias legacy */}
                  <Stack.Screen name="LoginScreen" component={LoginScreen} />

                  <Stack.Screen name="JoinWithInvite" component={JoinWithInviteCodeScreen} />

                  <Stack.Screen name="CreaCuentaStaff" component={CreaCuentaStaffScreen} />
                  <Stack.Screen name="CreaCuentaStaffScreen" component={CreaCuentaStaffScreen} />

                  <Stack.Screen name="AdminLogin" component={AdminLoginScreen} />
                  <Stack.Screen name="AdminLoginScreen" component={AdminLoginScreen} />
                  <Stack.Screen
                    name="RegistroOwner"
                    component={RegistroOwnerScreen}
                    options={{ contentStyle: { backgroundColor: t.bg, flex: 1, overflow: 'hidden' } }}
                  />
                  <Stack.Screen name="ConfiguraTuEspacio" component={ConfiguraTuEspacioScreen} />

                  {/* Cliente */}
                  <Stack.Screen name="Client" component={ClientScreen} />
                  {/* ✅ Alias para que NO falle si algún archivo navega a "ClientScreen" */}
                  <Stack.Screen name="ClientScreen" component={ClientScreen} />

                  <Stack.Screen name="ClientTabs" component={ClientTabs} />
                  {/* Alias legacy */}
                  <Stack.Screen name="ClientTabsScreen" component={ClientTabs} />

                  <Stack.Screen name="PerfilUsuario" component={PerfilUsuarioScreen} />
                  {/* ✅ Alias clave: tu UI a veces navega a "Perfil" */}
                  <Stack.Screen name="Perfil" component={PerfilUsuarioScreen} />
                  {/* Alias por nombre de archivo */}
                  <Stack.Screen
                    name="PerfilUsuarioScreen"
                    component={PerfilUsuarioScreen}
                  />

                  <Stack.Screen name="Config" component={ConfigScreen} />
                  <Stack.Screen name="ConfigScreen" component={ConfigScreen} />
                  <Stack.Screen name="AboutFitEngine" component={AboutFitEngineScreen} />
                  <Stack.Screen name="PrivacyPolicy" component={PrivacyScreen} />
                  <Stack.Screen name="PrivacyPolicyScreen" component={PrivacyScreen} />
                  <Stack.Screen name="TermsOfUse" component={TermsScreen} />
                  <Stack.Screen name="TermsOfUseScreen" component={TermsScreen} />

                  <Stack.Screen name="Seguridad" component={SeguridadScreen} />
                  {/* Alias legacy */}
                  <Stack.Screen name="SeguridadScreen" component={SeguridadScreen} />

                  {/* Planes */}
                  <Stack.Screen name="PlanSelector" component={PlanSelectorScreen} />
                  {/* Alias legacy */}
                  <Stack.Screen
                    name="PlanSelectorScreen"
                    component={PlanSelectorScreen}
                  />

                  <Stack.Screen name="PlanDetail" component={PlanDetailScreen} />
                  {/* Alias legacy */}
                  <Stack.Screen
                    name="PlanDetailScreen"
                    component={PlanDetailScreen}
                  />

                  {/* Registro / Pago */}
                  <Stack.Screen name="CreateAccount" component={CreaCuentaScreen} />
                  {/* Alias legacy */}
                  <Stack.Screen name="CreaAccount" component={CreaCuentaScreen} />
                  <Stack.Screen
                    name="CreaCuentaScreen"
                    component={CreaCuentaScreen}
                  />

                  <Stack.Screen name="RegistroInicial" component={RegistroInicialScreen} />
                  {/* Alias legacy */}
                  <Stack.Screen
                    name="RegistroInicialScreen"
                    component={RegistroInicialScreen}
                  />

                  <Stack.Screen
                    name="RegistroCompleto"
                    component={RegistroCompletoScreen}
                  />
                  {/* Alias legacy */}
                  <Stack.Screen
                    name="RegistroCompletoScreen"
                    component={RegistroCompletoScreen}
                  />

                  <Stack.Screen name="RegistroDesdeCiclo" component={RegistroDesdeCiclo} />
                  <Stack.Screen
                    name="RegistroEvolucion"
                    component={RegistroEvolucionScreen}
                  />

                  <Stack.Screen name="AbonosPases" component={AbonosPasesScreen} />
                  {/* Alias legacy */}
                  <Stack.Screen
                    name="AbonosPasesScreen"
                    component={AbonosPasesScreen}
                  />

                  <Stack.Screen name="Pago" component={PagoScreen} />
                  {/* Alias legacy */}
                  <Stack.Screen name="PagoScreen" component={PagoScreen} />

                  {/* Detalle del abono activo del usuario */}
                  <Stack.Screen name="DetalleAbono" component={DetalleAbonoScreen} />
                  {/* Alias legacy */}
                  <Stack.Screen
                    name="DetalleAbonoScreen"
                    component={DetalleAbonoScreen}
                  />

                  {/* Novedades + Chat */}
                  <Stack.Screen name="Novedades" component={NovedadesScreen} />
                  <Stack.Screen name="NovedadesScreen" component={NovedadesScreen} />
                  <Stack.Screen
                    name="ChatCanales"
                    component={ChatCanalesScreen}
                    options={{ animation: 'slide_from_right', animationDuration: 220 }}
                  />
                  <Stack.Screen name="ChatCanalesScreen" component={ChatCanalesScreen} />
                  <Stack.Screen
                    name="Chat"
                    component={ChatScreen}
                    options={{ animation: 'slide_from_right', animationDuration: 220 }}
                  />
                  <Stack.Screen name="ChatScreen" component={ChatScreen} />

                  {/* Agenda / Rutinas */}
                  <Stack.Screen name="Calendario" component={CalendarioScreen} />
                  {/* Alias legacy */}
                  <Stack.Screen
                    name="CalendarioScreen"
                    component={CalendarioScreen}
                  />

                  <Stack.Screen name="TrabajoDelDia" component={TrabajoDelDiaScreen} />
                  {/* Alias legacy */}
                  <Stack.Screen
                    name="TrabajoDelDiaScreen"
                    component={TrabajoDelDiaScreen}
                  />

                  <Stack.Screen name="Historial" component={HistorialScreen} />
                  <Stack.Screen name="HistorialScreen" component={HistorialScreen} />

                  <Stack.Screen name="Progreso" component={ProgresoScreen} />
                  <Stack.Screen name="ProgresoScreen" component={ProgresoScreen} />

                  <Stack.Screen
                    name="FreeClassRequest"
                    component={FreeClassRequestScreen}
                  />
                  <Stack.Screen
                    name="FreeClassRequestScreen"
                    component={FreeClassRequestScreen}
                  />

                  {/* Reservas */}
                  <Stack.Screen name="Reserva" component={ReservaScreen} />
                  <Stack.Screen name="ReservaScreen" component={ReservaScreen} />

                  <Stack.Screen name="ReservaClase" component={ReservaClaseScreen} />
                  <Stack.Screen
                    name="ReservaClaseScreen"
                    component={ReservaClaseScreen}
                  />

                  {/* Admin */}
                  <Stack.Screen name="Admin" component={AdminScreen} />
                  <Stack.Screen name="AdminScreen" component={AdminScreen} />

                  <Stack.Screen name="AdminLite" component={AdminLiteScreen} />
                  <Stack.Screen name="AdminLiteScreen" component={AdminLiteScreen} />

                  <Stack.Screen name="AdminFinanzas" component={AdminFinanzasScreen} />
                  <Stack.Screen
                    name="AdminFinanzasScreen"
                    component={AdminFinanzasScreen}
                  />
                  <Stack.Screen name="AdminNovedades" component={AdminNovedadesScreen} />
                  <Stack.Screen name="AdminNovedadesScreen" component={AdminNovedadesScreen} />
                  <Stack.Screen name="GymConfig" component={GymConfigScreen} />
                  <Stack.Screen name="GymConfigScreen" component={GymConfigScreen} />
                  <Stack.Screen name="AdminPlanes" component={AdminPlanesScreen} />
                  <Stack.Screen name="AdminPlanesScreen" component={AdminPlanesScreen} />
                  <Stack.Screen name="AdminAbonos" component={AdminAbonosScreen} />
                  <Stack.Screen name="AdminAbonosScreen" component={AdminAbonosScreen} />

                  <Stack.Screen
                    name="AsignarCoaches"
                    component={AsignarCoachesScreen}
                  />
                  <Stack.Screen
                    name="AsignarCoachesScreen"
                    component={AsignarCoachesScreen}
                  />
                  <Stack.Screen name="OrgMembers" component={OrgMembersScreen} />
                  <Stack.Screen name="OrgMembersScreen" component={OrgMembersScreen} />
                </Stack.Navigator>
              </AuthGate>
            </NavigationContainer>
          </TrainingDataProvider>
      </PlanProvider>
  );
}

export default function App() {
  useEffect(() => {
    supabaseHealthCheck();
  }, []);
  return (
    <AuthProvider>
      <ThemeProvider>
        <LocaleProvider>
          <AppContent />
        </LocaleProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}