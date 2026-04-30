import { DeviceEventEmitter } from 'react-native';

/** AdminScreen (bloques): pedir scroll desde tarjetas menú o rail web sin acceso al ref del ScrollView. */
export const ADMIN_SCROLL_LISTS = 'admin_scroll_block_lists';
export const ADMIN_SCROLL_EDITOR = 'admin_scroll_block_editor';

export function emitAdminScrollToLists() {
  DeviceEventEmitter.emit(ADMIN_SCROLL_LISTS);
}

export function emitAdminScrollToEditor() {
  DeviceEventEmitter.emit(ADMIN_SCROLL_EDITOR);
}
