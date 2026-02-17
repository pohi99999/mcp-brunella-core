# Phase 3: GitHub Webhook Integration - Implementation Plan

**Track:** Jules Continuous AI Integration (JCAI)  
**Phase:** 3/4  
**Effort Estimate:** 4-5 hours (implementation + testing)  
**Priority:** P1 (Critical - enables automated fix deployment)  
**Status:** Ready to start  

---

## 📋 OVERVIEW

Transform GitHub workflow failures into automatic code fixes via Jules AI:
1. GitHub workflow fails → Webhook triggered
2. Error logs extracted & analyzed  
3. Jules generates fix → Creates PR
4. Auto-merge if confidence ≥75%

---

## 🎯 PHASE 3 IMPLEMENTATION TASKS

### Task 3.1: GitHub Webhook Handler (4 hours)

**File:** `src/server/routes/githubWebhook.ts`  
**Endpoint:** `POST /api/github/webhook`

#### 3.1.1 Basic Endpoint Structure
```typescript
// File: src/server/routes/githubWebhook.ts
import express from 'express';
import crypto from 'crypto';
import { Router } from 'express';

const router = Router();

// Webhook secret from GitHub Settings → Developer settings → Webhooks
const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || '';

// HMAC-SHA256 signature verification
function verifyGitHubSignature(
  request: express.Request,
  secret: string
): boolean {
  const signature = request.headers['x-hub-signature-256'] as string;
  if (!signature) return false;

  const payload = (request as any).rawBody || JSON.stringify(request.body);
  const hash = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  const expectedSignature = 'sha256=' + hash;
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

router.post('/webhook', express.raw({ type: 'application/json' }), 
  async (req: express.Request, res: express.Response) => {
    try {
      // 1. Verify signature
      if (!verifyGitHubSignature(req, GITHUB_WEBHOOK_SECRET)) {
        return res.status(403).json({ error: 'Invalid signature' });
      }

      const event = req.headers['x-github-event'] as string;
      const payload = JSON.parse((req as any).body || '{}');

      // 2. Filter relevant events
      if (event === 'workflow_run') {
        return handleWorkflowRun(payload, res);
      } else if (event === 'pull_request') {
        return handlePullRequest(payload, res);
      }

      // 3. Acknowledge other events
      return res.status(200).json({ message: 'Event received but not processed' });
    } catch (e: any) {
      console.error('Webhook error:', e.message);
      return res.status(500).json({ error: e.message });
    }
  }
);

async function handleWorkflowRun(payload: any, res: express.Response) {
  const { action, workflow_run } = payload;
  
  // Only process failures
  if (action !== 'completed' || workflow_run.conclusion !== 'failure') {
    return res.status(200).json({ message: 'Not a failure event' });
  }

  // Enqueue for error analysis
  const taskId = `workflow-${workflow_run.id}`;
  
  // TODO: Queue to scheduled tasks engine or direct handler
  logInfo('GitHubWebhook', `Processing failed workflow: ${workflow_run.name}`);
  
  return res.status(202).json({ taskId, message: 'Processing started' });
}

async function handlePullRequest(payload: any, res: express.Response) {
  const { action, pull_request } = payload;
  
  // TODO: Track PR for auto-merge approval
  logInfo('GitHubWebhook', `PR event: ${action} - #${pull_request.number}`);
  
  return res.status(200).json({ message: 'PR event acknowledged' });
}

export default router;
```

#### 3.1.2 GitHub App Setup (Manual)
**Steps:**
1. Go to GitHub Repo → Settings → Developer settings → GitHub Apps → New GitHub App
2. Create app with:
   - Name: `jules-auto-fixer`
   - Webhook URL: `https://<your-domain>/api/github/webhook`
   - Webhook secret: Generate random string (32+ chars)
   - Permissions:
     - `contents` (read/write) - for commits/branches
     - `pull_requests` (read/write) - for PRs
     - `workflows` (read) - for workflow logs
     - `statuses` (read) - for check runs
   - Events: `workflow_run`, `pull_request`, `check_run`

3. Store webhook secret in `.env`:
   ```
   GITHUB_WEBHOOK_SECRET=your_webhook_secret_here
   GITHUB_APP_ID=your_app_id
   GITHUB_PRIVATE_KEY=your_private_key_base64
   ```

#### 3.1.3 Express Server Registration
**File:** `src/server/web.ts`

```typescript
import githubWebhookRouter from './routes/githubWebhook.js';

// Mount webhook routes
app.use('/api/github', githubWebhookRouter);

// Add raw body parser for webhook verification BEFORE JSON parser
app.use(express.raw({ type: 'application/json' }));
app.use(express.json());
```

