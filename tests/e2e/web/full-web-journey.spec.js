/**
 * Recorrido web único (un solo test): Welcome → i18n → público → (opc.) cliente
 * → (opc.) staff org (E2E_ORG_ADMIN_* o E2E_ADMIN_* legacy)
 * → (opc.) staff plataforma (E2E_PLATFORM_ADMIN_*) con Diagnóstico.
 *
 * Tres cuentas (recomendado): E2E_CLIENT_*, E2E_ORG_ADMIN_*, E2E_PLATFORM_ADMIN_*.
 * Legacy dos cuentas: solo E2E_ADMIN_* (misma pestaña: reservas + planes + Diagnóstico si aplica).
 *
 * Modo **total** (falla si falta cualquier credencial de las tres):
 *   `npm run test:e2e:web:journey:maestro:strict`  (E2E_JOURNEY_STRICT=1)
 *
 * Desde Maestro/.env.local: `npm run test:e2e:web:journey:maestro`
 *
 * Ver en pantalla: `npm run test:e2e:web:journey-headed` (+ mismas variables).
 */
const { test, expect } = require('@playwright/test');
const { loginAsClient, loginAsStaff } = require('./helpers/auth');
const { openObservabilityFromStaff } = require('./helpers/openObservabilityFromStaff');

const CLIENT_EMAIL = process.env.E2E_CLIENT_EMAIL || '';
const CLIENT_PASSWORD = process.env.E2E_CLIENT_PASSWORD || '';

const EXPLICIT_ORG_EMAIL = (process.env.E2E_ORG_ADMIN_EMAIL || '').trim();
const EXPLICIT_ORG_PASSWORD = (process.env.E2E_ORG_ADMIN_PASSWORD || '').trim();
const EXPLICIT_PLAT_EMAIL = (process.env.E2E_PLATFORM_ADMIN_EMAIL || '').trim();
const EXPLICIT_PLAT_PASSWORD = (process.env.E2E_PLATFORM_ADMIN_PASSWORD || '').trim();

const LEGACY_ADMIN_EMAIL = (process.env.E2E_ADMIN_EMAIL || '').trim();
const LEGACY_ADMIN_PASSWORD = (process.env.E2E_ADMIN_PASSWORD || '').trim();

const explicitOrg = Boolean(EXPLICIT_ORG_EMAIL && EXPLICIT_ORG_PASSWORD);
const explicitPlat = Boolean(EXPLICIT_PLAT_EMAIL && EXPLICIT_PLAT_PASSWORD);
const legacyAdmin = Boolean(LEGACY_ADMIN_EMAIL && LEGACY_ADMIN_PASSWORD);

/** Staff de organización (motor reservas/planes). */
let orgStaffEmail = '';
let orgStaffPassword = '';
if (explicitOrg) {
  orgStaffEmail = EXPLICIT_ORG_EMAIL;
  orgStaffPassword = EXPLICIT_ORG_PASSWORD;
} else if (legacyAdmin) {
  orgStaffEmail = LEGACY_ADMIN_EMAIL;
  orgStaffPassword = LEGACY_ADMIN_PASSWORD;
}

const platEmail = explicitPlat ? EXPLICIT_PLAT_EMAIL : '';
const platPassword = explicitPlat ? EXPLICIT_PLAT_PASSWORD : '';

const hasClientCreds = Boolean(CLIENT_EMAIL && CLIENT_PASSWORD);
const hasOrgStaffCreds = Boolean(orgStaffEmail && orgStaffPassword);
const hasPlatformStaffCreds = Boolean(platEmail && platPassword);
/** Solo E2E_ADMIN (sin pares org/plataforma separados): una pestaña hace motor + Diagnóstico. */
const legacySingleStaffObs = Boolean(
  legacyAdmin && !explicitOrg && !explicitPlat && hasOrgStaffCreds,
);

/** Misma base que `use.baseURL` en playwright.config.cjs (contextos nuevos no heredan el config). */
const PLAYWRIGHT_BASE = 'http://127.0.0.1:4173';

const journeyStrict = ['1', 'true', 'yes'].includes(
  String(process.env.E2E_JOURNEY_STRICT || '').trim().toLowerCase(),
);

async function closeContextSafe(ctx) {
  try {
    await ctx.close();
  } catch {
    // Tras timeout global Playwright puede haber cerrado browser/context ya.
  }
}

