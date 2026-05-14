import React from 'react';
import StaffWebDesktopShell from '../components/StaffWebDesktopShell';
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
import SuperadminScreen from '../screens/admin/SuperadminScreen';
import SuperadminObservabilityScreen from '../screens/admin/SuperadminObservabilityScreen';
import SuperadminTopicScreen from '../screens/admin/SuperadminTopicScreen';
import SuperadminOrgsScreen from '../screens/admin/SuperadminOrgsScreen';
import SuperadminAuditLogScreen from '../screens/admin/SuperadminAuditLogScreen';
import SuperadminFeatureFlagsScreen from '../screens/admin/SuperadminFeatureFlagsScreen';
import SuperadminTicketsScreen from '../screens/admin/SuperadminTicketsScreen';
import SuperadminTicketDetailScreen from '../screens/admin/SuperadminTicketDetailScreen';

/**
 * Misma envoltura en web y en app nativa: `StaffWebDesktopShell` solo muestra el rail lateral
 * en web con ventana ancha; en móvil / nativo renderiza solo children (panel completo).
 */
export function wrapStaffScreen(Component) {
  function StaffScreenWithShell(props) {
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
export const SuperadminScreenWithShell = wrapStaffScreen(SuperadminScreen);
export const SuperadminObservabilityScreenWithShell = wrapStaffScreen(SuperadminObservabilityScreen);
export const SuperadminTopicScreenWithShell = wrapStaffScreen(SuperadminTopicScreen);
export const SuperadminOrgsScreenWithShell = wrapStaffScreen(SuperadminOrgsScreen);
export const SuperadminAuditLogScreenWithShell = wrapStaffScreen(SuperadminAuditLogScreen);
export const SuperadminFeatureFlagsScreenWithShell = wrapStaffScreen(SuperadminFeatureFlagsScreen);
export const SuperadminTicketsScreenWithShell = wrapStaffScreen(SuperadminTicketsScreen);
export const SuperadminTicketDetailScreenWithShell = wrapStaffScreen(SuperadminTicketDetailScreen);