**Note:** Webhook signature verification requires raw request body, so must come before standard JSON parsing.

#### 3.1.4 Testing & Verification
```bash
# Test locally with ngrok
ngrok http 3000  # Get https URL

# Update GitHub webhook URL to ngrok forwarding address
# https://api.github.com/repos/{owner}/{repo}/hooks

# Trigger test via GitHub CLI
gh workflow run your-workflow.yml

# Watch logs
tail -f logs/webhook.log

# Or test manually with curl
curl -X POST http://localhost:3000/api/github/webhook \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: workflow_run" \
  -H "X-Hub-Signature-256: sha256=YOUR_CALCULATED_HASH" \
  -d @test-payload.json
```

---

### Task 3.2: Deployment Error Analyzer (3 hours)

**File:** `src/tools/deploymentAnalyzer.ts`  
**Purpose:** Parse GitHub workflow error logs and extract actionable fix prompts

#### 3.2.1 Error Log Fetcher
```typescript
// File: src/tools/deploymentAnalyzer.ts
import { Octokit } from '@octokit/rest';

interface WorkflowError {
  type: string;        // 'build' | 'test' | 'lint' | 'deploy'
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  context?: string;    // Surrounding code/error details
  confidence: number;  // 0-100
}

export async function analyzeWorkflowError(
  owner: string,
  repo: string,
  runId: number
): Promise<WorkflowError> {
  const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN
  });

  // 1. Get workflow run details
  const { data: run } = await octokit.actions.getWorkflowRun({
    owner,
    repo,
    run_id: runId
  });

  // 2. Get failed job logs
  const { data: jobs } = await octokit.actions.listJobsForWorkflowRun({
    owner,
    repo,
    run_id: runId
  });

  const failedJobs = jobs.jobs.filter((job: any) => job.conclusion === 'failure');

  for (const job of failedJobs) {
    const { data: logs } = await octokit.actions.downloadJobLogsForWorkflowRun({
      owner,
      repo,
      job_id: job.id
    });

    // 3. Parse logs for error patterns
    const error = parseErrorLogs(logs as string, job.name);
    if (error) return error;
  }

  throw new Error('Could not parse error logs');
}

function parseErrorLogs(logs: string, jobName: string): WorkflowError {
  // Error patterns
  const patterns = {
    build: [
      /typescript|tsx|compilation failed|TS\d+/gi,
      /error TS\d+:/gi,
      /Module not found/gi
    ],
    test: [
      /Test Suites:.*failed/gi,
      /FAIL .*test/gi,
      /Expected.*Received/gi
    ],
    lint: [
      /ESLint|prettier|lint error/gi,
      /error  /gi
    ],
    deploy: [
      /deployment failed|503|502|Connection refused/gi,
      /cloudflare|vercel|aws|azure/gi
    ]
  };

  // 1. Classify error type
  let type: WorkflowError['type'] = 'build';
  let confidence = 50;

  for (const [errorType, regexes] of Object.entries(patterns)) {
    const matches = regexes.filter(regex => regex.test(logs)).length;
    if (matches > 0) {
      type = errorType as any;
      confidence = Math.min(100, 50 + matches * 25);
      break;
    }
  }

  // 2. Extract error context
  const lines = logs.split('\n');
  const errorIndex = lines.findIndex(l => 
    /error|failed|Error|FAIL|ERROR/i.test(l)
  );
  
  const startIdx = Math.max(0, errorIndex - 2);
  const endIdx = Math.min(lines.length, errorIndex + 10);
  const context = lines.slice(startIdx, endIdx).join('\n');

  // 3. Set severity
  let severity: WorkflowError['severity'] = 'medium';
  if (jobName.includes('critical') || jobName.includes('security')) {
    severity = 'critical';
  } else if (jobName.includes('deploy') || jobName.includes('release')) {
    severity = 'high';
  }

  return {
    type,
    severity,
    message: lines[errorIndex] || 'Unknown error',
    context: context.substring(0, 500),
    confidence
  };
}
```

#### 3.2.2 Jules Fix Prompt Generator
```typescript
export function generateJulesFixPrompt(error: WorkflowError, repo: string): string {
  const prompt = `
You are Jules, an expert AI code fixer for the ${repo} project.

A GitHub workflow has failed with the following error:

**Error Type:** ${error.type}  
**Severity:** ${error.severity}  
**Confidence:** ${error.confidence}%

**Error Message:**
${error.message}

