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
    await page.getByText('Tengo código de invitación de mi gym', { exact: true }).click();

    await expect(page.getByText('Unirme con código', { exact: true })).toBeVisible();
    await expect(page.getByText('Continuar', { exact: true })).toBeVisible();
  });

  test('navega a registro owner desde welcome', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Crear cuenta gym / coach', { exact: true }).click();

    await expect(page.getByText('Crear cuenta (gym / coach)', { exact: true })).toBeVisible();
  });

  test('desde crear cuenta vuelve a selector/flujo base', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Crear cuenta', { exact: true }).click();
    await page.getByText('Volver al inicio', { exact: true }).click();

    await expect(page.getByText('Iniciar sesión', { exact: true })).toBeVisible();
  });
});

