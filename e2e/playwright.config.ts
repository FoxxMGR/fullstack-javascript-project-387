import { defineConfig, devices } from '@playwright/test';

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:8080';
const WEB_URL = process.env.WEB_URL ?? 'http://localhost:5173';

/**
 * Конфигурация e2e-тестов.
 *
 * Перед запуском тестов Playwright сам поднимает бэкенд (server, порт 8080) и
 * фронтенд (web + Vite, порт 5173 с прокси `/guest`/`/admin` → 8080). Таким
 * образом каждый прогон тестирует связку "фронтенд ↔ бэкенд" целиком.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Тесты разделяют состояние одного инстанса бэкенда (in-memory store),
  // поэтому выполняются строго последовательно — иначе параллельные тесты
  // занимают одни и те же слоты и получают взаимные 409.
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: WEB_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'npm --prefix ../server start',
      url: `${BACKEND_URL}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: 'npm --prefix ../web run dev',
      url: WEB_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});