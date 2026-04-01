/**
 * n8n Full Automation - All 5 TODOs
 * Uses fresh Chrome profile copy for authenticated session
 */
import { chromium } from 'playwright';
import { mkdir, writeFile, readFile } from 'fs/promises';
import { existsSync } from 'fs';

await mkdir('tasks/screenshots', { recursive: true });

const PROFILE = 'C:\\Users\\pohi9\\.cache\\chrome-devtools-mcp\\chrome-profile-auto';
const N8N = 'https://iszapfalo.app.n8n.cloud';
const RESULTS = {};

console.log('=== n8n Full Automation ===');
console.log(new Date().toISOString());

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  viewport: { width: 1400, height: 900 },
  ignoreHTTPSErrors: true
});

const page = await ctx.newPage();
page.setDefaultTimeout(30000);

// ── Verify login ──────────────────────────────────────────────────
console.log('\n[0] Verifying session...');
await page.goto(`${N8N}/home/workflows`, { waitUntil: 'networkidle', timeout: 40000 });
await page.waitForTimeout(3000);

if (page.url().includes('/signin')) {
  console.log('❌ Session expired! Cannot proceed.');
  const cookies = await ctx.cookies();
  const n8nCookie = cookies.find(c => c.name === 'n8n-auth');
  console.log('n8n-auth cookie:', n8nCookie ? `expires ${new Date(n8nCookie.expires * 1000).toISOString()}` : 'NOT FOUND');
  await ctx.close();
  process.exit(1);
}

console.log('✅ Session valid! URL:', page.url());
await page.screenshot({ path: 'tasks/screenshots/00_dashboard.png', fullPage: false });

// ── API helper ────────────────────────────────────────────────────
async function api(path, method = 'GET', body = null) {
  const r = await page.evaluate(async ({path, method, body, base}) => {
    const opts = { method, credentials: 'include', headers: {'Accept':'application/json','Content-Type':'application/json'} };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(base + '/rest' + path, opts);
    const text = await res.text();
    return { status: res.status, text };
  }, { path, method, body, base: N8N });
  
  try { return { ok: r.status < 400, status: r.status, data: JSON.parse(r.text) }; }
  catch { return { ok: r.status < 400, status: r.status, data: r.text }; }
}

// ── Fetch all workflows and credentials ────────────────────────────
console.log('\n[0] Fetching data via API...');
const wfResp = await api('/workflows?limit=100');
const credResp = await api('/credentials?limit=100');

let allWorkflows = [], allCreds = [];
if (wfResp.ok) {
  allWorkflows = wfResp.data?.data || [];
  console.log(`✅ ${allWorkflows.length} workflows`);
  for (const wf of allWorkflows) {
    console.log(`  [${wf.id}] "${wf.name}" active:${wf.active}`);
  }
} else {
  console.log('❌ Workflows API failed:', wfResp.status);
}

if (credResp.ok) {
  allCreds = credResp.data?.data || [];
  console.log(`✅ ${allCreds.length} credentials`);
  for (const c of allCreds) {
    console.log(`  [${c.id}] "${c.name}" type:${c.type}`);
  }
} else {
  console.log('❌ Credentials API failed:', credResp.status);
}

// ════════════════════════════════════════════════════════════════
// TODO-5: Check Webhook path in WF-01
// ════════════════════════════════════════════════════════════════
console.log('\n=== TODO-5: Webhook path check ===');
const wf01 = allWorkflows.find(wf => wf.name.match(/^(01|ISZ.*hiba)/i) || wf.id === 'hLop0AeEKH6NyUaj');
// Try to find by index or by search
const wf01candidates = allWorkflows.filter(wf => wf.name.match(/01|hiba/i));
console.log('WF-01 candidates:', wf01candidates.map(w => `[${w.id}] ${w.name}`));

