import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'src/review',
  testMatch: 'lugs.visual.ts',
  timeout: 90_000,
  use: {
    baseURL: 'http://localhost:4174',
    ...devices['Desktop Chrome'],
    viewport: { width: 1128, height: 900 },
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {},
  },
  webServer: {
    command: 'npm run dev -- --port 4174 --strictPort',
    port: 4174,
    reuseExistingServer: false,
  },
});
