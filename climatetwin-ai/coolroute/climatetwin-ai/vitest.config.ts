import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Unit and component tests. End-to-end browser tests live in /e2e and use Playwright.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/tests/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
