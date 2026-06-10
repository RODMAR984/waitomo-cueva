import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'fe_pending_client_invite_code';

export async function setPendingClientInviteCode(code) {
  const c = String(code || '').trim();
  if (!c) {
    await clearPendingClientInviteCode();
    return;
  }
  try {
    const { clearPendingClientOrganizationId } = await import('./pendingClientOrganizationStorage');
    await clearPendingClientOrganizationId();
  } catch {
    // ignore
  }
  await AsyncStorage.setItem(KEY, c);
}

export async function getPendingClientInviteCode() {
  try {
    const v = await AsyncStorage.getItem(KEY);
    return v ? String(v).trim() : null;
  } catch {
    return null;
  }
}

export async function clearPendingClientInviteCode() {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
