/**
 * Recorrido web único (un solo test): Welcome → i18n → pantallas públicas → formularios de login
 * → (opcional) sesión cliente y tabs → (opcional) sesión staff en segunda pestaña si hay credenciales admin.
 *
 * Ver en pantalla:
 *   npm run test:e2e:web:journey-headed
 *
 * Sin navegador (CI):
 *   npm run test:e2e:web:journey
 */
const { test, expect } = require('@playwright/test');
const { loginAsClient, loginAsStaff } = require('./helpers/auth');

const CLIENT_EMAIL = process.env.E2E_CLIENT_EMAIL || '';
const CLIENT_PASSWORD = process.env.E2E_CLIENT_PASSWORD || '';
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || '';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || '';
const hasClientCreds = Boolean(CLIENT_EMAIL && CLIENT_PASSWORD);
const hasAdminCreds = Boolean(ADMIN_EMAIL && ADMIN_PASSWORD);

test.describe('E2E — recorrido web completo (único flujo)', () => {
  test('Welcome → público → login → cliente y/o staff (según env)', async ({ page, context }) => {
    test.setTimeout(240_000);

    // --- Shell ---
    await page.goto('/');
    await expect(page.locator('#root')).toBeVisible();
    const scriptCount = await page.locator('script[src*="/_expo/static/js/web/"]').count();
    expect(scriptCount).toBeGreaterThan(0);

    // --- Welcome ES ---
    await expect(page.getByText('Iniciar sesión', { exact: true })).toBeVisible();
    await expect(page.getByText('Crear cuenta', { exact: true })).toBeVisible();
    await expect(page.getByText('Iniciar sesión como gym / coach', { exact: true })).toBeVisible();

    // --- Idioma EN → ES ---
    await page.getByTestId('locale-en').click();
    await expect(page.getByText('Sign in', { exact: true })).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('locale-es').click();
    await expect(page.getByText('Iniciar sesión', { exact: true })).toBeVisible();

    // --- Login cliente (solo pantalla) ---
    await page.getByText('Iniciar sesión', { exact: true }).click();
    await expect(page.getByPlaceholder('Email')).toBeVisible();
    await expect(page.getByText('Entrar', { exact: true })).toBeVisible();
    await page.goto('/');

    // --- Login staff (solo pantalla) ---
    await page.getByText('Iniciar sesión como gym / coach', { exact: true }).click();
    await expect(page.getByText('Iniciar sesión (staff)', { exact: true })).toBeVisible();
    await page.goto('/');

    // --- Crear cuenta → volver ---
    await page.getByText('Crear cuenta', { exact: true }).click();
    await expect(page.getByText('Creá tu cuenta', { exact: true })).toBeVisible();
    await page.getByText('Volver al inicio', { exact: true }).click();
    await expect(page.getByText('Iniciar sesión', { exact: true })).toBeVisible();

    // --- Código / link ---
    await page.getByText('Tengo código o link', { exact: true }).click();
    await expect(page.getByText('Unirme con código', { exact: true })).toBeVisible();
    await page.goto('/');

    // --- Registro gym/coach ---
    await page.getByText('Crear cuenta gym / coach', { exact: true }).click();
    await expect(page.getByText('Crear cuenta (gym / coach)', { exact: true })).toBeVisible();
    await page.goto('/');

    // --- Directorio público → volver ---
    await page.getByText('Buscar gym o coach', { exact: true }).click();
    await expect(
      page.getByText(/Solo aparecen espacios que eligieron listarse en FitEngine/),
    ).toBeVisible();
    await expect(page.getByPlaceholder('Filtrar por nombre o dirección…')).toBeVisible();
    const backBtn = page.getByRole('button', { name: 'Volver' });
    await expect(backBtn).toBeVisible({ timeout: 15_000 });
    await backBtn.click({ force: true });
    await expect(page.getByText('Iniciar sesión', { exact: true })).toBeVisible();

    // --- Sesión cliente (opcional) ---
    if (hasClientCreds) {
      await loginAsClient(page, { email: CLIENT_EMAIL, password: CLIENT_PASSWORD });
      await expect(page.getByText('Bienvenido a tu panel de entrenamiento.', { exact: true })).toBeVisible({
        timeout: 25_000,
      });
      await expect(page.getByText('Bienvenida a FitEngine', { exact: true })).toBeVisible();
      await page.getByText('Calendario', { exact: true }).first().click();
      await expect(
        page.getByText(/Horarios disponibles|Horarios con reserva|Calendario/),
      ).toBeVisible({ timeout: 15_000 });
      await page.getByText('Mi perfil', { exact: true }).first().click();
      await expect(page.getByText('Mi perfil', { exact: true })).toBeVisible({ timeout: 15_000 });
    }

    // --- Sesión staff en pestaña aparte (opcional; evita mezclar sesión con cliente) ---
    if (hasAdminCreds) {
      const staffPage = await context.newPage();
      await loginAsStaff(staffPage, { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
      await staffPage.getByText('Reservas del día', { exact: true }).first().click();
      await expect(staffPage.getByText('La pastilla muestra inscriptos / 10', { exact: false })).toBeVisible();
      await staffPage.getByText('Planes', { exact: true }).first().click();
      await expect(staffPage.getByText('Nuevo', { exact: true })).toBeVisible();
      await staffPage.getByText(/Observabilidad|Diagn[oó]stico/i).first().click();
      await expect(staffPage.getByText('Sincronizar backend', { exact: true })).toBeVisible();
      await staffPage.close();
    }
  });
});
