import { defineConfig, devices } from '@playwright/test';

const externalServer = process.env.E2E_EXTERNAL === '1';
const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ??
  (externalServer
    ? 'http://127.0.0.1:3100'
    : 'http://127.0.0.1:3101');
const testUrl = new URL(baseURL);

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: externalServer
    ? undefined
    : {
        command: 'npm run dev',
        url: `${baseURL}/api/health`,
        reuseExistingServer: true,
        timeout: 120_000,
        env: {
          AI_PROVIDER: 'mock',
          HOST: testUrl.hostname,
          PORT: testUrl.port || '3101',
          USAGE_LOG_PATH: '/tmp/relationship-arena-e2e-usage.jsonl',
          USAGE_ALERT_LOG_PATH:
            '/tmp/relationship-arena-e2e-alerts.jsonl',
        },
      },
});
