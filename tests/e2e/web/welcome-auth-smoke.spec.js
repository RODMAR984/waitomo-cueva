const { test, expect } = require('@playwright/test');

test.describe('Web smoke: welcome y auth base', () => {
  test('muestra welcome en espanol por defecto', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('Iniciar sesión', { exact: true })).toBeVisible();
    await expect(page.getByText('Crear cuenta', { exact: true })).toBeVisible();
    await expect(page.getByText('Iniciar sesión como gym / coach', { exact: true })).toBeVisible();
  });

  test('permite cambiar idioma ES/EN desde welcome', async ({ page }) => {
    await page.goto('/');

    await page.getByText('EN').first().click();
    await expect(page.getByText('Sign in', { exact: true })).toBeVisible();
    await expect(page.getByText('Create account', { exact: true })).toBeVisible();

    await page.getByText('ES').first().click();
    await expect(page.getByText('Iniciar sesión', { exact: true })).toBeVisible();
  });

  test('navega a login cliente desde welcome', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Iniciar sesión', { exact: true }).click();

    await expect(page.getByPlaceholder('Email')).toBeVisible();
    await expect(page.getByText('Entrar', { exact: true })).toBeVisible();
    await expect(page.getByText('¿Olvidaste tu contraseña?', { exact: true })).toBeVisible();
  });

  test('navega a login staff desde acceso corto', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Iniciar sesión como gym / coach', { exact: true }).click();

    await expect(page.getByText('Iniciar sesión (staff)', { exact: true })).toBeVisible();
    await expect(page.getByPlaceholder('Email')).toBeVisible();
  });
});

