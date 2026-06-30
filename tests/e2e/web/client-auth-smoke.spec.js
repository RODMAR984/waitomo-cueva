const { test, expect } = require('@playwright/test');
const { loginAsClient } = require('./helpers/auth');

const CLIENT_EMAIL = process.env.E2E_CLIENT_EMAIL || '';
const CLIENT_PASSWORD = process.env.E2E_CLIENT_PASSWORD || '';
const hasClientCreds = Boolean(CLIENT_EMAIL && CLIENT_PASSWORD);

test.describe('Web smoke: cliente autenticado', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasClientCreds, 'Definir E2E_CLIENT_EMAIL y E2E_CLIENT_PASSWORD para correr suite cliente.');
    await loginAsClient(page, { email: CLIENT_EMAIL, password: CLIENT_PASSWORD });
  });

  test('panel muestra bienvenida', async ({ page }) => {
    await expect(page.getByText('Bienvenido a tu panel de entrenamiento.', { exact: true })).toBeVisible();
  });

  test('home cliente (ClientScreen) montado', async ({ page }) => {
    await expect(page.getByTestId('client-home-root')).toBeVisible({ timeout: 15_000 });
  });

  test('abre calendario desde tabs', async ({ page }) => {
    await page.getByTestId('client-home-cta-calendario').click();
    await expect(page.getByTestId('screen-calendario')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('calendario-nav-back')).toBeVisible({ timeout: 10_000 });
  });

  test('calendario visible en viewport móvil (iPhone)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByTestId('client-home-cta-calendario').click();
    await expect(page.getByTestId('screen-calendario')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('calendario-nav-back')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[data-testid="screen-calendario"]').locator('text=/Horarios|Times/i').first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('abre perfil desde tabs', async ({ page }) => {
    await page.getByRole('tab', { name: /Mi perfil/ }).click();
    await expect(page.getByTestId('screen-perfil')).toBeVisible({ timeout: 15_000 });
  });
});
