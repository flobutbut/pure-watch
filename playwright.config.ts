import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  // One browser at a time: each scenario renders the 3D watch and its thumbnail grid.
  // Several browsers in parallel saturate the pages until their timeouts expire.
  workers: 1,
  use: {
    baseURL: 'http://localhost:4173',
    // The site follows the browser language: the journeys are written for the French site.
    locale: 'fr-FR',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {},
  },
  webServer: {
    command: 'EPURE_REVIEW=1 npm run build && npm run preview -- --port 4173 --strictPort',
    port: 4173,
    // The production build can exceed Playwright's default 60 s on a cold cache.
    timeout: 300_000,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
