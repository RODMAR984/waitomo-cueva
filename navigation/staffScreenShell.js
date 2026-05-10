import React from 'react';
import { Platform, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import StaffWebDesktopShell from '../components/StaffWebDesktopShell';
import BackgroundWrapper from '../components/BackgroundWrapper';
import { useLocale } from '../contexts/LocaleContext';
import { useThemeContext } from '../contexts/ThemeContext';
import AdminLiteScreen from '../screens/admin/AdminLiteScreen';
import AdminFinanzasScreen from '../screens/admin/AdminFinanzasScreen';
import GymConfigScreen from '../screens/admin/GymConfigScreen';
import AdminAbonosScreen from '../screens/admin/AdminAbonosScreen';
import AsignarCoachesScreen from '../screens/admin/AsignarCoachesScreen';
import OrgMembersScreen from '../screens/admin/OrgMembersScreen';
import OrgMemberDetailScreen from '../screens/admin/OrgMemberDetailScreen';
import AdminObservabilityScreen from '../screens/admin/AdminObservabilityScreen';
import AdminMembershipFreezeScreen from '../screens/admin/AdminMembershipFreezeScreen';
import AdminReportesScreen from '../screens/admin/AdminReportesScreen';
import AdminRetentionScreen from '../screens/admin/AdminRetentionScreen';
import AdminCommissionsScreen from '../screens/admin/AdminCommissionsScreen';
import AdminStripeSettingsScreen from '../screens/admin/AdminStripeSettingsScreen';
import AdminMercadoPagoSettingsScreen from '../screens/admin/AdminMercadoPagoSettingsScreen';
import AdminBadgesScreen from '../screens/admin/AdminBadgesScreen';
import { MOBILE_SPACING, MOBILE_TYPE } from '../theme/mobileSpec';
import { WEB_CONTENT_MAX_WIDTH } from '../theme/webSpec';

/** Staff envuelto en rail web: en iOS/Android nativo no se ofrece (solo fitengine.app en navegador). */
function StaffAdminNativePlaceholder({ navigation }) {
  const { t: tStr } = useLocale();
  const { t } = useThemeContext();
  return (
    <BackgroundWrapper screen="Admin">
      <View style={styles.gateWrap}>
        <Text style={[styles.gateTitle, { color: t.text }]}>{tStr('staff_web_only_title')}</Text>
        <Text style={[styles.gateBody, { color: t.subText }]}>{tStr('staff_web_only_body')}</Text>
        <TouchableOpacity
          style={[styles.gateBtn, { borderColor: t.overlayBorder, backgroundColor: t.boxBg }]}
          onPress={() => navigation?.goBack?.()}
          accessibilityRole="button"
        >
          <Text style={[styles.gateBtnText, { color: t.brand }]}>{tStr('staff_web_only_cta')}</Text>
        </TouchableOpacity>
      </View>
    </BackgroundWrapper>
  );
}

const styles = StyleSheet.create({
  gateWrap: {
    flex: 1,
    paddingHorizontal: MOBILE_SPACING.lg,
    paddingTop: MOBILE_SPACING.xl,
    width: '100%',
    maxWidth: WEB_CONTENT_MAX_WIDTH,
    alignSelf: 'center',
  },
  gateTitle: { fontSize: MOBILE_TYPE.title, fontWeight: '900', marginBottom: MOBILE_SPACING.md },
  gateBody: { fontSize: MOBILE_TYPE.body, lineHeight: 22, marginBottom: MOBILE_SPACING.lg },
  gateBtn: {
    alignSelf: 'flex-start',
    paddingVertical: MOBILE_SPACING.sm,
    paddingHorizontal: MOBILE_SPACING.lg,
    borderRadius: 12,
    borderWidth: 1,
  },
  gateBtnText: { fontWeight: '800', fontSize: MOBILE_TYPE.bodyStrong },
});

export function wrapStaffScreen(Component) {
  function StaffScreenWithShell(props) {
    if (Platform.OS !== 'web') {
      return (
        <StaffAdminNativePlaceholder
          navigation={props.navigation}
        />
      );
    }
    return (
      <StaffWebDesktopShell navigation={props.navigation} route={props.route}>
        <Component {...props} />
      </StaffWebDesktopShell>
    );
  }
  StaffScreenWithShell.displayName = `Staff(${(Component.displayName || Component.name || 'Screen')})`;
  return StaffScreenWithShell;
}

let _Admin;
let _AdminResumen;
let _AdminNovedades;
let _AdminPlanes;

export function getAdminScreenWithShell() {
  if (!_Admin) {
    const Comp = require('../screens/admin/AdminScreen').default;
    _Admin = wrapStaffScreen(Comp);
  }
  return _Admin;
}

export function getAdminResumenScreenWithShell() {
  if (!_AdminResumen) {
    const Comp = require('../screens/admin/AdminResumenScreen').default;
    _AdminResumen = wrapStaffScreen(Comp);
  }
  return _AdminResumen;
}

export function getAdminNovedadesScreenWithShell() {
  if (!_AdminNovedades) {
    const Comp = require('../screens/admin/AdminNovedadesScreen').default;
    _AdminNovedades = wrapStaffScreen(Comp);
  }
  return _AdminNovedades;
}

export function getAdminPlanesScreenWithShell() {
  if (!_AdminPlanes) {
    const Comp = require('../screens/admin/AdminPlanesScreen').default;
    _AdminPlanes = wrapStaffScreen(Comp);
  }
  return _AdminPlanes;
}

export const AdminLiteScreenWithShell = wrapStaffScreen(AdminLiteScreen);
export const AdminFinanzasScreenWithShell = wrapStaffScreen(AdminFinanzasScreen);
export const GymConfigScreenWithShell = wrapStaffScreen(GymConfigScreen);
export const AdminAbonosScreenWithShell = wrapStaffScreen(AdminAbonosScreen);
export const AsignarCoachesScreenWithShell = wrapStaffScreen(AsignarCoachesScreen);
export const OrgMembersScreenWithShell = wrapStaffScreen(OrgMembersScreen);
export const OrgMemberDetailScreenWithShell = wrapStaffScreen(OrgMemberDetailScreen);
export const AdminObservabilityScreenWithShell = wrapStaffScreen(AdminObservabilityScreen);
export const AdminMembershipFreezeScreenWithShell = wrapStaffScreen(AdminMembershipFreezeScreen);
export const AdminReportesScreenWithShell = wrapStaffScreen(AdminReportesScreen);
export const AdminRetentionScreenWithShell = wrapStaffScreen(AdminRetentionScreen);
export const AdminCommissionsScreenWithShell = wrapStaffScreen(AdminCommissionsScreen);
export const AdminStripeSettingsScreenWithShell = wrapStaffScreen(AdminStripeSettingsScreen);
export const AdminMercadoPagoSettingsScreenWithShell = wrapStaffScreen(AdminMercadoPagoSettingsScreen);
export const AdminBadgesScreenWithShell = wrapStaffScreen(AdminBadgesScreen);
