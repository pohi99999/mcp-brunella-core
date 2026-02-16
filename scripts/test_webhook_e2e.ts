
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';

// Simple .env loader
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  console.log('Loading .env file...');
  const envConfig = fs.readFileSync(envPath, 'utf8');
  envConfig.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      if (value.length > 0 && value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
        value = value.replace(/^"|"$/g, '');
      }
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

const SECRET = process.env.GITHUB_WEBHOOK_SECRET || 'test-secret';
const URL = 'http://localhost:3000/api/v1/webhooks/github/webhook';
const MOCK_REPO = 'test-owner/test-repo';

async function run() {
  console.log('🚀 Running E2E Webhook Test');
  console.log(`Target: ${URL}`);
  
  const payload = {
    action: 'completed',
    workflow_run: {
      id: 123456,
      conclusion: 'failure',
      head_commit: { id: 'test-commit' }
    },
    repository: {
      name: MOCK_REPO,
      full_name: MOCK_REPO,
      owner: { login: 'test-owner' }
    }
  };
  
  const body = JSON.stringify(payload);
  const hmac = crypto.createHmac('sha256', SECRET);
  const signature = 'sha256=' + hmac.update(body).digest('hex');
  
  try {
    const res = await fetch(URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-GitHub-Event': 'workflow_run',
        'X-Hub-Signature-256': signature 
      },
      body
    });
    
    console.log(`Status: ${res.status}`);
    const data = await res.json();
    console.log('Response:', JSON.stringify(data, null, 2));
    
    if (res.ok && data.success) {
      console.log('✅ Success! Webhook processed.');
    } else {
      console.log('❌ Failure. Check server logs.');
      process.exit(1);
    }
  } catch (e: any) {
    console.error('❌ Connection failed:', e.message);
    process.exit(1);
  }
}

run();
