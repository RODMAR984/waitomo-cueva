import React from 'react';
import StaffWebDesktopShell from '../components/StaffWebDesktopShell';
import AdminLiteScreen from '../screens/AdminLiteScreen';
import AdminFinanzasScreen from '../screens/AdminFinanzasScreen';
import GymConfigScreen from '../screens/GymConfigScreen';
import AdminAbonosScreen from '../screens/AdminAbonosScreen';
import AsignarCoachesScreen from '../screens/AsignarCoachesScreen';
import OrgMembersScreen from '../screens/OrgMembersScreen';
import OrgMemberDetailScreen from '../screens/OrgMemberDetailScreen';
import AdminObservabilityScreen from '../screens/AdminObservabilityScreen';
import AdminMembershipFreezeScreen from '../screens/AdminMembershipFreezeScreen';
import AdminReportesScreen from '../screens/AdminReportesScreen';
import AdminRetentionScreen from '../screens/AdminRetentionScreen';
import AdminCommissionsScreen from '../screens/AdminCommissionsScreen';
import AdminStripeSettingsScreen from '../screens/AdminStripeSettingsScreen';
import AdminMercadoPagoSettingsScreen from '../screens/AdminMercadoPagoSettingsScreen';
import AdminBadgesScreen from '../screens/AdminBadgesScreen';

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
    const Comp = require('../screens/AdminScreen').default;
    _Admin = wrapStaffScreen(Comp);
  }
  return _Admin;
}

export function getAdminResumenScreenWithShell() {
  if (!_AdminResumen) {
    const Comp = require('../screens/AdminResumenScreen').default;
    _AdminResumen = wrapStaffScreen(Comp);
  }
  return _AdminResumen;
}

export function getAdminNovedadesScreenWithShell() {
  if (!_AdminNovedades) {
    const Comp = require('../screens/AdminNovedadesScreen').default;
    _AdminNovedades = wrapStaffScreen(Comp);
  }
  return _AdminNovedades;
}

export function getAdminPlanesScreenWithShell() {
  if (!_AdminPlanes) {
    const Comp = require('../screens/AdminPlanesScreen').default;
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
