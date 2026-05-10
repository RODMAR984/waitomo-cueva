// screens/ClientTabs.js — ClientTabs
// Mobile: sin tab bar (comportamiento actual)
// Web desktop: navegación lateral visible para flujo más profesional
import React, { useCallback, useMemo } from 'react';
import { Platform, View, useWindowDimensions } from 'react-native';
import { createBottomTabNavigator, BottomTabBar } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useThemeContext } from '../../contexts/ThemeContext';
import { useLocale } from '../../contexts/LocaleContext';
import {
  WEB_DESKTOP_BREAKPOINT,
  WEB_RAIL_WIDTH,
  WEB_RAIL_NOVEDADES_MAX_HEIGHT_CAP,
} from '../../theme/webSpec';
import { MOBILE_RADII, MOBILE_SIZES, MOBILE_SPACING, MOBILE_TYPE } from '../../theme/mobileSpec';

import ClientNovedadesSidebarWidget from '../../components/ClientNovedadesSidebarWidget';
import ClientScreen from './ClientScreen';
import CalendarioScreen from './CalendarioScreen';
import PerfilUsuarioScreen from './PerfilUsuarioScreen';
import PublicDirectoryScreen from './PublicDirectoryScreen';

const Tab = createBottomTabNavigator();

export default function ClientTabs() {
  const { width, height } = useWindowDimensions();
  const { t } = useThemeContext();
  const { locale, t: tStr } = useLocale();
  const isWebDesktop = Platform.OS === 'web' && width >= WEB_DESKTOP_BREAKPOINT;

  const webRailShellStyle = useMemo(
    () => ({
      width: WEB_RAIL_WIDTH,
      minWidth: WEB_RAIL_WIDTH,
      maxWidth: WEB_RAIL_WIDTH,
      flexGrow: 0,
      flexShrink: 0,
      alignSelf: 'stretch',
      flexDirection: 'column',
      gap: MOBILE_SPACING.sm,
      borderRightWidth: 1,
      borderRightColor: t.overlayBorder,
      backgroundColor: t.boxBg,
      paddingTop: MOBILE_SPACING.lg,
      paddingBottom: MOBILE_SPACING.sm,
      paddingHorizontal: MOBILE_SPACING.sm,
    }),
    [t],
  );

  /** Más aire en pantallas altas; nunca se come el tab bar en laptops bajas. */
  const webNovedadesMaxHeight = useMemo(() => {
    if (!isWebDesktop || !height) return WEB_RAIL_NOVEDADES_MAX_HEIGHT_CAP;
    const fromViewport = Math.round(height * 0.3);
    return Math.min(WEB_RAIL_NOVEDADES_MAX_HEIGHT_CAP, Math.max(208, fromViewport));
  }, [isWebDesktop, height]);

  const screenOptions = useMemo(
    () => ({
      headerShown: false,
      tabBarShowLabel: isWebDesktop,
      tabBarPosition: isWebDesktop ? 'left' : 'bottom',
      tabBarStyle: isWebDesktop
        ? {
            width: '100%',
            flexGrow: 0,
            flexShrink: 0,
            borderRightWidth: 0,
            borderTopWidth: 0,
            backgroundColor: 'transparent',
            paddingTop: 0,
            paddingBottom: 0,
            paddingHorizontal: 0,
            elevation: 0,
            shadowOpacity: 0,
          }
        : { display: 'none' },
      tabBarLabelPosition: isWebDesktop ? 'beside-icon' : 'below-icon',
      tabBarLabelStyle: {
        fontSize: MOBILE_TYPE.body,
        fontWeight: '700',
      },
      tabBarItemStyle: isWebDesktop
        ? {
            justifyContent: 'flex-start',
            marginHorizontal: MOBILE_SPACING.sm / 2,
            marginVertical: MOBILE_SPACING.sm / 2,
            borderRadius: MOBILE_RADII.lg,
            minHeight: MOBILE_SIZES.controlHeight,
            paddingHorizontal: MOBILE_SPACING.sm + 2,
          }
        : undefined,
      tabBarActiveTintColor: t.text,
      tabBarInactiveTintColor: t.subText,
      tabBarActiveBackgroundColor: isWebDesktop ? t.faintStrong : undefined,
      tabBarIconStyle: isWebDesktop ? { marginBottom: 0 } : undefined,
    }),
    [isWebDesktop, t],
  );

  const renderTabBar = useCallback(
    (props) => {
      if (!isWebDesktop) {
        return <BottomTabBar {...props} />;
      }
      return (
        <View style={webRailShellStyle}>
          <View style={{ flex: 1, minHeight: 0, width: '100%' }}>
            <BottomTabBar {...props} />
          </View>
          <View
            style={{
              flexShrink: 0,
              width: '100%',
              maxHeight: webNovedadesMaxHeight,
              minHeight: 0,
              overflow: 'hidden',
            }}
          >
            <ClientNovedadesSidebarWidget />
          </View>
        </View>
      );
    },
    [isWebDesktop, webRailShellStyle, webNovedadesMaxHeight],
  );

  return (
    <Tab.Navigator screenOptions={screenOptions} tabBar={renderTabBar}>
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
        name="Directory"
        component={PublicDirectoryScreen}
        options={{
          tabBarLabel: tStr('client_directory_tab'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="compass-outline" color={color} size={size || 20} />
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
