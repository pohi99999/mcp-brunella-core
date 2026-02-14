try {
  const { chromium } = require('playwright');
  console.log('Playwright is available');
} catch (e) {
  console.log('Playwright is NOT available:', e.message);
}
