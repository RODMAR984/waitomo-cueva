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

    await expect(page.getByPlaceholder('Email')).toBeVisible();
    await expect(page.getByText('Iniciar sesión', { exact: true })).toBeVisible();
    await expect(page.getByTestId('login-switch-staff-from-client')).toHaveCount(0);
  });
});
