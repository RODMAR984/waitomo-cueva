const { test, expect } = require('@playwright/test');

test.describe('Web smoke: welcome y auth base', () => {
  test('muestra welcome en espanol por defecto', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('Empezar', { exact: true })).toBeVisible();
    await expect(page.getByText('Soy un gym o coach', { exact: true })).toBeVisible();
    await expect(page.getByText('Iniciar sesión', { exact: true })).toBeVisible();
  });

  test('permite cambiar idioma ES/EN desde welcome', async ({ page }) => {
    await page.goto('/');

    await page.getByTestId('locale-dropdown-trigger').click();
    await page.getByTestId('locale-opt-en').click();
    await expect(page.getByText('Sign in', { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Get started', { exact: true })).toBeVisible();

    await page.getByTestId('locale-dropdown-trigger').click();
    await page.getByTestId('locale-opt-es').click();
    await expect(page.getByText('Iniciar sesión', { exact: true })).toBeVisible();
  });

  test('navega a login cliente desde welcome', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('welcome-cta-login-client').click();

    await expect(page.getByPlaceholder('Email')).toBeVisible();
    await expect(page.getByText('Entrar', { exact: true })).toBeVisible();
    await expect(page.getByText('¿Olvidaste tu contraseña?', { exact: true })).toBeVisible();
  });

  test('login unificado: no hay enlace separado a staff en la pantalla de acceso', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('welcome-cta-login-client').click();

    // Pantalla de acceso unificada (inputs con testID); no usar getByText('Iniciar sesión'): también aparece en el CTA del welcome en el árbol → strict mode.
    await expect(page.getByTestId('login-email-input')).toBeVisible();
    await expect(page.getByTestId('login-submit')).toBeVisible();
    await expect(page.getByTestId('login-switch-staff-from-client')).toHaveCount(0);
  });

  /**
   * Welcome → hub “Unite a tu gym” (código + directorio público) → alta gym/coach (solo UI).
   * No envía el registro: el paso siguiente sería FitEngineSpaceIntro (branding), fuera de este smoke.
   */
  test('desde welcome: hub cliente, código, directorio y formulario alta gym/coach (sin registrar)', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.goto('/');

    await page.getByTestId('welcome-cta-start').click();
    await expect(page.getByText('Unite a tu gym', { exact: true })).toBeVisible();
    await page.getByTestId('welcome-client-join-back').click();
    await expect(page.getByText('Iniciar sesión', { exact: true })).toBeVisible();

    await page.getByTestId('welcome-cta-start').click();
    await page.getByTestId('welcome-client-join-code').click();
    await expect(page.getByText('Unirme con código', { exact: true })).toBeVisible();
    await expect(page.getByTestId('invite-nav-back')).toBeVisible();
    await page.getByTestId('invite-nav-back').click();
    await expect(page.getByText('Unite a tu gym', { exact: true })).toBeVisible();

    await page.getByTestId('welcome-client-join-directory').click();
    await expect(
      page.getByText(/Solo aparecen espacios que eligieron listarse en FitEngine/),
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.getByPlaceholder('Filtrar por nombre o dirección…')).toBeVisible();
    const backDirectory = page.getByTestId('directory-nav-back');
    await expect(backDirectory).toBeVisible({ timeout: 15_000 });
    await backDirectory.click({ force: true });
    await page.getByTestId('welcome-client-join-back').click();
    await expect(page.getByText('Iniciar sesión', { exact: true })).toBeVisible();

    await page.getByTestId('welcome-cta-gym-or-coach').click();
    await expect(page.getByText('Crear cuenta (gym / coach)', { exact: true })).toBeVisible();
    await expect(
      page.getByText('Después configurás tu espacio (nombre, tipo, logo).', { exact: true }),
    ).toBeVisible();
    await expect(page.getByPlaceholder('Email')).toBeVisible();
    await expect(page.getByPlaceholder('Contraseña')).toBeVisible();
    await expect(page.getByPlaceholder('Nombre completo')).toBeVisible();
    await expect(page.getByText('Siguiente', { exact: true })).toBeVisible();
  });
});
