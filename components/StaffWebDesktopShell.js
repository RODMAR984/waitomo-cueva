import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  useWindowDimensions,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeContext } from '../contexts/ThemeContext';
import { useLocale } from '../contexts/LocaleContext';
import { useAuth } from '../contexts/AuthContext';
import useStaffAdminNavTiles from '../hooks/useStaffAdminNavTiles';
import { MOBILE_RADII, MOBILE_TYPE } from '../theme/mobileSpec';
import ImpersonationBanner from './ImpersonationBanner';

const STAFF_WEB_RAIL = 232;
/** Misma anchura que `WEB_DESKTOP_BREAKPOINT`: rail staff solo en ventanas anchas. */
export const STAFF_WEB_DESKTOP_MIN_WIDTH = 1100;
const STAFF_WEB_MIN_WIDTH = STAFF_WEB_DESKTOP_MIN_WIDTH;

const hexToRgba = (hex, alpha = 1) => {
  const clean = String(hex || '').replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
};

/** Pantalla React Navigation → tile.key activo en el rail (si aplica). */
const ROUTE_NAME_TO_TILE_KEY = {
  AdminLite: 'bloques',
  AdminLiteScreen: 'bloques',
  Admin: 'bloques',
  AdminScreen: 'bloques',
  AdminResumen: 'resumen',
  AdminResumenScreen: 'resumen',
  GymConfig: 'marca',
  GymConfigScreen: 'marca',
  AdminFinanzas: 'fin',
  AdminFinanzasScreen: 'fin',
  OrgMembers: 'mem',
  OrgMembersScreen: 'mem',
  OrgMemberDetail: 'mem',
  OrgMemberDetailScreen: 'mem',
  AdminNovedades: 'novedades',
  AdminNovedadesScreen: 'novedades',
  AdminPlanes: 'planes',
  AdminPlanesScreen: 'planes',
  AdminAbonos: 'abonos',
  AdminAbonosScreen: 'abonos',
  AsignarCoaches: 'coaches',
  AsignarCoachesScreen: 'coaches',
  AdminObservability: 'observ',
  AdminObservabilityScreen: 'observ',
  AdminMembershipFreeze: 'freeze',
  AdminMembershipFreezeScreen: 'freeze',
  AdminReportes: 'reportes',
  AdminReportesScreen: 'reportes',
  AdminRetention: 'retention',
  AdminRetentionScreen: 'retention',
  AdminCommissions: 'commissions',
  AdminCommissionsScreen: 'commissions',
  AdminStripeSettings: 'stripe',
  AdminStripeSettingsScreen: 'stripe',
  AdminMercadoPagoSettings: 'mp',
  AdminMercadoPagoSettingsScreen: 'mp',
  AdminBadges: 'badges',
  AdminBadgesScreen: 'badges',
  Superadmin: 'platform',
  SuperadminScreen: 'platform',
  SuperadminObservability: 'platform',
  SuperadminObservabilityScreen: 'platform',
  SuperadminTopic: 'platform',
  SuperadminTopicScreen: 'platform',
  SuperadminOrgs: 'platform',
  SuperadminOrgsScreen: 'platform',
  SuperadminAuditLog: 'platform',
  SuperadminAuditLogScreen: 'platform',
  SuperadminFeatureFlags: 'platform',
  SuperadminFeatureFlagsScreen: 'platform',
  SuperadminTickets: 'platform',
  SuperadminTicketsScreen: 'platform',
  SuperadminTicketDetail: 'platform',
  SuperadminTicketDetailScreen: 'platform',
  Perfil: 'perfil',
  PerfilUsuario: 'perfil',
  Novedades: 'novedades',
  NovedadesScreen: 'novedades',
};

/**
 * Web ancho: rail de navegación staff a la izquierda para todas las pantallas admin envueltas en App.
 * En móvil / nativo / ventana estrecha solo renderiza children.
 */
