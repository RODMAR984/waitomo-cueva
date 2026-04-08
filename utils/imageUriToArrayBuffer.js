import { File } from 'expo-file-system';

/**
 * Prepara el cuerpo de subida para Supabase Storage desde un URI de imagen.
 * En Android, fetch(file:// o content://) suele fallar con "Network request failed".
 */
export async function imageUriToArrayBuffer(uri) {
  if (!uri || typeof uri !== 'string') {
    throw new Error('URI de imagen inválida');
  }
  const trimmed = uri.trim();
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('http://') || lower.startsWith('https://')) {
    const res = await fetch(trimmed);
    if (!res.ok) {
      throw new Error(`No se pudo descargar la imagen (${res.status})`);
    }
    return res.arrayBuffer();
  }
  const file = new File(trimmed);
  return file.arrayBuffer();
}
