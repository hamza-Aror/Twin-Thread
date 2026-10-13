import { defineConfig } from '@playwright/test';

// End-to-end tests run against the production preview in demo mode, so they do not depend on the weather API.
// First time only: npx playwright install chromium
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  use: { baseURL: 'http://localhost:4173', trace: 'retain-on-failure' },
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
