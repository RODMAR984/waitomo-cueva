/**
 * Destino por defecto para clientes con perfil ya cargado: panel si tienen plan, si no selector de planes.
 */
export function getClientPostAuthRouteName(profile) {
  const hasPlan = !!(profile?.plan_actual && String(profile.plan_actual).trim());
  return hasPlan ? 'ClientTabs' : 'PlanSelector';
}
