import { useMemo } from 'react';

/**
 * Destinos del hub panel plataforma (sub-rutas bajo el mismo shell staff web).
 */
export default function useSuperadminHubTiles(navigation) {
  return useMemo(
    () => [
      {
        key: 'obs',
        ion: 'pulse-outline',
        titleKey: 'superadmin_hub_tile_obs_title',
        subKey: 'superadmin_hub_tile_obs_sub',
        onPress: () => navigation.navigate('SuperadminObservability'),
      },
      {
        key: 'orgs',
        ion: 'business-outline',
        titleKey: 'superadmin_hub_tile_orgs_title',
        subKey: 'superadmin_hub_tile_orgs_sub',
        onPress: () => navigation.navigate('SuperadminOrgs'),
      },
      {
        key: 'tickets',
        ion: 'chatbubbles-outline',
        titleKey: 'superadmin_hub_tile_tickets_title',
        subKey: 'superadmin_hub_tile_tickets_sub',
        onPress: () => navigation.navigate('SuperadminTickets'),
      },
      {
        key: 'flags',
        ion: 'flag-outline',
        titleKey: 'superadmin_hub_tile_flags_title',
        subKey: 'superadmin_hub_tile_flags_sub',
        onPress: () => navigation.navigate('SuperadminFeatureFlags'),
      },
      {
        key: 'mrr',
        ion: 'stats-chart-outline',
        titleKey: 'superadmin_hub_tile_mrr_title',
        subKey: 'superadmin_hub_tile_mrr_sub',
        onPress: () => navigation.navigate('SuperadminTopic', { topic: 'mrr' }),
      },
      {
        key: 'audit',
        ion: 'shield-checkmark-outline',
        titleKey: 'superadmin_hub_tile_audit_title',
        subKey: 'superadmin_hub_tile_audit_sub',
        onPress: () => navigation.navigate('SuperadminAuditLog'),
      },
      {
        key: 'broadcast',
        ion: 'mail-outline',
        titleKey: 'superadmin_hub_tile_broadcast_title',
        subKey: 'superadmin_hub_tile_broadcast_sub',
        onPress: () => navigation.navigate('SuperadminTopic', { topic: 'broadcast' }),
      },
    ],
    [navigation],
  );
}
