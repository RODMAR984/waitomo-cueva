const { test, expect } = require('@playwright/test');

test.describe('Web shell: salud del bundle exportado', () => {
  test('carga la raíz y expone #root', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#root')).toBeVisible();
  });

  test('el HTML incluye el bundle Expo web', async ({ page }) => {
    await page.goto('/');
    const hasExpoChunk = await page.locator('script[src*="/_expo/static/js/web/"]').count();
    expect(hasExpoChunk).toBeGreaterThan(0);
  });
});
