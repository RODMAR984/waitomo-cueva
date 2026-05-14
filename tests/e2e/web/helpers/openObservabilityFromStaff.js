const { expect } = require('@playwright/test');

/**
 * Diagnóstico / observabilidad solo en el hub de plataforma: Panel plataforma → Diagnóstico.
 * (Ya no hay entrada en el rail del admin de org.)
 */
async function openObservabilityFromStaff(page) {
  const plat = page.getByText(/Panel plataforma|Platform panel/i).first();
  await expect(plat).toBeVisible({ timeout: 12_000 });
  await plat.click();
  const hubDiag = page.getByText(/^Diagn[oó]stico$/i).first();
  await expect(hubDiag).toBeVisible({ timeout: 8000 });
  await hubDiag.click();
  await expect(page.getByText('Sincronizar backend', { exact: true })).toBeVisible();
}

module.exports = { openObservabilityFromStaff };
