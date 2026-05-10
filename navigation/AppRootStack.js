// navigation/AppRootStack.js — Stack raíz (rutas y nombres iguales que antes en App.js)
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import WelcomeScreen from '../screens/auth/WelcomeScreen';
import WelcomeGlobalScreen from '../screens/auth/WelcomeGlobalScreen';
import WelcomeClientJoinScreen from '../screens/auth/WelcomeClientJoinScreen';
import WelcomeOrganizationScreen from '../screens/auth/WelcomeOrganizationScreen';
import WelcomeDualChoiceScreen from '../screens/auth/WelcomeDualChoiceScreen';
import HomeScreen from '../screens/client/HomeScreen';

import ClientScreen from '../screens/client/ClientScreen';
import ClientTabs from '../screens/client/ClientTabs';

import PlanSelectorScreen from '../screens/client/PlanSelectorScreen';
import PlanDetailScreen from '../screens/client/PlanDetailScreen';

import CalendarioScreen from '../screens/client/CalendarioScreen';
import TrabajoDelDiaScreen from '../screens/client/TrabajoDelDiaScreen';
import HistorialScreen from '../screens/client/HistorialScreen';
import ProgresoScreen from '../screens/client/ProgresoScreen';
import PerfilUsuarioScreen from '../screens/client/PerfilUsuarioScreen';
import ConfigScreen from '../screens/client/ConfigScreen';
import AboutFitEngineScreen from '../screens/client/AboutFitEngineScreen';
import PrivacyScreen from '../screens/client/PrivacyScreen';
import TermsScreen from '../screens/client/TermsScreen';
import SeguridadScreen from '../screens/client/SeguridadScreen';

import FreeClassRequestScreen from '../screens/client/FreeClassRequestScreen';
import AbonosPasesScreen from '../screens/client/AbonosPasesScreen';
import PagoScreen from '../screens/client/PagoScreen';

import RegistroInicialScreen from '../screens/auth/RegistroInicialScreen';
import RegistroCompletoScreen from '../screens/auth/RegistroCompletoScreen';
import CreaCuentaScreen from '../screens/auth/CreaCuentaScreen';
import RegistroDesdeCiclo from '../screens/auth/RegistroDesdeCiclo';
import RegistroEvolucionScreen from '../screens/auth/RegistroEvolucionScreen';

import ReservaScreen from '../screens/client/ReservaScreen';
import ReservaClaseScreen from '../screens/client/ReservaClaseScreen';

import DetalleAbonoScreen from '../screens/client/DetalleAbonoScreen';

import NovedadesScreen from '../screens/client/NovedadesScreen';
import ChatCanalesScreen from '../screens/client/ChatCanalesScreen';
import ChatScreen from '../screens/client/ChatScreen';

import {
  getAdminScreenWithShell,
  getAdminResumenScreenWithShell,
  getAdminNovedadesScreenWithShell,
  getAdminPlanesScreenWithShell,
  AdminLiteScreenWithShell,
  AdminFinanzasScreenWithShell,
  GymConfigScreenWithShell,
  AdminAbonosScreenWithShell,
  AsignarCoachesScreenWithShell,
  OrgMembersScreenWithShell,
  OrgMemberDetailScreenWithShell,
  AdminObservabilityScreenWithShell,
  AdminMembershipFreezeScreenWithShell,
  AdminReportesScreenWithShell,
  AdminRetentionScreenWithShell,
  AdminCommissionsScreenWithShell,
  AdminStripeSettingsScreenWithShell,
  AdminMercadoPagoSettingsScreenWithShell,
  AdminBadgesScreenWithShell,
} from './staffScreenShell';

import SplashScreen from '../screens/auth/SplashScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import CreaCuentaStaffScreen from '../screens/auth/CreaCuentaStaffScreen';
import AdminLoginScreen from '../screens/admin/AdminLoginScreen';
import RegistroOwnerScreen from '../screens/auth/RegistroOwnerScreen';
import ConfiguraTuEspacioScreen from '../screens/auth/ConfiguraTuEspacioScreen';
import JoinWithInviteCodeScreen from '../screens/auth/JoinWithInviteCodeScreen';
import PublicDirectoryScreen from '../screens/client/PublicDirectoryScreen';

const Stack = createNativeStackNavigator();

/**
 * @param {{
 *   screenOptions: import('@react-navigation/native-stack').NativeStackNavigationOptions,
 *   registroOwnerBackgroundColor?: string,
 * }} props
 */
