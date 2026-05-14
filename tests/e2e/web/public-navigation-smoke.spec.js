const { test, expect } = require('@playwright/test');

test.describe('Web smoke: navegacion publica adicional', () => {
  test('abre hub cliente desde welcome (Empezar)', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('welcome-cta-start').click();

    await expect(page.getByText('Unite a tu gym', { exact: true })).toBeVisible();
    await expect(page.getByText('Tengo código o link', { exact: true })).toBeVisible();
    await expect(page.getByText('Buscar gym o coach', { exact: true })).toBeVisible();
  });

  test('abre unirse con codigo desde welcome', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('welcome-cta-start').click();
    await page.getByTestId('welcome-client-join-code').click();

    await expect(page.getByText('Unirme con código', { exact: true })).toBeVisible();
    await expect(page.getByText('Continuar', { exact: true })).toBeVisible();
  });

  test('navega a registro owner desde welcome', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('welcome-cta-gym-or-coach').click();

    await expect(page.getByText('Crear cuenta (gym / coach)', { exact: true })).toBeVisible();
  });

  test('abre directorio público desde hub (Buscar gym o coach)', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('welcome-cta-start').click();
    await page.getByTestId('welcome-client-join-directory').click();

    await expect(
      page.getByText(/Solo aparecen espacios que eligieron listarse en FitEngine/),
    ).toBeVisible();
    await expect(page.getByPlaceholder('Filtrar por nombre o dirección…')).toBeVisible();
  });

  test('directorio: volver al welcome (navegación atrás)', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('welcome-cta-start').click();
    await page.getByTestId('welcome-client-join-directory').click();
    await expect(page.getByPlaceholder('Filtrar por nombre o dirección…')).toBeVisible();

    const backDirectory = page.getByTestId('directory-nav-back');
    await expect(backDirectory).toBeVisible({ timeout: 15_000 });
    await backDirectory.click({ force: true });
    await page.getByTestId('welcome-client-join-back').click();
    await expect(page.getByText('Iniciar sesión', { exact: true })).toBeVisible();
  });

  test('directorio: CTA invitación en tarjeta (si hay al menos un listado)', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('welcome-cta-start').click();
    await page.getByTestId('welcome-client-join-directory').click();
    await expect(page.getByPlaceholder('Filtrar por nombre o dirección…')).toBeVisible();

    const joinOnCard = page.getByText('Tengo código para unirme', { exact: true });
    const n = await joinOnCard.count();
    test.skip(n === 0, 'Directorio sin filas publicadas (sin CTA en tarjetas).');

    await joinOnCard.first().click();
    await expect(page.getByText('Unirme con código', { exact: true })).toBeVisible();
  });

  test('desde hub cliente vuelve al welcome', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('welcome-cta-start').click();
    await page.getByTestId('welcome-client-join-back').click();

    await expect(page.getByText('Iniciar sesión', { exact: true })).toBeVisible();
  });
});
