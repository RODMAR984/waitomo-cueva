import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'waitomo_active_app_mode:';

export function activeAppModeKey(userId) {
  return `${PREFIX}${userId}`;
}

export async function readActiveAppMode(userId) {
  if (!userId) return null;
  try {
    const raw = await AsyncStorage.getItem(activeAppModeKey(userId));
    if (raw === 'client' || raw === 'staff') return raw;
  } catch (_) {}
  return null;
}

export async function writeActiveAppMode(userId, mode) {
  if (!userId) return;
  if (mode !== 'client' && mode !== 'staff') return;
  await AsyncStorage.setItem(activeAppModeKey(userId), mode);
}

export async function clearActiveAppMode(userId) {
  if (!userId) return;
  try {
    await AsyncStorage.removeItem(activeAppModeKey(userId));
  } catch (_) {}
}