test.describe('E2E — recorrido web completo (único flujo)', () => {
  test('Welcome → público → login → cliente y/o staff (según env)', async ({ page, browser }) => {
    const needsStaffBudget = hasOrgStaffCreds || hasPlatformStaffCreds;
    // Cliente (welcome largo + Supabase) + 1–2 contextos staff en serie: 4 min suele quedar justo.
    test.setTimeout(needsStaffBudget ? 480_000 : 240_000);

    if (journeyStrict) {
      const missing = [];
      if (!hasClientCreds) missing.push('cliente: E2E_CLIENT_EMAIL + E2E_CLIENT_PASSWORD');
      if (!hasOrgStaffCreds) missing.push('staff org: E2E_ORG_ADMIN_* (o legacy E2E_ADMIN_*)');
      if (!hasPlatformStaffCreds) missing.push('plataforma: E2E_PLATFORM_ADMIN_*');
      expect(
        missing,
        'E2E_JOURNEY_STRICT=1 exige las tres cuentas; quita la variable o define Maestro/E2E_*.',
      ).toEqual([]);
    }

    await test.step('Welcome, i18n y rutas públicas', async () => {
      await page.goto('/');
      await expect(page.locator('#root')).toBeVisible();
      const scriptCount = await page.locator('script[src*="/_expo/static/js/web/"]').count();
      expect(scriptCount).toBeGreaterThan(0);

      await expect(page.getByText('Iniciar sesión', { exact: true })).toBeVisible();
      await expect(page.getByText('Empezar', { exact: true })).toBeVisible();
      await expect(page.getByText('Soy un gym o coach', { exact: true })).toBeVisible();

      await page.getByTestId('locale-dropdown-trigger').click();
      await page.getByTestId('locale-opt-en').click();
      await expect(page.getByText('Sign in', { exact: true })).toBeVisible({ timeout: 15_000 });
      await page.getByTestId('locale-dropdown-trigger').click();
      await page.getByTestId('locale-opt-es').click();
      await expect(page.getByText('Iniciar sesión', { exact: true })).toBeVisible();

      await page.getByTestId('welcome-cta-login-client').click();
      await expect(page.getByPlaceholder('Email')).toBeVisible();
      await expect(page.getByText('Entrar', { exact: true })).toBeVisible();
      await expect(page.getByTestId('login-switch-staff-from-client')).toHaveCount(0);
      await page.goto('/');

      await page.getByTestId('welcome-cta-start').click();
      await expect(page.getByText('Unite a tu gym', { exact: true })).toBeVisible();
      await page.getByTestId('welcome-client-join-back').click();
      await expect(page.getByText('Iniciar sesión', { exact: true })).toBeVisible();

      await page.getByTestId('welcome-cta-start').click();
      await page.getByTestId('welcome-client-join-code').click();
      await expect(page.getByText('Unirme con código', { exact: true })).toBeVisible();
      await page.goto('/');

      await page.getByTestId('welcome-cta-gym-or-coach').click();
      await expect(page.getByText('Crear cuenta (gym / coach)', { exact: true })).toBeVisible();
      await page.goto('/');

      await page.getByTestId('welcome-cta-start').click();
      await page.getByTestId('welcome-client-join-directory').click();
      await expect(
        page.getByText(/Solo aparecen espacios que eligieron listarse en FitEngine/),
      ).toBeVisible();
      await expect(page.getByPlaceholder('Filtrar por nombre o dirección…')).toBeVisible();
      const backDirectory = page.getByTestId('directory-nav-back');
      await expect(backDirectory).toBeVisible({ timeout: 15_000 });
      await backDirectory.click({ force: true });
      await page.getByTestId('welcome-client-join-back').click();
      await expect(page.getByText('Iniciar sesión', { exact: true })).toBeVisible();
    });

    if (hasClientCreds) {
      await test.step('Cliente: login + home + calendario + perfil', async () => {
        await loginAsClient(page, { email: CLIENT_EMAIL, password: CLIENT_PASSWORD });
        await expect(page.getByTestId('client-home-root')).toBeVisible({ timeout: 25_000 });
        await page.getByTestId('client-home-cta-calendario').click();
        await expect(page.getByTestId('screen-calendario')).toBeVisible({ timeout: 15_000 });
        await page.getByRole('tab', { name: /Mi perfil/ }).click();
        await expect(page.getByTestId('screen-perfil')).toBeVisible({ timeout: 15_000 });
      });
    }

    if (hasOrgStaffCreds) {
      await test.step('Staff org: login + resumen + planes', async () => {
        const staffContext = await browser.newContext({ baseURL: PLAYWRIGHT_BASE });
        const staffPage = await staffContext.newPage();
        try {
          await loginAsStaff(staffPage, {
            email: orgStaffEmail,
            password: orgStaffPassword,
            startUrl: `${PLAYWRIGHT_BASE}/`,
          });
          await staffPage.getByTestId('staff-hub-tile-resumen').last().click();
          await expect(staffPage.getByText('La pastilla muestra inscriptos / 10', { exact: false })).toBeVisible();
          await staffPage.getByTestId('staff-hub-tile-planes').last().click();
          await expect(staffPage.getByTestId('screen-admin-planes')).toBeVisible({ timeout: 15_000 });
          await expect(staffPage.getByText('Nuevo', { exact: true })).toBeVisible();
          if (legacySingleStaffObs) {
            await openObservabilityFromStaff(staffPage);
          }
        } finally {
          await closeContextSafe(staffContext);
        }
      });
    }

    if (hasPlatformStaffCreds) {
      await test.step('Staff plataforma: login + hub → Diagnóstico', async () => {
        const platContext = await browser.newContext({ baseURL: PLAYWRIGHT_BASE });
        const platPage = await platContext.newPage();
        try {
          await loginAsStaff(platPage, {
            email: platEmail,
            password: platPassword,
            startUrl: `${PLAYWRIGHT_BASE}/`,
          });
          await openObservabilityFromStaff(platPage);
        } finally {
          await closeContextSafe(platContext);
        }
      });
    }
  });
});
