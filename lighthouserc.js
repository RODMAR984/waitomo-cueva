/**
 * Lighthouse CI — umbrales que fallan el build (`npm run perf:lhci`).
 *
 * Requiere `dist/` (ej. tras `npm run perf:web:export`).
 * Ajustá minScore / maxNumericValue según evolución del bundle (Expo web suele ser pesado en CI).
 */
module.exports = {
  ci: {
    collect: {
      staticDistDir: './dist',
      numberOfRuns: 2,
      settings: {
        preset: 'desktop',
        // SPA: no penalizar tanto enlaces internos no rastreados
        skipAudits: ['uses-rel-preconnect'],
      },
    },
    upload: {
      target: 'filesystem',
      outputDir: './.lighthouseci',
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.25 }],
        'categories:accessibility': ['error', { minScore: 0.85 }],
        'categories:best-practices': ['warn', { minScore: 0.75 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.25 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 12000 }],
        'total-blocking-time': ['warn', { maxNumericValue: 900 }],
      },
    },
  },
};
