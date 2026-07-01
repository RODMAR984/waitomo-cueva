import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { emitAdminScrollToLists } from '../utils/adminScrollBus';
import useTrialWriteGuard from './useTrialWriteGuard';
import useTrialProGuard from './useTrialProGuard';
import { TRIAL_PRO_FEATURE_KEYS } from '../utils/trialProFeatures';

function getFocusedRouteName(state) {
  if (!state || typeof state.index !== 'number' || !Array.isArray(state.routes)) return null;
  const r = state.routes[state.index];
  if (r?.state) return getFocusedRouteName(r.state);
  return r?.name ?? null;
}

/**
 * Misma navegación lateral que el panel Admin (panel del día / menú).
 * Usada en web escritorio por StaffWebDesktopShell y por AdminScreen (grid móvil / compacto).
 */
export default function useStaffAdminNavTiles(navigation, tStr) {
  const { session, profile, isSuperAdmin, isPlatformAdmin, organization, organizationsOwnedByUser } =
    useAuth();
  const { guardWrite } = useTrialWriteGuard();
  const { guardPro, proLocked } = useTrialProGuard();

  const myId = session?.user?.id || profile?.id || null;
  const isSA = typeof isSuperAdmin === 'function' ? isSuperAdmin() : false;
  const isOrgOwner = (organizationsOwnedByUser?.length ?? 0) > 0;
  const isLite = !(isSA || isOrgOwner);
  const hasPlatformPanel = typeof isPlatformAdmin === 'function' && isPlatformAdmin();

  const canEditGymConfig = useMemo(() => {
    if (!profile?.id) return false;
    if (isSA) return true;
    if (organization?.owner_id === profile.id) return true;
    return (organizationsOwnedByUser || []).some((o) => o?.id === organization?.id);
  }, [isSA, profile?.id, organization?.id, organization?.owner_id, organizationsOwnedByUser]);

  return useMemo(() => {
    const mkBloquesOnPress = () => {
      const focused = typeof navigation.getState === 'function' ? getFocusedRouteName(navigation.getState()) : null;
      const onBloquesScreen =
        focused === 'AdminLite' ||
        focused === 'AdminLiteScreen' ||
        focused === 'Admin' ||
        focused === 'AdminScreen' ||
        focused === 'Superadmin' ||
        focused === 'SuperadminScreen' ||
        focused === 'SuperadminObservability' ||
        focused === 'SuperadminObservabilityScreen' ||
        focused === 'SuperadminTopic' ||
        focused === 'SuperadminTopicScreen' ||
        focused === 'SuperadminOrgs' ||
        focused === 'SuperadminOrgsScreen' ||
        focused === 'SuperadminAuditLog' ||
        focused === 'SuperadminAuditLogScreen' ||
        focused === 'SuperadminFeatureFlags' ||
        focused === 'SuperadminFeatureFlagsScreen' ||
        focused === 'SuperadminTickets' ||
        focused === 'SuperadminTicketsScreen' ||
        focused === 'SuperadminTicketDetail' ||
        focused === 'SuperadminTicketDetailScreen';
      if (onBloquesScreen) {
        emitAdminScrollToLists();
        return;
      }
      navigation.navigate('AdminLite', { adminFocus: 'lists' });
    };

    const wrap = (fn) => () => guardWrite(fn);
    const proSuffix = proLocked ? tStr('trial_pro_nav_suffix') : '';
    const proTitle = (base) => (proLocked ? `${base}${proSuffix}` : base);

    const groups = [
      ...(hasPlatformPanel
        ? [
            {
              key: 'plataforma',
              title: tStr('admin_group_plataforma'),
              tiles: [
                {
                  key: 'platform',
                  ion: 'earth-outline',
                  title: tStr('admin_nav_superadmin_title'),
                  sub: tStr('admin_nav_superadmin_sub'),
                  onPress: () => navigation.navigate('Superadmin'),
                  show: true,
                },
              ],
            },
          ]
        : []),
      {
        key: 'operacion',
        title: tStr('admin_group_operacion'),
        tiles: [
          { key: 'resumen', ion: 'today-outline', title: tStr('admin_resumen_title'), sub: tStr('admin_resumen_sub'), onPress: () => navigation.navigate('AdminResumen'), show: true },
          { key: 'bloques', ion: 'list-outline', title: tStr('admin_nav_panel_bloques'), sub: tStr('admin_menu_panel_bloques_sub'), onPress: wrap(mkBloquesOnPress), show: true },
          { key: 'mem', ion: 'people-outline', title: tStr('admin_miembros'), sub: tStr('admin_menu_miembros_sub'), onPress: () => navigation.navigate('OrgMembers'), show: !isLite },
          { key: 'novedades', ion: 'newspaper-outline', title: tStr('admin_menu_novedades_title'), sub: tStr('admin_menu_novedades_sub'), onPress: () => navigation.navigate('AdminNovedades'), show: !isLite },
        ],
      },
      {
        key: 'oferta',
        title: tStr('admin_group_oferta'),
        tiles: [
          { key: 'planes', ion: 'pricetags-outline', title: tStr('admin_nav_plans'), sub: tStr('admin_menu_planes_sub'), onPress: wrap(() => navigation.navigate('AdminPlanes')), show: !isLite },
          { key: 'abonos', ion: 'card-outline', title: tStr('admin_nav_abonos'), sub: tStr('admin_menu_abonos_sub'), onPress: wrap(() => navigation.navigate('AdminAbonos')), show: !isLite },
          { key: 'freeze', ion: 'snow-outline', title: proTitle(tStr('admin_nav_membership_freeze')), sub: tStr('admin_menu_freeze_sub'), onPress: () => guardPro(TRIAL_PRO_FEATURE_KEYS.MEMBERSHIP_FREEZE, () => navigation.navigate('AdminMembershipFreeze')), show: !isLite, proLocked: proLocked },
          { key: 'coaches', ion: 'person-add-outline', title: tStr('admin_nav_assign_coaches'), sub: tStr('admin_menu_coaches_sub'), onPress: () => navigation.navigate('AsignarCoaches'), show: !isLite && !!canEditGymConfig },
          { key: 'badges', ion: 'trophy-outline', title: tStr('admin_menu_badges_title'), sub: tStr('admin_menu_badges_sub'), onPress: () => navigation.navigate('AdminBadges'), show: !isLite },
          { key: 'retention', ion: 'mail-outline', title: tStr('admin_menu_retention_title'), sub: tStr('admin_menu_retention_sub'), onPress: () => navigation.navigate('AdminRetention'), show: !isLite },
        ],
      },
      {
        key: 'cobros',
        title: tStr('admin_group_cobros'),
        tiles: [
          { key: 'fin', ion: 'cash-outline', title: tStr('admin_finanzas'), sub: tStr('admin_menu_finanzas_sub'), onPress: wrap(() => navigation.navigate('AdminFinanzas', { tab: 'cobros' })), show: !isLite },
          { key: 'mp', ion: 'wallet-outline', title: tStr('admin_nav_mercadopago'), sub: tStr('admin_menu_mercadopago_sub'), onPress: () => navigation.navigate('AdminMercadoPagoSettings'), show: !isLite && !!canEditGymConfig },
          { key: 'stripe', ion: 'globe-outline', title: tStr('admin_nav_stripe'), sub: tStr('admin_menu_stripe_sub'), onPress: () => navigation.navigate('AdminStripeSettings'), show: !isLite && !!canEditGymConfig },
          { key: 'commissions', ion: 'receipt-outline', title: tStr('admin_nav_commissions'), sub: tStr('admin_menu_commissions_sub'), onPress: () => navigation.navigate('AdminCommissions'), show: !isLite },
          { key: 'reportes', ion: 'bar-chart-outline', title: proTitle(tStr('admin_nav_reportes')), sub: tStr('admin_menu_reportes_sub'), onPress: () => guardPro(TRIAL_PRO_FEATURE_KEYS.STATS_TOTAL, () => navigation.navigate('AdminReportes')), show: !isLite, proLocked: proLocked },
        ],
      },
      {
        key: 'config',
        title: tStr('admin_group_config'),
        tiles: [
          { key: 'marca', ion: 'color-wand-outline', title: tStr('admin_menu_marca_title'), sub: tStr('admin_menu_marca_sub'), onPress: () => navigation.navigate('GymConfig'), show: !!canEditGymConfig },
          { key: 'perfil', ion: 'person-outline', title: tStr('admin_mi_perfil'), sub: tStr('admin_menu_perfil_sub'), onPress: () => navigation.navigate('Perfil'), show: true },
        ],
      },
    ]
      .map((g) => ({ ...g, tiles: g.tiles.filter((x) => x.show) }))
      .filter((g) => g.tiles.length > 0);

    const tiles = groups.flatMap((g) => g.tiles);
    return { tiles, groups };
  }, [navigation, tStr, canEditGymConfig, isLite, hasPlatformPanel, guardWrite, guardPro, proLocked]);
}
