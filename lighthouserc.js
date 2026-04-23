/**
 * Lighthouse CI — `npm run perf:lhci`
 *
 * - Sin `LHCI_TARGET_URL`: mide `dist/` estático (post export).
 * - Con `LHCI_TARGET_URL` (ej. preview/prod): mide esa URL (red + API reales).
 */
const target = (process.env.LHCI_TARGET_URL || '').trim();

const collect = target
  ? {
      url: [target],
      numberOfRuns: 2,
      settings: {
        preset: 'desktop',
        skipAudits: ['uses-rel-preconnect'],
      },
    }
  : {
      staticDistDir: './dist',
      numberOfRuns: 2,
      settings: {
        preset: 'desktop',
        skipAudits: ['uses-rel-preconnect'],
      },
    };

module.exports = {
  ci: {
    collect,
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