export default function AppRootStack({ screenOptions, registroOwnerBackgroundColor }) {
  return (
    <Stack.Navigator initialRouteName="Splash" screenOptions={screenOptions}>
      {/* Entrada pública */}
      <Stack.Group>
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen name="WelcomeGlobal" component={WelcomeGlobalScreen} />
        <Stack.Screen name="WelcomeClientJoin" component={WelcomeClientJoinScreen} />
        <Stack.Screen name="WelcomeOrganization" component={WelcomeOrganizationScreen} />
        <Stack.Screen name="WelcomeOrganizationScreen" component={WelcomeOrganizationScreen} />
        <Stack.Screen name="WelcomeDualChoice" component={WelcomeDualChoiceScreen} />
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="WelcomeScreen" component={WelcomeScreen} />

        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="HomeScreen" component={HomeScreen} />

        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="LoginScreen" component={LoginScreen} />

        <Stack.Screen name="JoinWithInvite" component={JoinWithInviteCodeScreen} />
        <Stack.Screen name="PublicDirectory" component={PublicDirectoryScreen} />

        <Stack.Screen name="CreaCuentaStaff" component={CreaCuentaStaffScreen} />
        <Stack.Screen name="CreaCuentaStaffScreen" component={CreaCuentaStaffScreen} />

        <Stack.Screen name="AdminLogin" component={AdminLoginScreen} />
        <Stack.Screen name="AdminLoginScreen" component={AdminLoginScreen} />
        <Stack.Screen
          name="RegistroOwner"
          component={RegistroOwnerScreen}
          options={{
            contentStyle: {
              backgroundColor: registroOwnerBackgroundColor,
              flex: 1,
              overflow: 'hidden',
            },
          }}
        />
        <Stack.Screen name="ConfiguraTuEspacio" component={ConfiguraTuEspacioScreen} />
      </Stack.Group>

      {/* Cliente */}
      <Stack.Group>
        <Stack.Screen name="Client" component={ClientScreen} />
        <Stack.Screen name="ClientScreen" component={ClientScreen} />

        <Stack.Screen name="ClientTabs" component={ClientTabs} />
        <Stack.Screen name="ClientTabsScreen" component={ClientTabs} />

        <Stack.Screen name="PerfilUsuario" component={PerfilUsuarioScreen} />
        <Stack.Screen name="Perfil" component={PerfilUsuarioScreen} />
        <Stack.Screen name="PerfilUsuarioScreen" component={PerfilUsuarioScreen} />

        <Stack.Screen name="Config" component={ConfigScreen} />
        <Stack.Screen name="ConfigScreen" component={ConfigScreen} />
        <Stack.Screen name="AboutFitEngine" component={AboutFitEngineScreen} />
        <Stack.Screen name="PrivacyPolicy" component={PrivacyScreen} />
        <Stack.Screen name="PrivacyPolicyScreen" component={PrivacyScreen} />
        <Stack.Screen name="TermsOfUse" component={TermsScreen} />
        <Stack.Screen name="TermsOfUseScreen" component={TermsScreen} />

        <Stack.Screen name="Seguridad" component={SeguridadScreen} />
        <Stack.Screen name="SeguridadScreen" component={SeguridadScreen} />

        <Stack.Screen name="PlanSelector" component={PlanSelectorScreen} />
        <Stack.Screen name="PlanSelectorScreen" component={PlanSelectorScreen} />

        <Stack.Screen name="PlanDetail" component={PlanDetailScreen} />
        <Stack.Screen name="PlanDetailScreen" component={PlanDetailScreen} />

        <Stack.Screen name="CreateAccount" component={CreaCuentaScreen} />
        <Stack.Screen name="CreaAccount" component={CreaCuentaScreen} />
        <Stack.Screen name="CreaCuentaScreen" component={CreaCuentaScreen} />

        <Stack.Screen name="RegistroInicial" component={RegistroInicialScreen} />
        <Stack.Screen name="RegistroInicialScreen" component={RegistroInicialScreen} />

        <Stack.Screen name="RegistroCompleto" component={RegistroCompletoScreen} />
        <Stack.Screen name="RegistroCompletoScreen" component={RegistroCompletoScreen} />

        <Stack.Screen name="RegistroDesdeCiclo" component={RegistroDesdeCiclo} />
        <Stack.Screen name="RegistroEvolucion" component={RegistroEvolucionScreen} />

        <Stack.Screen name="AbonosPases" component={AbonosPasesScreen} />
        <Stack.Screen name="AbonosPasesScreen" component={AbonosPasesScreen} />

        <Stack.Screen name="Pago" component={PagoScreen} />
        <Stack.Screen name="PagoScreen" component={PagoScreen} />

        <Stack.Screen name="DetalleAbono" component={DetalleAbonoScreen} />
        <Stack.Screen name="DetalleAbonoScreen" component={DetalleAbonoScreen} />

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

        <Stack.Screen name="Calendario" component={CalendarioScreen} />
        <Stack.Screen name="CalendarioScreen" component={CalendarioScreen} />

        <Stack.Screen name="TrabajoDelDia" component={TrabajoDelDiaScreen} />
        <Stack.Screen name="TrabajoDelDiaScreen" component={TrabajoDelDiaScreen} />

        <Stack.Screen name="Historial" component={HistorialScreen} />
        <Stack.Screen name="HistorialScreen" component={HistorialScreen} />

        <Stack.Screen name="Progreso" component={ProgresoScreen} />
        <Stack.Screen name="ProgresoScreen" component={ProgresoScreen} />

        <Stack.Screen name="FreeClassRequest" component={FreeClassRequestScreen} />
        <Stack.Screen name="FreeClassRequestScreen" component={FreeClassRequestScreen} />

        <Stack.Screen name="Reserva" component={ReservaScreen} />
        <Stack.Screen name="ReservaScreen" component={ReservaScreen} />

        <Stack.Screen name="ReservaClase" component={ReservaClaseScreen} />
        <Stack.Screen name="ReservaClaseScreen" component={ReservaClaseScreen} />
      </Stack.Group>

      {/* Admin */}
      <Stack.Group>
        <Stack.Screen name="Admin" getComponent={getAdminScreenWithShell} />
        <Stack.Screen name="AdminScreen" getComponent={getAdminScreenWithShell} />

        <Stack.Screen name="AdminLite" component={AdminLiteScreenWithShell} />
        <Stack.Screen name="AdminLiteScreen" component={AdminLiteScreenWithShell} />

        <Stack.Screen name="AdminFinanzas" component={AdminFinanzasScreenWithShell} />
        <Stack.Screen name="AdminFinanzasScreen" component={AdminFinanzasScreenWithShell} />
        <Stack.Screen name="AdminResumen" getComponent={getAdminResumenScreenWithShell} />
        <Stack.Screen name="AdminResumenScreen" getComponent={getAdminResumenScreenWithShell} />
        <Stack.Screen name="AdminNovedades" getComponent={getAdminNovedadesScreenWithShell} />
        <Stack.Screen name="AdminNovedadesScreen" getComponent={getAdminNovedadesScreenWithShell} />
        <Stack.Screen name="GymConfig" component={GymConfigScreenWithShell} />
        <Stack.Screen name="GymConfigScreen" component={GymConfigScreenWithShell} />
        <Stack.Screen name="AdminPlanes" getComponent={getAdminPlanesScreenWithShell} />
        <Stack.Screen name="AdminPlanesScreen" getComponent={getAdminPlanesScreenWithShell} />
        <Stack.Screen name="AdminAbonos" component={AdminAbonosScreenWithShell} />
        <Stack.Screen name="AdminAbonosScreen" component={AdminAbonosScreenWithShell} />

        <Stack.Screen name="AsignarCoaches" component={AsignarCoachesScreenWithShell} />
        <Stack.Screen name="AsignarCoachesScreen" component={AsignarCoachesScreenWithShell} />
        <Stack.Screen name="OrgMembers" component={OrgMembersScreenWithShell} />
        <Stack.Screen name="OrgMembersScreen" component={OrgMembersScreenWithShell} />
        <Stack.Screen name="OrgMemberDetail" component={OrgMemberDetailScreenWithShell} />
        <Stack.Screen name="OrgMemberDetailScreen" component={OrgMemberDetailScreenWithShell} />
        <Stack.Screen name="AdminObservability" component={AdminObservabilityScreenWithShell} />
        <Stack.Screen name="AdminObservabilityScreen" component={AdminObservabilityScreenWithShell} />
        <Stack.Screen name="AdminMembershipFreeze" component={AdminMembershipFreezeScreenWithShell} />
        <Stack.Screen name="AdminMembershipFreezeScreen" component={AdminMembershipFreezeScreenWithShell} />
        <Stack.Screen name="AdminReportes" component={AdminReportesScreenWithShell} />
        <Stack.Screen name="AdminReportesScreen" component={AdminReportesScreenWithShell} />
        <Stack.Screen name="AdminRetention" component={AdminRetentionScreenWithShell} />
        <Stack.Screen name="AdminRetentionScreen" component={AdminRetentionScreenWithShell} />
        <Stack.Screen name="AdminCommissions" component={AdminCommissionsScreenWithShell} />
        <Stack.Screen name="AdminCommissionsScreen" component={AdminCommissionsScreenWithShell} />
        <Stack.Screen name="AdminStripeSettings" component={AdminStripeSettingsScreenWithShell} />
        <Stack.Screen name="AdminStripeSettingsScreen" component={AdminStripeSettingsScreenWithShell} />
        <Stack.Screen name="AdminMercadoPagoSettings" component={AdminMercadoPagoSettingsScreenWithShell} />
        <Stack.Screen name="AdminMercadoPagoSettingsScreen" component={AdminMercadoPagoSettingsScreenWithShell} />
        <Stack.Screen name="AdminBadges" component={AdminBadgesScreenWithShell} />
        <Stack.Screen name="AdminBadgesScreen" component={AdminBadgesScreenWithShell} />
      </Stack.Group>
    </Stack.Navigator>
  );
}
