import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './test/e2e',
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: 1,
    reporter: [['html', { open: 'never' }], ['list']],
    timeout: 30000,
    expect: { timeout: 5000 },

    use: {
        baseURL: 'http://localhost:5173',
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
            command: 'node build/index.js',
            port: 3000,
            env: { WEB_UI_ENABLED: '1' },
            reuseExistingServer: true,
            timeout: 30000,
        },
        {
            command: 'npm run dev:ui',
            port: 5173,
            reuseExistingServer: true,
            timeout: 30000,
        },
    ],
});
