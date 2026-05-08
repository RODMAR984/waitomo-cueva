// screens/ClientTabs.js — ClientTabs
// Mobile: sin tab bar (comportamiento actual)
// Web desktop: navegación lateral visible para flujo más profesional
import React, { useMemo } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useThemeContext } from '../contexts/ThemeContext';
import { useLocale } from '../contexts/LocaleContext';
import { WEB_DESKTOP_BREAKPOINT, WEB_RAIL_WIDTH } from '../theme/webSpec';

import ClientScreen from './ClientScreen';
import CalendarioScreen from './CalendarioScreen';
import PerfilUsuarioScreen from './PerfilUsuarioScreen';

const Tab = createBottomTabNavigator();

export default function ClientTabs() {
  const { width } = useWindowDimensions();
  const { t } = useThemeContext();
  const { locale, t: tStr } = useLocale();
  const isWebDesktop = Platform.OS === 'web' && width >= WEB_DESKTOP_BREAKPOINT;
  const screenOptions = useMemo(
    () => ({
      headerShown: false,
      tabBarShowLabel: isWebDesktop,
      tabBarPosition: isWebDesktop ? 'left' : 'bottom',
      tabBarStyle: isWebDesktop
        ? {
            width: WEB_RAIL_WIDTH,
            borderRightWidth: 1,
            borderRightColor: t.overlayBorder,
            borderTopWidth: 0,
            backgroundColor: t.boxBg,
            paddingTop: 16,
            paddingBottom: 16,
            paddingHorizontal: 8,
          }
        : { display: 'none' },
      tabBarLabelPosition: isWebDesktop ? 'beside-icon' : 'below-icon',
      tabBarLabelStyle: {
        fontSize: 13,
        fontWeight: '700',
      },
      tabBarItemStyle: isWebDesktop
        ? {
            justifyContent: 'flex-start',
            marginHorizontal: 4,
            marginVertical: 4,
            borderRadius: 10,
            minHeight: 44,
            paddingHorizontal: 10,
          }
        : undefined,
      tabBarActiveTintColor: t.text,
      tabBarInactiveTintColor: t.subText,
      tabBarActiveBackgroundColor: isWebDesktop ? t.faintStrong : undefined,
      tabBarIconStyle: isWebDesktop ? { marginBottom: 0 } : undefined,
    }),
    [isWebDesktop, t],
  );

  return (
    <Tab.Navigator screenOptions={screenOptions}>
      <Tab.Screen
        name="Panel"
        component={ClientScreen}
        options={{
          tabBarLabel: locale === 'en' ? 'Home' : 'Panel',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid-outline" color={color} size={size || 20} />
          ),
        }}
      />
      <Tab.Screen
        name="Calendario"
        component={CalendarioScreen}
        options={{
          tabBarLabel: tStr('client_calendario'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" color={color} size={size || 20} />
          ),
        }}
      />
      <Tab.Screen
        name="Perfil"
        component={PerfilUsuarioScreen}
        options={{
          tabBarLabel: tStr('client_my_profile'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-circle-outline" color={color} size={size || 20} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
