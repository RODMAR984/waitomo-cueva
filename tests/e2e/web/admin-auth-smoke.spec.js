const { test, expect } = require('@playwright/test');
const { loginAsStaff } = require('./helpers/auth');

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || '';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || '';
const hasAdminCreds = Boolean(ADMIN_EMAIL && ADMIN_PASSWORD);

test.describe('Web smoke: admin autenticado', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasAdminCreds, 'Definir E2E_ADMIN_EMAIL y E2E_ADMIN_PASSWORD para correr suite admin.');
    await loginAsStaff(page, { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  });

  test('abre pantalla de resumen de reservas', async ({ page }) => {
    await page.getByText('Reservas del día', { exact: true }).first().click();
    await expect(page.getByText('La pastilla muestra inscriptos / 10', { exact: false })).toBeVisible();
  });

  test('abre pantalla de planes', async ({ page }) => {
    await page.getByText('Planes', { exact: true }).first().click();
    await expect(page.getByText('Nuevo', { exact: true })).toBeVisible();
  });

  test('abre pantalla de observabilidad', async ({ page }) => {
    await page.getByText('Observabilidad', { exact: true }).first().click();
    await expect(page.getByText('Sincronizar backend', { exact: true })).toBeVisible();
  });
});