**Error Context:**
\`\`\`
${error.context}
\`\`\`

Your task:
1. Analyze the error and identify the root cause
2. Write a minimal, focused fix that resolves the error
3. Ensure the fix:
   - Does not introduce new errors
   - Follows the project's code style
   - Is backward compatible
   - Includes clear comments
4. Provide a brief commit message (50 chars max)

Output format:
\`\`\`json
{
  "analysis": "Brief explanation of the root cause",
  "fix_explanation": "What the fix does",
  "changed_files": ["src/file1.ts", "test/file2.test.ts"],
  "commit_message": "fix: Brief description"
}
\`\`\`

After the JSON, provide the actual code changes using git diff format.
`;

  return prompt;
}
```

---

### Task 3.5: Jules Integration Bridge (3 hours)

**File:** `src/core/julesIntegration.ts`  
**Purpose:** Orchestrate webhook → error analysis → Jules fix → PR creation

#### 3.5.1 Jules Fix Workflow Manager
```typescript
// File: src/core/julesIntegration.ts
import { analyzeWorkflowError } from '../tools/deploymentAnalyzer.js';
import { generateJulesFixPrompt } from '../tools/deploymentAnalyzer.js';
import { callJulesAPI } from '../core/julesAutomationService.js';
import { Octokit } from '@octokit/rest';

export interface JulesFixWorkflow {
  runId: number;
  owner: string;
  repo: string;
  branch: string;
  status: 'analyzing' | 'generating' | 'committing' | 'complete' | 'failed';
  error?: string;
}

export async function processWorkflowFailure(
  owner: string,
  repo: string,
  runId: number,
  defaultBranch: string = 'main'
): Promise<JulesFixWorkflow> {
  const workflow: JulesFixWorkflow = {
    runId,
    owner,
    repo,
    branch: `fix/workflow-${runId}-${Date.now()}`,
    status: 'analyzing'
  };

  try {
    // 1. Analyze error
    console.log('📊 Analyzing workflow error...');
    const error = await analyzeWorkflowError(owner, repo, runId);
    const prompt = generateJulesFixPrompt(error, `${owner}/${repo}`);

    workflow.status = 'generating';
    console.log('🤖 Requesting Jules fix...');
    
    // 2. Get fix from Jules
    const fix = await callJulesAPI(prompt);
    
    // Parse Jules response (expect JSON)
    const fixData = JSON.parse(fix);

    workflow.status = 'committing';
    console.log('📝 Creating PR with fix...');

    // 3. Create PR with auto-commit
    const octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN
    });

    // 3a. Create branch
    const { data: mainBranch } = await octokit.git.getRef({
      owner,
      repo,
      ref: `heads/${defaultBranch}`
    });

    await octokit.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${workflow.branch}`,
      sha: mainBranch.object.sha
    });

    // 3b. Commit changes (simplified - actual implementation would parse diff)
    // TODO: Parse Jules response and create actual commits
    
    // 3c. Create PR
    const { data: pr } = await octokit.pulls.create({
      owner,
      repo,
      title: fixData.commit_message,
      body: `
## Jules Auto-Fix

**Analysis:**
${fixData.analysis}

**What was fixed:**
${fixData.fix_explanation}

**Confidence:** ${error.confidence}%

---
*This PR was automatically generated by Jules AI *

Fixes workflow run: #${runId}
      `,
      head: workflow.branch,
      base: defaultBranch,
      draft: error.confidence < 75
    });

    console.log(`✅ PR created: #${pr.number}`);

    // 4. Auto-merge if confidence high
    if (error.confidence >= 75) {
      await octokit.pulls.merge({
        owner,
        repo,
        pull_number: pr.number,
        commit_message: fixData.commit_message,
        merge_method: 'squash'
      });
      console.log('✨ PR auto-merged (confidence ≥75%)');
    }

    workflow.status = 'complete';
    return workflow;

  } catch (err: any) {
    workflow.status = 'failed';
    workflow.error = err.message;
    console.error('❌ Jules fix failed:', err.message);
    throw err;
  }
}
```

---

### Task 3.8-3.10: Slack Notifications & Error Recovery (2 hours)

#### 3.8 Slack Notification System
```typescript
// src/core/slackNotifications.ts
import axios from 'axios';