let webhookPath = null;
const wf01target = wf01candidates[0];
if (wf01target) {
  const wfDetail = await api(`/workflows/${wf01target.id}`);
  if (wfDetail.ok) {
    const nodes = wfDetail.data?.nodes || [];
    const webhookNode = nodes.find(n => n.type === 'n8n-nodes-base.webhook' || n.type?.includes('webhook'));
    if (webhookNode) {
      webhookPath = webhookNode.parameters?.path;
      const httpMethod = webhookNode.parameters?.httpMethod;
      console.log(`✅ Webhook node found: "${webhookNode.name}"`);
      console.log(`   Path: ${webhookPath}`);
      console.log(`   Method: ${httpMethod}`);
      
      // Check if any other workflow has the same path
      const duplicates = [];
      for (const wf of allWorkflows) {
        if (wf.id === wf01target.id) continue;
        const detail = await api(`/workflows/${wf.id}`);
        if (detail.ok) {
          const webhookNodes = (detail.data?.nodes || []).filter(n => n.type?.includes('webhook'));
          for (const wn of webhookNodes) {
            if (wn.parameters?.path === webhookPath) {
              duplicates.push(`[${wf.id}] ${wf.name}: ${wn.parameters.path}`);
            }
          }
        }
      }
      
      if (duplicates.length > 0) {
        console.log(`⚠️  DUPLICATE WEBHOOK PATHS: ${duplicates.join(', ')}`);
        RESULTS.todo5 = `⚠️ CONFLICT: path="${webhookPath}" also used in: ${duplicates.join('; ')}`;
      } else {
        console.log(`✅ Webhook path "${webhookPath}" is UNIQUE`);
        RESULTS.todo5 = `✅ Path "${webhookPath}" is unique - no conflicts found`;
      }
    } else {
      console.log('No webhook node found in WF-01');
      console.log('Nodes:', nodes.map(n => `${n.name}(${n.type})`).join(', '));
      RESULTS.todo5 = '⚠️ No webhook node found in WF-01';
    }
  }
} else {
  console.log('WF-01 not identified, checking all webhooks...');
  // Find all webhook paths across all workflows
  const allWebhooks = [];
  for (const wf of allWorkflows) {
    const detail = await api(`/workflows/${wf.id}`);
    if (detail.ok) {
      const webhookNodes = (detail.data?.nodes || []).filter(n => n.type?.includes('webhook'));
      for (const wn of webhookNodes) {
        if (wn.parameters?.path) {
          allWebhooks.push({ wfId: wf.id, wfName: wf.name, path: wn.parameters.path, method: wn.parameters?.httpMethod });
        }
      }
    }
  }
  console.log('All webhook paths:', JSON.stringify(allWebhooks, null, 2));
  RESULTS.todo5 = `All webhook paths: ${allWebhooks.map(w => `${w.wfName}:${w.path}`).join(', ')}`;
}

// ════════════════════════════════════════════════════════════════
// TODO-4: Replace Airtable credentials in 4 workflows
// ════════════════════════════════════════════════════════════════
console.log('\n=== TODO-4: Update Airtable credentials ===');

// Find ISZ_Airtable_PAT_v3 credential ID
const airtableCred = allCreds.find(c => c.name === 'ISZ_Airtable_PAT_v3');
console.log('ISZ_Airtable_PAT_v3:', airtableCred ? `[${airtableCred.id}] type:${airtableCred.type}` : 'NOT FOUND');

// Target workflows: the 4 that need Airtable credential update
const airtableTargetNames = [
  'Feladatok státuszállítás Telegram chat',
  'Airtable-Google Calendar Szinkron',
  '04 - ISZ Weekly Reminder',
  'Google Calendar Szinkron'
];

const airtableWFs = allWorkflows.filter(wf => 
  airtableTargetNames.some(name => wf.name.toLowerCase().includes(name.toLowerCase().slice(0, 20)))
);
console.log('Target Airtable workflows found:', airtableWFs.map(w => `[${w.id}] ${w.name}`));

if (airtableCred) {
  let updated = 0;
  for (const wf of airtableWFs) {
    console.log(`\nProcessing: "${wf.name}" [${wf.id}]`);
    const detail = await api(`/workflows/${wf.id}`);
    if (!detail.ok) {
      console.log('  ❌ Failed to fetch workflow details');
      continue;
    }
    
    const wfData = detail.data;
    const nodes = wfData.nodes || [];
    let modified = false;
    
    for (const node of nodes) {
      if (node.credentials) {
        for (const [credType, credInfo] of Object.entries(node.credentials)) {
          if (credType.toLowerCase().includes('airtable') || credInfo.name?.toLowerCase().includes('airtable')) {
            const oldId = credInfo.id;
            const oldName = credInfo.name;
            if (oldId !== airtableCred.id) {
              console.log(`  Node "${node.name}": ${credType} was [${oldId}] "${oldName}" → now [${airtableCred.id}] "${airtableCred.name}"`);
              node.credentials[credType] = { id: airtableCred.id, name: airtableCred.name };
              modified = true;
            } else {
              console.log(`  Node "${node.name}": Already using ${airtableCred.name} ✓`);
            }
          }
        }
      }
    }
    
    if (modified) {
      // PUT the updated workflow
      const updateResp = await api(`/workflows/${wf.id}`, 'PUT', {
        ...wfData,
        nodes: nodes
      });
      
      if (updateResp.ok) {
        console.log(`  ✅ Updated workflow "${wf.name}"`);
        updated++;
      } else {
        console.log(`  ❌ Failed to update: ${updateResp.status} ${JSON.stringify(updateResp.data).slice(0, 200)}`);
      }
    } else {
      console.log(`  ✓ No changes needed`);
    }
  }
  
  RESULTS.todo4 = `Updated Airtable credentials in ${updated}/${airtableWFs.length} workflows`;
  console.log(`\nTODO-4 complete: ${RESULTS.todo4}`);
} else {
  RESULTS.todo4 = '❌ ISZ_Airtable_PAT_v3 credential not found';
  console.log('❌ ISZ_Airtable_PAT_v3 not found in credentials list!');
  console.log('All Airtable creds:', allCreds.filter(c => c.name.toLowerCase().includes('airtable')).map(c => `[${c.id}] ${c.name}`));
}

