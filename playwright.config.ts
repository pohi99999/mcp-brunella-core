import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './test/e2e',
    testMatch: ['**/*.spec.ts'],
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 1,
    workers: 1,
    reporter: [['html', { open: 'never' }], ['list']],
    timeout: 60000,        // 60s per test (dashboard boot takes time)
    expect: { timeout: 10000 },

    use: {
        baseURL: 'http://localhost:5173',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
        actionTimeout: 15000,
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
            reuseExistingServer: true,  // ne üdítsd ha már fut
            timeout: 60000,
        },
        {
            command: 'npm run dev:ui',
            port: 5173,
            reuseExistingServer: true,  // ne indítsd újra ha már fut
            timeout: 60000,
        },
    ],
});