export async function notifySlack(
  stage: 'analyzing' | 'fixed' | 'merged' | 'failed',
  runId: number,
  error?: string
) {
  const webhook = process.env.SLACK_WEBHOOK_URL;
  if (!webhook) {
    console.warn('SLACK_WEBHOOK_URL not set, skipping notification');
    return;
  }

  const messages: Record<string, any> = {
    analyzing: {
      color: 'warning',
      title: '🔍 Jules is analyzing workflow error',
      text: `Workflow run #${runId}`
    },
    fixed: {
      color: 'good',
      title: '✅ Jules generated a fix',
      text: `Check PR for workflow run #${runId}. Ready for review or auto-merge.`
    },
    merged: {
      color: 'good',
      title: '✨ Fix auto-merged',
      text: `Workflow #${runId} fix confidence ≥75%, PR merged automatically`
    },
    failed: {
      color: 'danger',
      title: '❌ Jules fix failed',
      text: `Workflow #${runId}: ${error || 'Unknown error'}`
    }
  };

  const message = messages[stage];

  await axios.post(webhook, {
    attachments: [{
      color: message.color,
      title: message.title,
      text: message.text,
      ts: Math.floor(Date.now() / 1000)
    }]
  });
}
```

#### 3.9-3.10 Fallback & Manual Review
```typescript
// In julesIntegration.ts, after fix fails:
if (error.confidence < 70) {
  // Create issue for manual review
  const { data: issue } = await octokit.issues.create({
    owner,
    repo,
    title: `[Jules] Manual review needed: ${error.type} failure in workflow #${runId}`,
    body: `
## Automated Analysis

Jules AI confidence is too low (${error.confidence}%) for automatic fixing.

**Error Type:** ${error.type}
**Severity:** ${error.severity}

Please review manually and apply fixes.

---
Workflow run: ${runId}
    `,
    labels: ['bug', 'needs-review', 'jules-auto-fix']
  });

  console.log(`📌 Created issue for manual review: #${issue.number}`);
}

// Retry logic (for transient failures)
async function retryWorkflowFix(
  owner: string,
  repo: string,
  runId: number,
  maxRetries: number = 3
) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await processWorkflowFailure(owner, repo, runId);
    } catch (err) {
      if (attempt === maxRetries) throw err;
      
      const backoff = Math.pow(2, attempt) * 1000;
      console.log(`Retry ${attempt}/${maxRetries} after ${backoff}ms...`);
      await new Promise(resolve => setTimeout(resolve, backoff));
    }
  }
}
```

---

## 📊 TESTING STRATEGY (2 hours)

### Test 1: Webhook Signature Verification
```bash
# Test with valid signature
curl -X POST http://localhost:3000/api/github/webhook \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: workflow_run" \
  -H "X-Hub-Signature-256: sha256=valid_signature" \
  -d '{"action":"completed","workflow_run":{"conclusion":"failure"}}'
# Expected: 202 Accepted

# Test with invalid signature
curl -X POST http://localhost:3000/api/github/webhook \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: workflow_run" \
  -H "X-Hub-Signature-256: sha256=invalid" \
  -d '...'
# Expected: 403 Forbidden
```

### Test 2: Error Analysis
```typescript
// test/deploymentAnalyzer.test.ts
describe('deploymentAnalyzer', () => {
  test('should detect TypeScript build errors', () => {
    const logs = 'error TS2304: Cannot find name "xyz"';
    const error = parseErrorLogs(logs, 'build');
    expect(error.type).toBe('build');
    expect(error.confidence).toBeGreaterThan(50);
  });

  test('should detect test failures', () => {
    const logs = 'Test Suites: 1 failed, 0 passed';
    const error = parseErrorLogs(logs, 'test');
    expect(error.type).toBe('test');
  });
});
```

### Test 3: Jules Integration
```bash
# Full integration test (with mock Jules)
npm test test/julesIntegration.test.ts

# Should trace:
# 1. Webhook received ✅
# 2. Error analyzed ✅
# 3. Jules prompt generated ✅
# 4. PR created ✅
# 5. Auto-merge attempted ✅
```

---

## ✅ CHECKLIST

### Implementation
- [ ] `src/server/routes/githubWebhook.ts` - Endpoint + signature verification
- [ ] `src/tools/deploymentAnalyzer.ts` - Error parsing + classification
- [ ] `src/core/julesIntegration.ts` - Orchestration + PR creation
- [ ] `src/core/slackNotifications.ts` - Async notifications
- [ ] `.env.example` - Add GITHUB_WEBHOOK_SECRET, SLACK_WEBHOOK_URL
- [ ] `src/server/web.ts` - Register webhook routes
- [ ] GitHub App setup instructions in README

### Testing
- [ ] Webhook signature verification tests
- [ ] Error classification tests (build, test, lint, deploy)
- [ ] Jules prompt generation tests
- [ ] API integration tests
- [ ] E2E workflow simulation

### Documentation
- [ ] JCAI_PROGRESS_UPDATE.md - Phase 3 completion section
- [ ] README.md - GitHub webhook setup guide
- [ ] .github/workflows - Add publish-fix workflow (optional)

---

## 🎬 NEXT STEPS

1. **Start 3.1** → Create GitHub webhook handler
2. **Test with ngrok** → Local webhook testing  
3. **Deploy to staging** → Test with actual workflow
4. **Enable in production** → Full integration

---

**Ready to implement?** Start with Task 3.1: GitHub Webhook Handler
