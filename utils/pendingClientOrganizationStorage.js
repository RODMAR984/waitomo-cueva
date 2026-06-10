import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearPendingClientInviteCode } from './pendingClientInviteStorage';

const KEY = 'fe_pending_client_organization_id';

export async function setPendingClientOrganizationId(orgId) {
  const id = String(orgId || '').trim();
  if (!id) {
    await clearPendingClientOrganizationId();
    return;
  }
  await clearPendingClientInviteCode();
  await AsyncStorage.setItem(KEY, id);
}

export async function getPendingClientOrganizationId() {
  try {
    const v = await AsyncStorage.getItem(KEY);
    return v ? String(v).trim() : null;
  } catch {
    return null;
  }
}

export async function clearPendingClientOrganizationId() {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
