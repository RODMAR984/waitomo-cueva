const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Código corto legible (sin 0/O/1/I). */
export function generateClientInviteCode(length = 8) {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}
