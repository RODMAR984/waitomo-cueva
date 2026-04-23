import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';

/**
 * Misma navegación lateral que el panel Admin (bloques / menú).
 * Usada en web escritorio por StaffWebDesktopShell y por AdminScreen (grid móvil / compacto).
 */
export default function useStaffAdminNavTiles(navigation, tStr) {
  const { currentUser, isSuperAdmin, profile, organization, organizationsOwnedByUser } = useAuth();

  const myId = currentUser?.id || null;
  const isSA = !!(myId && isSuperAdmin(myId));
  const isOrgOwner = (organizationsOwnedByUser?.length ?? 0) > 0;
  const isLite = !(isSA || isOrgOwner);

  const canEditGymConfig = useMemo(() => {
    if (!profile?.id) return false;
    if (isSA) return true;
    if (organization?.owner_id === profile.id) return true;
    return (organizationsOwnedByUser || []).some((o) => o?.id === organization?.id);
  }, [isSA, profile?.id, organization?.id, organization?.owner_id, organizationsOwnedByUser]);

  return useMemo(
    () =>
      [
        {
          key: 'resumen',
          ion: 'today-outline',
          title: tStr('admin_resumen_title'),
          sub: tStr('admin_resumen_sub'),
          onPress: () => navigation.navigate('AdminResumen'),
          show: true,
        },
        {
          key: 'perfil',
          ion: 'person-outline',
          title: tStr('admin_mi_perfil'),
          sub: tStr('admin_menu_perfil_sub'),
          onPress: () => navigation.navigate('Perfil'),
          show: true,
        },
        {
          key: 'marca',
          ion: 'color-wand-outline',
          title: tStr('admin_menu_marca_title'),
          sub: tStr('admin_menu_marca_sub'),
          onPress: () => navigation.navigate('GymConfig'),
          show: !!canEditGymConfig,
        },
        {
          key: 'fin',
          ion: 'wallet-outline',
          title: tStr('admin_finanzas'),
          sub: tStr('admin_menu_finanzas_sub'),
          onPress: () => navigation.navigate('AdminFinanzas', { tab: 'cobros' }),
          show: !isLite,
        },
        {
          key: 'mem',
          ion: 'people-outline',
          title: tStr('admin_miembros'),
          sub: tStr('admin_menu_miembros_sub'),
          onPress: () => navigation.navigate('OrgMembers'),
          show: !isLite,
        },
        {
          key: 'nov',
          ion: 'megaphone-outline',
          title: tStr('admin_ver_novedades'),
          sub: tStr('admin_menu_novedades_ver_sub'),
          onPress: () => navigation.navigate('Novedades'),
          show: true,
        },
        {
          key: 'novadm',
          ion: 'create-outline',
          title: tStr('admin_gestionar_novedades'),
          sub: tStr('admin_menu_novedades_edit_sub'),
          onPress: () => navigation.navigate('AdminNovedades'),
          show: !isLite,
        },
        {
          key: 'planes',
          ion: 'list-outline',
          title: tStr('admin_nav_plans'),
          sub: tStr('admin_menu_planes_sub'),
          onPress: () => navigation.navigate('AdminPlanes'),
          show: !isLite,
        },
        {
          key: 'abonos',
          ion: 'ticket-outline',
          title: tStr('admin_nav_abonos'),
          sub: tStr('admin_menu_abonos_sub'),
          onPress: () => navigation.navigate('AdminAbonos'),
          show: !isLite,
        },
        {
          key: 'freeze',
          ion: 'snow-outline',
          title: tStr('admin_nav_membership_freeze'),
          sub: tStr('admin_menu_membership_freeze_sub'),
          onPress: () => navigation.navigate('AdminMembershipFreeze'),
          show: !isLite,
        },
        {
          key: 'reportes',
          ion: 'stats-chart-outline',
          title: tStr('admin_nav_reportes'),
          sub: tStr('admin_menu_reportes_sub'),
          onPress: () => navigation.navigate('AdminReportes'),
          show: !isLite,
        },
        {
          key: 'retention',
          ion: 'mail-unread-outline',
          title: tStr('admin_nav_retention'),
          sub: tStr('admin_menu_retention_sub'),
          onPress: () => navigation.navigate('AdminRetention'),
          show: !isLite,
        },
        {
          key: 'commissions',
          ion: 'pie-chart-outline',
          title: tStr('admin_nav_commissions'),
          sub: tStr('admin_menu_commissions_sub'),
          onPress: () => navigation.navigate('AdminCommissions'),
          show: !isLite,
        },
        {
          key: 'stripe',
          ion: 'card-outline',
          title: tStr('admin_nav_stripe'),
          sub: tStr('admin_menu_stripe_sub'),
          onPress: () => navigation.navigate('AdminStripeSettings'),
          show: !isLite && !!canEditGymConfig,
        },
        {
          key: 'badges',
          ion: 'ribbon-outline',
          title: tStr('admin_nav_badges'),
          sub: tStr('admin_menu_badges_sub'),
          onPress: () => navigation.navigate('AdminBadges'),
          show: !isLite,
        },
        {
          key: 'coaches',
          ion: 'school-outline',
          title: tStr('admin_nav_assign_coaches'),
          sub: tStr('admin_menu_coaches_sub'),
          onPress: () => navigation.navigate('AsignarCoaches'),
          show: !isLite && !!canEditGymConfig,
        },
        {
          key: 'observ',
          ion: 'pulse-outline',
          title: tStr('admin_nav_observability'),
          sub: tStr('admin_menu_observability_sub'),
          onPress: () => navigation.navigate('AdminObservability'),
          show: !isLite,
        },
      ].filter((x) => x.show),
    [navigation, tStr, canEditGymConfig, isLite],
  );
}
