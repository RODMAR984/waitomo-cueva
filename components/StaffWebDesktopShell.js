import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeContext } from '../contexts/ThemeContext';
import { useLocale } from '../contexts/LocaleContext';
import useStaffAdminNavTiles from '../hooks/useStaffAdminNavTiles';

const STAFF_WEB_RAIL = 232;
const STAFF_WEB_MIN_WIDTH = 1100;

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
  const isDesktopWeb = Platform.OS === 'web' && width >= STAFF_WEB_MIN_WIDTH;
  const { groups: adminNavGroups } = useStaffAdminNavTiles(navigation, tStr);
  const activeTileKey = ROUTE_NAME_TO_TILE_KEY[route?.name] || null;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        staffWebShell: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'stretch',
          minHeight: 0,
        },
        staffWebRail: {
          width: STAFF_WEB_RAIL,
          paddingTop: 16,
          paddingBottom: 12,
          paddingHorizontal: 8,
          borderRightWidth: 1,
          borderRightColor: t.overlayBorder,
          backgroundColor: t.boxBg,
        },
        staffWebRailCaption: {
          color: t.subText,
          fontSize: 11,
          fontWeight: '800',
          letterSpacing: 0.5,
          textTransform: 'uppercase',
          marginBottom: 8,
          paddingHorizontal: 6,
        },
        staffWebRailGroupTitle: {
          color: t.subText,
          fontSize: 10,
          fontWeight: '700',
          letterSpacing: 0.5,
          textTransform: 'uppercase',
          marginBottom: 6,
          paddingHorizontal: 6,
          opacity: 0.9,
        },
        staffWebRailScroll: {
          flexGrow: 1,
          flexShrink: 1,
        },
        staffWebRailItem: {
          flexDirection: 'row',
          alignItems: 'center',
          columnGap: 10,
          paddingVertical: 8,
          paddingHorizontal: 8,
          borderRadius: 10,
          marginBottom: 4,
        },
        staffWebRailItemActive: {
          backgroundColor: hexToRgba(t.brand, 0.14),
        },
        staffWebRailItemText: {
          color: t.text,
          fontSize: 12,
          fontWeight: '600',
          flex: 1,
        },
        staffWebMainColumn: {
          flex: 1,
          minWidth: 0,
        },
      }),
    [t],
  );

  if (!isDesktopWeb) {
    return children;
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
      </View>
      <View style={styles.staffWebMainColumn}>{children}</View>
    </View>
  );
}
