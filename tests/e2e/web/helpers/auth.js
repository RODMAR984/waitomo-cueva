const { expect } = require('@playwright/test');

/**
 * @param {{ email: string, password: string, startUrl?: string }} creds
 * `startUrl`: URL absoluta del shell (p. ej. contexto nuevo con `baseURL` dudoso → `http://127.0.0.1:4173/`).
 */
async function loginAsStaff(page, { email, password, startUrl }) {
  await page.goto(startUrl || '/');
  await expect(page.getByTestId('welcome-cta-login-client')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('welcome-cta-login-client').click();

  await expect(page.getByPlaceholder('Email')).toBeVisible();
  await page.getByPlaceholder('Email').fill(email);
  await page.getByPlaceholder('Contraseña').fill(password);
  await page.getByText('Entrar', { exact: true }).click();

  const continueBtn = page.getByText('Continuar al panel staff', { exact: true });
  if (await continueBtn.count()) {
    await continueBtn.click();
  }

  // Org staff → AdminScreen (`admin-main-title`). Plataforma → Superadmin (`superadmin-hub-root`).
  await expect(
    page.getByTestId('admin-main-title').or(page.getByTestId('superadmin-hub-root')),
  ).toBeVisible({ timeout: 15_000 });
}

async function loginAsClient(page, { email, password }) {
  await page.goto('/');
  await page.getByTestId('welcome-cta-login-client').click();

  await expect(page.getByPlaceholder('Email')).toBeVisible();
  await page.getByPlaceholder('Email').fill(email);
  await page.getByPlaceholder('Contraseña').fill(password);
  await page.getByText('Entrar', { exact: true }).click();

  await expect(page.getByText('Bienvenido a tu panel de entrenamiento.', { exact: true })).toBeVisible({
    timeout: 20_000,
  });
}

module.exports = { loginAsStaff, loginAsClient };

