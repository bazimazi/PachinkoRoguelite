import { defineConfig, devices } from '@playwright/test'

const lightCapture = process.env.PLUMB_TEST_LIGHT === '1'

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 8_000 },
  outputDir: 'artifacts/playwright-results',
  reporter: [['list'], ['html', { outputFolder: 'artifacts/playwright-report', open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: lightCapture ? 'off' : 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: lightCapture ? 'off' : 'retain-on-failure',
  },
  projects: [
    { name: 'desktop-chromium', use: { browserName: 'chromium', viewport: { width: 1440, height: 900 } } },
    { name: 'phone-chromium', use: { ...devices['Pixel 7'], browserName: 'chromium', viewport: { width: 393, height: 851 } } },
    { name: 'tablet-chromium', use: { browserName: 'chromium', viewport: { width: 1024, height: 768 }, hasTouch: true } },
    { name: 'desktop-firefox', use: { browserName: 'firefox', viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
})
