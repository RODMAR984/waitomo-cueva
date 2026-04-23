const { expect } = require('@playwright/test');

async function loginAsStaff(page, { email, password }) {
  await page.goto('/');
  await page.getByText('Iniciar sesión como gym / coach', { exact: true }).click();

  await expect(page.getByText('Iniciar sesión (staff)', { exact: true })).toBeVisible();
  await page.getByPlaceholder('Email').fill(email);
  await page.getByPlaceholder('Contraseña').fill(password);
  await page.getByText('Entrar', { exact: true }).click();

  const continueBtn = page.getByText('Continuar al panel staff', { exact: true });
  if (await continueBtn.count()) {
    await continueBtn.click();
  }

  await expect(page.getByText('ADMIN — Crear / editar bloques', { exact: true })).toBeVisible({
    timeout: 15_000,
  });
}

async function loginAsClient(page, { email, password }) {
  await page.goto('/');
  await page.getByText('Iniciar sesión', { exact: true }).click();

  await expect(page.getByPlaceholder('Email')).toBeVisible();
  await page.getByPlaceholder('Email').fill(email);
  await page.getByPlaceholder('Contraseña').fill(password);
  await page.getByText('Entrar', { exact: true }).click();

  await expect(page.getByText('Bienvenido a tu panel de entrenamiento.', { exact: true })).toBeVisible({
    timeout: 20_000,
  });
}

module.exports = { loginAsStaff, loginAsClient };