// ════════════════════════════════════════════════════════════════
// TODO-1: Check Gmail OAuth credential status
// ════════════════════════════════════════════════════════════════
console.log('\n=== TODO-1: Gmail OAuth credential check ===');
const gmailCred = allCreds.find(c => c.name === 'Gmail account 4');
if (gmailCred) {
  console.log(`Found: [${gmailCred.id}] "${gmailCred.name}" type:${gmailCred.type}`);
  
  // Navigate to the credential to check its status
  await page.goto(`${N8N}/home/credentials/${gmailCred.id}`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(3000);
  
  await page.screenshot({ path: 'tasks/screenshots/t1_gmail_cred.png' });
  
  const pageContent = await page.locator('body').textContent();
  const hasError = pageContent.toLowerCase().includes('error') || 
                   pageContent.toLowerCase().includes('expired') ||
                   pageContent.toLowerCase().includes('reconnect');
  const hasConnected = pageContent.toLowerCase().includes('connected') ||
                       pageContent.toLowerCase().includes('valid');
  
  console.log(`  Error indicators: ${hasError}`);
  console.log(`  Connected indicators: ${hasConnected}`);
  
  // Look for specific status indicators
  const statusText = await page.locator('[class*="status"], [class*="badge"], [class*="alert"]').allTextContents().catch(() => []);
  console.log('  Status elements:', statusText.slice(0, 5));
  
  // Try to test the credential
  const testResp = await api(`/credentials/${gmailCred.id}/test`, 'POST', {});
  console.log(`  Test API result: ${testResp.status}`, JSON.stringify(testResp.data).slice(0, 200));
  
  if (testResp.ok && testResp.data?.status === 'OK') {
    RESULTS.todo1 = `✅ Gmail account 4 [${gmailCred.id}] is connected and working`;
  } else {
    RESULTS.todo1 = `⚠️ Gmail account 4 [${gmailCred.id}] may need reconnection. Test result: ${JSON.stringify(testResp.data).slice(0, 100)}`;
  }
} else {
  RESULTS.todo1 = '❌ Gmail account 4 not found in credentials';
}
console.log('TODO-1:', RESULTS.todo1);

// ════════════════════════════════════════════════════════════════
// TODO-2: Create Gmail labels (via Gmail UI)
// ════════════════════════════════════════════════════════════════
console.log('\n=== TODO-2: Gmail labels ===');
const labelsToCreate = ['Surges', 'Ajanlatkeres', 'Kotras', 'Egyeb'];

try {
  // Navigate to Gmail
  await page.goto('https://mail.google.com', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  
  const gmailUrl = page.url();
  console.log('Gmail URL:', gmailUrl);
  await page.screenshot({ path: 'tasks/screenshots/t2_gmail_start.png' });
  
  if (gmailUrl.includes('accounts.google.com') || gmailUrl.includes('signin')) {
    console.log('Not logged into Gmail via this browser profile');
    
    // Check which account is available
    const accountLinks = await page.locator('a[href*="@gmail"], [data-email]').allTextContents().catch(() => []);
    console.log('Account links:', accountLinks.slice(0, 5));
    
    RESULTS.todo2 = '⚠️ Gmail not authenticated in this browser profile. Need manual label creation.';
    console.log('TODO-2: Needs manual intervention');
  } else if (gmailUrl.includes('mail.google.com')) {
    console.log('✅ Gmail loaded!');
    await page.screenshot({ path: 'tasks/screenshots/t2_gmail_inbox.png' });
    
    // Get current account
    const accountEl = await page.locator('[aria-label*="Google Account"], [class*="account"]').first().textContent().catch(() => 'unknown');
    console.log('Gmail account:', accountEl.slice(0, 50));
    
    // Use Gmail API-style approach: Settings > Labels
    await page.goto('https://mail.google.com/#settings/labels', { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'tasks/screenshots/t2_gmail_settings_labels.png' });
    
    const createdLabels = [];
    for (const label of labelsToCreate) {
      console.log(`  Creating label: ${label}`);
      
      // Click "Create new label" button
      const createBtn = page.locator('button:has-text("Create new label"), [name="newlabel"], button[data-tooltip*="label"]').first();
      if (await createBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await createBtn.click();
        await page.waitForTimeout(1000);
        
        const labelInput = page.locator('input[placeholder*="label" i], input[name="newlabel"], input[aria-label*="label" i]').first();
        if (await labelInput.isVisible({ timeout: 3000 }).catch(() => false)) {
          await labelInput.fill(label);
          
          const createConfirmBtn = page.locator('button:has-text("Create"), [jsname*="create"]').last();
          await createConfirmBtn.click();
          await page.waitForTimeout(2000);
          
          createdLabels.push(label);
          console.log(`    ✅ Created: ${label}`);
        }
      } else {
        console.log(`    ❌ Create button not found`);
        await page.screenshot({ path: `tasks/screenshots/t2_label_${label}_fail.png` });
      }
    }
    
    RESULTS.todo2 = createdLabels.length > 0 
      ? `✅ Created labels: ${createdLabels.join(', ')}` 
      : '❌ Could not create labels - button not found';
  }
} catch(e) {
  console.error('TODO-2 error:', e.message);
  RESULTS.todo2 = `❌ Error: ${e.message}`;
}

// ════════════════════════════════════════════════════════════════
// TODO-3: Check Google Drive credential
// ════════════════════════════════════════════════════════════════
console.log('\n=== TODO-3: Google Drive credential check ===');
const driveCred = allCreds.find(c => c.name === 'ISZ_GoogleDrive_Prod');
const driveCredAlt = allCreds.find(c => c.name?.toLowerCase().includes('drive') || c.type?.toLowerCase().includes('drive'));

if (driveCred) {
  console.log(`✅ ISZ_GoogleDrive_Prod found: [${driveCred.id}]`);
  
  // Find workflow 07
  const wf07 = allWorkflows.find(wf => wf.name.match(/07|google.drive/i));
  if (wf07) {
    const detail = await api(`/workflows/${wf07.id}`);
    if (detail.ok) {
      const driveNodes = (detail.data?.nodes || []).filter(n => n.type?.toLowerCase().includes('drive'));
      console.log(`  WF-07 has ${driveNodes.length} Drive nodes`);
      // Check if already using ISZ_GoogleDrive_Prod
      for (const node of driveNodes) {
        const creds = node.credentials;
        console.log(`  Node "${node.name}" credentials:`, JSON.stringify(creds));
      }
    }
  }
  RESULTS.todo3 = `✅ ISZ_GoogleDrive_Prod exists [${driveCred.id}]. Check WF-07 connection.`;
} else {
  console.log('❌ ISZ_GoogleDrive_Prod NOT found');
  if (driveCredAlt) console.log('  Similar credential:', `[${driveCredAlt.id}] ${driveCredAlt.name}`);
  
  console.log('All credentials:');
  for (const c of allCreds) console.log(`  [${c.id}] "${c.name}" ${c.type}`);
  
  RESULTS.todo3 = '❌ ISZ_GoogleDrive_Prod not found - needs to be created manually (requires Google OAuth)';
}

// ════════════════════════════════════════════════════════════════
// Summary
// ════════════════════════════════════════════════════════════════
console.log('\n' + '='.repeat(60));
console.log('FINAL RESULTS');
console.log('='.repeat(60));
for (const [key, val] of Object.entries(RESULTS)) {
  console.log(`${key}: ${val}`);
}

await writeFile('tasks/automation_results.json', JSON.stringify({
  timestamp: new Date().toISOString(),
  results: RESULTS,
  workflows: allWorkflows.map(w => ({id: w.id, name: w.name, active: w.active})),
  credentials: allCreds.map(c => ({id: c.id, name: c.name, type: c.type}))
}, null, 2));

console.log('\nResults saved to tasks/automation_results.json');
await ctx.close();
