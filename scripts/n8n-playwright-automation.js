/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const SCREENSHOT_DIR = 'F:\\mcp-brunella-core';
const BASE_URL = 'http://localhost:5678';
const EMAIL = 'dev@localhost.com';
const FIRST_NAME = 'Dev';
const LAST_NAME = 'User';
const PASSWORD = 'DevPass2026!';

function iso() {
  return new Date().toISOString();
}

async function log(msg, data) {
  if (data !== undefined) {
    console.log(`[${iso()}] ${msg} ${typeof data === 'string' ? data : JSON.stringify(data, null, 2)}`);
  } else {
    console.log(`[${iso()}] ${msg}`);
  }
}

async function screenshot(page, name) {
  const filePath = path.join(SCREENSHOT_DIR, name);
  await page.screenshot({ path: filePath, fullPage: false });
  console.log(`[${iso()}] [SCREENSHOT] ${filePath}`);
  return filePath;
}

function isVisibleHandle(el) {
  const style = window.getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  return (
    style &&
    style.visibility !== 'hidden' &&
    style.display !== 'none' &&
    parseFloat(style.opacity || '1') > 0 &&
    rect.width > 0 &&
    rect.height > 0
  );
}

async function collectVisibleUi(page) {
  return page.evaluate(() => {
    const visible = (el) => {
      if (!el) return false;
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return (
        style.visibility !== 'hidden' &&
        style.display !== 'none' &&
        parseFloat(style.opacity || '1') > 0 &&
        rect.width > 0 &&
        rect.height > 0
      );
    };
    const text = (el) => (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ');
    const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6'))
      .filter(visible)
      .map((el) => ({ tag: el.tagName.toLowerCase(), text: text(el) }));
    const labels = Array.from(document.querySelectorAll('label'))
      .filter(visible)
      .map((el) => ({ text: text(el), for: el.getAttribute('for') || null }));
    const fields = Array.from(document.querySelectorAll('input, textarea, select, button'))
      .filter(visible)
      .map((el) => {
        const base = {
          tag: el.tagName.toLowerCase(),
          type: el.getAttribute('type') || null,
          name: el.getAttribute('name') || null,
          id: el.id || null,
          placeholder: el.getAttribute('placeholder') || null,
          ariaLabel: el.getAttribute('aria-label') || null,
          text: (el.tagName.toLowerCase() === 'button' ? text(el) : null),
          value:
            el.tagName.toLowerCase() === 'input' || el.tagName.toLowerCase() === 'textarea'
              ? (el.type === 'password' ? '***masked***' : el.value)
              : null,
          checked: 'checked' in el ? el.checked : null,
          disabled: !!el.disabled,
        };
        return base;
      });
    const validationMessages = Array.from(document.querySelectorAll(':invalid'))
      .filter(visible)
      .map((el) => ({
        tag: el.tagName.toLowerCase(),
        name: el.getAttribute('name') || null,
        id: el.id || null,
        validationMessage: el.validationMessage || null,
      }));
    const errorIndicators = Array.from(
      document.querySelectorAll('[role="alert"], .error, .errors, [aria-invalid="true"], [data-testid*="error"]')
    )
      .filter(visible)
      .map((el) => text(el))
      .filter(Boolean);
    const bodyText = text(document.body);
    return {
      headings,
      labels,
      fields,
      validationMessages,
      errorIndicators,
      bodyText,
    };
  });
}

async function findButtonByText(page, candidates) {
  for (const candidate of candidates) {
    const loc = page.getByRole('button', { name: new RegExp(`^\\s*${candidate}\\s*$`, 'i') });
    if (await loc.count()) return loc.first();
  }
  return null;
}

async function findLinkByText(page, candidates) {
  for (const candidate of candidates) {
    const loc = page.getByRole('link', { name: new RegExp(candidate, 'i') });
    if (await loc.count()) return loc.first();
  }
  return null;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  try {
    const client = await context.newCDPSession(page);
    await client.send('Storage.clearDataForOrigin', {
      origin: BASE_URL,
      storageTypes: 'all',
    });
    await context.clearCookies();
    await log('Cleared storage/cookies for localhost and created fresh context');
  } catch (e) {
    await log('Storage clear warning', e.message);
  }

  async function recordStep(stepName) {
    const data = await collectVisibleUi(page);
    await log(stepName, {
      timestamp: iso(),
      url: page.url(),
      title: await page.title().catch(() => ''),
      headings: data.headings,
      labels: data.labels,
      fields: data.fields,
      validationMessages: data.validationMessages,
      errorIndicators: data.errorIndicators,
      bodyText: data.bodyText,
    });
  }

  try {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    await recordStep('Initial page state');
    await screenshot(page, 'n8n-step1-initial.png');
  } catch (e) {
    await log('Step 1 failed', e.message);
    try { await screenshot(page, 'n8n-error-step1.png'); } catch (_e) { /* ignore */ }
  }

  try {
    const ui = await collectVisibleUi(page);
    const lower = JSON.stringify(ui).toLowerCase();
    const setupLike =
      lower.includes('setup') ||
      lower.includes('create owner') ||
      lower.includes('first name') ||
      lower.includes('last name') ||
      lower.includes('confirm password');

    if (setupLike) {
      await log('Setup wizard detected');
      const emailInput = page.locator('input[type="email"], input[name*="email" i], input[placeholder*="email" i]').first();
      const firstNameInput = page.locator('input[name*="first" i], input[placeholder*="first name" i], input[aria-label*="first name" i]').first();
      const lastNameInput = page.locator('input[name*="last" i], input[placeholder*="last name" i], input[aria-label*="last name" i]').first();
      const passwordInput = page.locator('input[type="password"]').nth(0);
      const confirmInput = page.locator('input[type="password"]').nth(1);

      if (await emailInput.count()) await emailInput.fill(EMAIL);
      if (await firstNameInput.count()) await firstNameInput.fill(FIRST_NAME);
      if (await lastNameInput.count()) await lastNameInput.fill(LAST_NAME);
      if (await passwordInput.count()) await passwordInput.fill(PASSWORD);
      if (await confirmInput.count()) await confirmInput.fill(PASSWORD);

      const setupButton = await findButtonByText(page, ['setup', 'create owner', 'continue', 'create account', 'next']);
      if (setupButton) await setupButton.click();
      await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
      await recordStep('After setup submission');
      await screenshot(page, 'n8n-step2-after-setup.png');
    } else {
      await log('No setup wizard detected');
    }
  } catch (e) {
    await log('Step 2 failed', e.message);
    try { await screenshot(page, 'n8n-error-step2.png'); } catch (_e) { /* ignore */ }
  }

  try {
    const ui = await collectVisibleUi(page);
    const lower = JSON.stringify(ui).toLowerCase();
    const hasEmail = lower.includes('email') && lower.includes('password');
    const signInButton = await findButtonByText(page, ['sign in', 'log in', 'login', 'sign in with email']);
    if (hasEmail && signInButton) {
      await log('Login page detected');
      await log('Login UI', {
        labels: ui.labels,
        buttons: ui.fields.filter((f) => f.tag === 'button').map((b) => b.text),
      });
      const emailInput = page.locator('input[type="email"], input[name*="email" i], input[placeholder*="email" i]').first();
      const passwordInput = page.locator('input[type="password"]').first();
      if (await emailInput.count()) await emailInput.fill(EMAIL);
      if (await passwordInput.count()) await passwordInput.fill(PASSWORD);
      await signInButton.click();
      await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
      await recordStep('After login');
      await screenshot(page, 'n8n-step3-after-login.png');
    } else {
      await log('Already signed in');
    }
  } catch (e) {
    await log('Step 3 failed', e.message);
    try { await screenshot(page, 'n8n-error-step3.png'); } catch (_e) { /* ignore */ }
  }

  const targetWorkflows = [
    'Brunella Bookkeeping Email Intake Scaffold',
    'Brunella Bookkeeping Reconciliation Scaffold',
    'Brunella Bookkeeping NAV Validation Scaffold',
    'Brunella Bookkeeping Exception Notify Scaffold',
  ];
  let emailWorkflowPresent = false;

  try {
    const navLink = await findLinkByText(page, ['workflows']);
    if (navLink) {
      await navLink.click();
    } else {
      await page.goto(`${BASE_URL}/workflows`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    }
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    const workflowsData = await collectVisibleUi(page);
    const visibleTitles = workflowsData.bodyText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((s) => s.length < 200);
    await log('Workflows list visible titles', visibleTitles);

    const pageText = workflowsData.bodyText.toLowerCase();
    for (const title of targetWorkflows) {
      const present = pageText.includes(title.toLowerCase());
      const status = present ? 'PRESENT' : 'MISSING';
      const badge = present ? 'present' : '';
      if (title === targetWorkflows[0] && present) emailWorkflowPresent = true;
      await log(`Workflow status: ${title}`, { status, badgeText: badge });
    }
    await screenshot(page, 'n8n-step4-workflows.png');
  } catch (e) {
    await log('Step 4 failed', e.message);
    try { await screenshot(page, 'n8n-error-step4.png'); } catch (_e) { /* ignore */ }
  }

  try {
    if (emailWorkflowPresent) {
      const wfLink = page.getByText(targetWorkflows[0], { exact: false }).first();
      await wfLink.click();
      await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
      const editorUi = await collectVisibleUi(page);
      const canvas = await page.locator('[data-testid*="canvas"], .vue-flow, .react-flow, [aria-label*="canvas" i], [class*="canvas" i], [class*="workflow" i]').first();
      const nodeCount = await page.locator('.react-flow__node, .vue-flow__node, [data-test-id*="node"], [class*="node"]').count().catch(() => 0);
      await log('Workflow editor visible', {
        url: page.url(),
        title: await page.title().catch(() => ''),
        headings: editorUi.headings,
        nodeCount,
        nodeNames: editorUi.bodyText
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean)
          .filter((s) => s.length < 120)
          .slice(0, 50),
      });
      if (canvas) {
        await screenshot(page, 'n8n-step5-workflow-editor.png');
      } else {
        await screenshot(page, 'n8n-step5-workflow-editor.png');
      }
    } else {
      await log('Email Intake workflow missing; skipping editor open');
    }
  } catch (e) {
    await log('Step 5 failed', e.message);
    try { await screenshot(page, 'n8n-error-step5.png'); } catch (_e) { /* ignore */ }
  }

  try {
    const avatarCandidates = [
      page.locator('[aria-label*="user" i]'),
      page.locator('[aria-label*="account" i]'),
      page.locator('button[aria-haspopup="menu"]'),
      page.locator('button').filter({ hasText: /dev|user|avatar|account/i }),
    ];
    let avatar = null;
    for (const loc of avatarCandidates) {
      if (await loc.count()) {
        avatar = loc.first();
        break;
      }
    }
    if (avatar) {
      await avatar.click();
      await page.waitForTimeout(500);
      const signOut = await findButtonByText(page, ['sign out', 'log out', 'logout']);
      const signOutLink = await findLinkByText(page, ['sign out', 'log out', 'logout']);
      if (signOut) {
        await signOut.click();
      } else if (signOutLink) {
        await signOutLink.click();
      } else {
        await log('Logout option not found');
      }
      await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {});
      await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
      await log('After logout', { url: page.url(), title: await page.title().catch(() => '') });
      await screenshot(page, 'n8n-step6-logout.png');
    } else {
      await log('No avatar/menu found for logout');
      try { await screenshot(page, 'n8n-error-step6.png'); } catch (_e) { /* ignore */ }
    }
  } catch (e) {
    await log('Step 6 failed', e.message);
    try { await screenshot(page, 'n8n-error-step6.png'); } catch (_e) { /* ignore */ }
  }

  await context.close();
  await browser.close();
  await log('Browser context closed');
})().catch(async (err) => {
  console.error(`[${iso()}] FATAL`, err);
  process.exitCode = 1;
});
