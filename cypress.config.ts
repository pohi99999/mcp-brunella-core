import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5173',
    specPattern: 'testing/cypress/e2e/**/*.cy.{ts,js}',
    supportFile: 'testing/cypress/support/e2e.ts',
    screenshotsFolder: 'playwright-report/cypress-screenshots',
    videosFolder: 'playwright-report/cypress-videos',
    video: false,               // CI-ban false: gyorsabb
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 10000,
    pageLoadTimeout: 30000,
    viewportWidth: 1280,
    viewportHeight: 720,
  },
  component: {
    devServer: {
      framework: 'react',
      bundler: 'vite',
    },
    specPattern: 'apps/dashboard/**/*.cy.{ts,tsx}',
    supportFile: 'testing/cypress/support/component.ts',
  },
});
