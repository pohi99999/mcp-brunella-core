// Cypress E2E Support fájl
// Globális beállítások, custom command-ok

// @ts-expect-error -- ./commands has no type declarations available
import './commands';

// Uncaught exception handling — React 19 + Vite devmode néha dob
Cypress.on('uncaught:exception', (err) => {
  // Ignore ResizeObserver loop errors (harmless)
  if (err.message.includes('ResizeObserver loop')) return false;
  // Ignore dynamic import errors in dev mode
  if (err.message.includes('dynamically imported module')) return false;
  return true;
});
