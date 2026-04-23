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

  test('abre calendario desde tabs', async ({ page }) => {
    await page.getByText('Calendario', { exact: true }).first().click();
    await expect(
      page.getByText(/Horarios disponibles|Horarios con reserva|Calendario/),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('abre perfil desde tabs', async ({ page }) => {
    await page.getByText('Mi perfil', { exact: true }).first().click();
    await expect(page.getByText('Mi perfil', { exact: true })).toBeVisible({ timeout: 15_000 });
  });
});
