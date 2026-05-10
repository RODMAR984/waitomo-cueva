const { test, expect } = require('@playwright/test');

test.describe('Web smoke: navegacion publica adicional', () => {
  test('abre crear cuenta desde welcome', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Crear cuenta', { exact: true }).click();

    await expect(page.getByText('Creá tu cuenta', { exact: true })).toBeVisible();
    await expect(page.getByText('Crear cuenta con email', { exact: true })).toBeVisible();
  });

  test('abre unirse con codigo desde welcome', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Tengo código o link', { exact: true }).click();

    await expect(page.getByText('Unirme con código', { exact: true })).toBeVisible();
    await expect(page.getByText('Continuar', { exact: true })).toBeVisible();
  });

  test('navega a registro owner desde welcome', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Crear cuenta gym / coach', { exact: true }).click();

    await expect(page.getByText('Crear cuenta (gym / coach)', { exact: true })).toBeVisible();
  });

  test('abre directorio público desde welcome (Buscar gym o coach)', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Buscar gym o coach', { exact: true }).click();

    await expect(
      page.getByText(/Solo aparecen espacios que eligieron listarse en FitEngine/),
    ).toBeVisible();
    await expect(page.getByPlaceholder('Filtrar por nombre o dirección…')).toBeVisible();
  });

  test('directorio: volver al welcome (navegación atrás)', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Buscar gym o coach', { exact: true }).click();
    await expect(page.getByPlaceholder('Filtrar por nombre o dirección…')).toBeVisible();

    const backBtn = page.getByRole('button', { name: 'Volver' });
    await expect(backBtn).toBeVisible({ timeout: 15_000 });
    // Tras cargar el directorio puede haber un re-render (RPC); force evita “detached” intermitente.
    await backBtn.click({ force: true });
    await expect(page.getByText('Iniciar sesión', { exact: true })).toBeVisible();
  });

  test('directorio: CTA invitación en tarjeta (si hay al menos un listado)', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Buscar gym o coach', { exact: true }).click();
    await expect(page.getByPlaceholder('Filtrar por nombre o dirección…')).toBeVisible();

    const joinOnCard = page.getByText('Tengo código para unirme', { exact: true });
    const n = await joinOnCard.count();
    test.skip(n === 0, 'Directorio sin filas publicadas (sin CTA en tarjetas).');

    await joinOnCard.first().click();
    await expect(page.getByText('Unirme con código', { exact: true })).toBeVisible();
  });

  test('desde crear cuenta vuelve a selector/flujo base', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Crear cuenta', { exact: true }).click();
    await page.getByText('Volver al inicio', { exact: true }).click();

    await expect(page.getByText('Iniciar sesión', { exact: true })).toBeVisible();
  });
});

