import { defineConfig, devices } from '@playwright/test';

// Separate ports so E2E never talks to a running `pnpm dev`.
const apiPort = 3101;
const webPort = 5174;
const isCi = Boolean(process.env.CI);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCi,
  retries: isCi ? 1 : 0,
  workers: isCi ? 2 : undefined,
  reporter: isCi
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${webPort}`,
    locale: 'pl-PL',
    timezoneId: 'Europe/Warsaw',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    {
      command: 'node --import tsx scripts/e2eServer.ts',
      cwd: 'apps/api',
      env: { PORT: String(apiPort) },
      url: `http://localhost:${apiPort}/health`,
      reuseExistingServer: false,
      gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 },
      timeout: 120_000,
    },
    {
      command: `pnpm exec vite --port ${webPort} --strictPort`,
      cwd: 'apps/web',
      env: { MRUOS_API_PROXY_TARGET: `http://localhost:${apiPort}` },
      url: `http://localhost:${webPort}`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
