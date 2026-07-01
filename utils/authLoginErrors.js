/** Clasifica errores de signInWithPassword para mensajes claros en login. */

export function isEmailNotConfirmedError(error) {
  const code = String(error?.code || '').toLowerCase();
  const msg = String(error?.message || '').toLowerCase();
  return (
    code === 'email_not_confirmed' ||
    msg.includes('email not confirmed') ||
    msg.includes('correo no confirmado') ||
    msg.includes('email not verified')
  );
}

export function isInvalidLoginCredentialsError(error) {
  if (!error) return false;
  if (isEmailNotConfirmedError(error)) return false;

  const code = String(error?.code || '').toLowerCase();
  const msg = String(error?.message || '').toLowerCase();
  const status = error?.status;

  if (code === 'invalid_credentials' || code === 'invalid_grant') return true;
  if (msg.includes('invalid login credentials')) return true;
  if (msg.includes('invalid credentials')) return true;
  if (msg.includes('credenciales inválidas') || msg.includes('credenciales invalidas')) return true;
  if (status === 400 && (msg.includes('password') || msg.includes('contraseña'))) return true;

  return false;
}
