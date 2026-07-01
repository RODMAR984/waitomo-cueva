const { defineConfig, devices } = require('@playwright/test');

/** `npm run test:e2e:web:headed` pasa `--headed` en argv: un solo worker y viewport al tamaño real de la ventana. */
const isHeadedRun = process.argv.some((a) => a === '--headed' || a.startsWith('--headed='));

module.exports = defineConfig({
  globalSetup: require.resolve('./playwright.global-setup.cjs'),
  testDir: './tests/e2e/web',
  timeout: 30_000,
  fullyParallel: !isHeadedRun,
  workers: isHeadedRun ? 1 : undefined,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'npx serve dist -l 4173 -s',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(isHeadedRun
          ? {
              // Ventana maximizada desde el arranque + viewport al tamaño real (evita “recorte” al agrandar).
              viewport: null,
              launchOptions: {
                args: ['--start-maximized'],
              },
            }
          : {}),
      },
    },
  ],
});