export default function StaffWebDesktopShell({ navigation, route, children }) {
  const { width } = useWindowDimensions();
  const { t } = useThemeContext();
  const { t: tStr } = useLocale();
  const { logout } = useAuth();
  const isDesktopWeb = Platform.OS === 'web' && width >= STAFF_WEB_MIN_WIDTH;
  const { groups: adminNavGroups } = useStaffAdminNavTiles(navigation, tStr);
  const activeTileKey = ROUTE_NAME_TO_TILE_KEY[route?.name] || null;

  const handleRailLogout = useCallback(() => {
    const run = async () => {
      try {
        await logout();
      } catch (e) {
        console.log('staff rail logout:', e?.message || e);
      }
    };
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const ok = window.confirm(`${tStr('perfil_logout_title')}\n\n${tStr('perfil_logout_message')}`);
      if (ok) void run();
      return;
    }
    Alert.alert(tStr('perfil_logout_title'), tStr('perfil_logout_message'), [
      { text: tStr('common_cancel'), style: 'cancel' },
      { text: tStr('perfil_logout_confirm'), style: 'destructive', onPress: () => void run() },
    ]);
  }, [logout, tStr]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        staffWebShell: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'stretch',
          minHeight: 0,
          ...(Platform.OS === 'web'
            ? {
                width: '100%',
                alignSelf: 'stretch',
                minHeight: '100dvh',
                backgroundColor: 'transparent',
              }
            : null),
        },
        staffWebRail: {
          width: STAFF_WEB_RAIL,
          alignSelf: 'stretch',
          flexDirection: 'column',
          paddingTop: 16,
          paddingBottom: 10,
          paddingHorizontal: 8,
          borderRightWidth: 1,
          borderRightColor: t.border,
          // Fondo de pantalla opaco: `boxBg` en oscuro es cian translúcido y deja ver la foto → “verde con velo”.
          backgroundColor: t.bg,
        },
        staffWebRailCaption: {
          color: t.subText,
          fontSize: MOBILE_TYPE.meta,
          fontWeight: '800',
          letterSpacing: 0.5,
          textTransform: 'uppercase',
          marginBottom: 8,
          paddingHorizontal: 6,
        },
        staffWebRailGroupTitle: {
          color: t.subText,
          fontSize: MOBILE_TYPE.micro,
          fontWeight: '700',
          letterSpacing: 0.5,
          textTransform: 'uppercase',
          marginBottom: 6,
          paddingHorizontal: 6,
          opacity: 0.9,
        },
        staffWebRailScroll: {
          flex: 1,
          minHeight: 0,
          backgroundColor: t.bg,
        },
        staffWebRailLogoutWrap: {
          borderTopWidth: 1,
          borderTopColor: t.border,
          paddingTop: 10,
          marginTop: 4,
        },
        staffWebRailLogoutBtn: {
          flexDirection: 'row',
          alignItems: 'center',
          columnGap: 10,
          paddingVertical: 10,
          paddingHorizontal: 8,
          borderRadius: MOBILE_RADII.sm,
        },
        staffWebRailLogoutText: {
          color: t.danger,
          fontSize: MOBILE_TYPE.caption,
          fontWeight: '700',
          flex: 1,
        },
        staffWebRailItem: {
          flexDirection: 'row',
          alignItems: 'center',
          columnGap: 10,
          paddingVertical: 8,
          paddingHorizontal: 8,
          borderRadius: MOBILE_RADII.sm,
          marginBottom: 4,
        },
        staffWebRailItemActive: {
          backgroundColor: hexToRgba(t.brand, 0.14),
        },
        staffWebRailItemText: {
          color: t.text,
          fontSize: MOBILE_TYPE.caption,
          fontWeight: '600',
          flex: 1,
        },
        staffWebMainColumn: {
          flex: 1,
          minWidth: 0,
          ...(Platform.OS === 'web'
            ? {
                width: '100%',
                alignSelf: 'stretch',
                minHeight: '100dvh',
                backgroundColor: 'transparent',
              }
            : null),
        },
      }),
    [t],
  );

  const main = (
    <>
      <ImpersonationBanner />
      {children}
    </>
  );

  if (!isDesktopWeb) {
    return main;
  }

  return (
    <View style={styles.staffWebShell}>
      <View style={styles.staffWebRail}>
        <Text style={styles.staffWebRailCaption}>{tStr('admin_rail_menu_caption')}</Text>
        <ScrollView
          style={styles.staffWebRailScroll}
          showsVerticalScrollIndicator
          keyboardShouldPersistTaps="handled"
        >
          {adminNavGroups.map((group) => (
            <View key={group.key} style={{ marginBottom: 8 }}>
              <Text style={styles.staffWebRailGroupTitle}>{group.title}</Text>
              {group.tiles.map((tile) => {
                const active = activeTileKey && tile.key === activeTileKey;
                return (
                  <TouchableOpacity
                    key={tile.key}
                    testID={`staff-hub-tile-${tile.key}`}
                    style={[styles.staffWebRailItem, active && styles.staffWebRailItemActive]}
                    onPress={tile.onPress}
                    activeOpacity={0.88}
                  >
                    <Ionicons name={tile.ion} size={20} color={t.brand} />
                    <Text style={styles.staffWebRailItemText} numberOfLines={2}>
                      {tile.title}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </ScrollView>
        <View style={styles.staffWebRailLogoutWrap}>
          <TouchableOpacity
            style={styles.staffWebRailLogoutBtn}
            onPress={handleRailLogout}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={tStr('admin_salir')}
            testID="staff-rail-logout"
          >
            <Ionicons name="log-out-outline" size={20} color={t.danger} />
            <Text style={styles.staffWebRailLogoutText} numberOfLines={1}>
              {tStr('admin_salir')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.staffWebMainColumn}>{main}</View>
    </View>
  );
}
