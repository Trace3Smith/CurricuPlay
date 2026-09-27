import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', fullyParallel: true,
  use: { baseURL: 'http://127.0.0.1:5173', viewport: { width: 1920, height: 1080 } },
  webServer: [
    { command: 'npm run dev -- --host 127.0.0.1 --strictPort', url: 'http://127.0.0.1:5173', reuseExistingServer: !process.env.CI },
    { command: 'npm run dev:fixture', url: 'http://127.0.0.1:5174', reuseExistingServer: !process.env.CI, timeout: 60000 },
  ],
});
