// screens/ClientTabs.js — ClientTabs (SIN TAB BAR visible)
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import ClientScreen from './ClientScreen';
import CalendarioScreen from './CalendarioScreen';
import PerfilUsuarioScreen from './PerfilUsuarioScreen';

const Tab = createBottomTabNavigator();

export default function ClientTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,

        // ✅ ocultar barra inferior completamente
        tabBarStyle: { display: 'none' },
        tabBarShowLabel: false,
      }}
    >
      <Tab.Screen name="Panel" component={ClientScreen} />
      <Tab.Screen name="Calendario" component={CalendarioScreen} />
      <Tab.Screen name="Perfil" component={PerfilUsuarioScreen} />
    </Tab.Navigator>
  );
}
