# 🧪 JCAI Phase 3 - Testing & Verification Guide

## 📋 Overview

This guide provides 3 comprehensive testing approaches for verifying JCAI Phase 3 components:

1. **Unit Tests** - Test individual components (sig verification, error analysis, Jules mocks)
2. **Manual Webhook Tests** - Send real webhook payloads via curl/PostMan to local/ngrok server
3. **End-to-End Tests** - Simulate complete workflow from webhook to PR creation

---

## 🏃 Quick Start

### Prerequisites

```bash
# 1. Install dependencies
npm install

# 2. Build TypeScript
npm run build

# 3. Set environment variables
export GITHUB_WEBHOOK_SECRET="your-webhook-secret"
export GITHUB_TOKEN="your-github-token"
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK"
export JULES_MOCK_MODE="true"  # Use mock mode for testing
```

### Running Tests

```bash
# Run ALL JCAI Phase 3 tests
npm test -- jcai

# Run specific test suite
npm test jcai-phase3-verification.test.ts
npm test jcai-e2e-test.ts

# Run tests in watch mode
npm run test:watch -- jcai
```

### Expected Output

```
✓ JCAI Phase 3: GitHub Webhook Signature Verification (5 tests)
✓ JCAI Phase 3: Error Log Analysis (5 tests)
✓ JCAI Phase 3: Mock Webhook Payloads (2 tests)
✓ JCAI Phase 3: Jules AI Fix Generation (Mock) (3 tests)
✓ JCAI Phase 3: PR Creation & Auto-Merge Logic (3 tests)
✓ JCAI Phase 3: Slack Notifications (4 tests)
✓ JCAI Phase 3: End-to-End Workflow (5 tests)

Test Files: 2 passed
Tests: 31 passed
```

---

## 🔧 APPROACH 1: Unit Tests

### What Gets Tested

- ✅ HMAC-SHA256 signature verification
- ✅ Error log analysis (build, test, deployment)
- ✅ Fix prompt generation
- ✅ Jules AI mock responses
- ✅ PR creation logic
- ✅ Slack notification formatting

### Run Unit Tests

```bash
npm test jcai-phase3-verification.test.ts
```

### Test Files

| File | Location | Tests |
|------|----------|-------|
| Verification Suite | `test/jcai-phase3-verification.test.ts` | 27 tests |
| E2E Test Suite | `test/jcai-e2e-test.ts` | 5 tests |

### Sample Output

```
JCAI Phase 3: GitHub Webhook Signature Verification
  ✓ should generate valid HMAC-SHA256 signature
  ✓ should fail verification with invalid signature
  ✓ should handle missing signature header

JCAI Phase 3: Error Log Analysis
  ✓ should parse build error logs correctly
  ✓ should parse test failure logs correctly
  ✓ should parse deployment error logs correctly
  ✓ should generate fix prompt with proper context
  ✓ should calculate confidence score correctly

...and more
```

---

## 🌐 APPROACH 2: Manual Webhook Tests (ngrok + PostMan)

### Setup ngrok Tunnel

```bash
# Install ngrok (if not already installed)
brew install ngrok  # macOS
# or download from https://ngrok.com/download

# Start ngrok tunnel to local server
ngrok http 3000

# Output:
# Forwarding: https://abc123def.ngrok.io -> http://localhost:3000
```

### Start Backend Server

```bash
# Terminal 1: Build and watch
npm run build:watch

# Terminal 2: Start dev server
npm run dev

# Expected output:
# ✓ Server listening on http://localhost:3000
# ✓ MCP Server ready
```

### Generate Test Payloads & Commands

```bash
# Run the test payload generator
npx ts-node test/jcai-webhook-manual-test.ts

# Output will include:
# - HMAC-SHA256 signatures for test payloads
# - curl commands for each test case
# - PostMan configuration instructions
```

### Test Case 1: Build Failure (Should Trigger Fix)

**cURL Command:**

```bash
# Generate signature first
PAYLOAD='{"action":"completed","workflow_run":...}'
SECRET="your-webhook-secret"
SIGNATURE="sha256=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | cut -d' ' -f2)"

curl -X POST http://localhost:3000/api/github/webhook \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: $SIGNATURE" \
  -H "X-GitHub-Event: workflow_run" \
  -d "$PAYLOAD"
```

**Expected Response:**

```json
{
  "status": "success",
  "message": "Webhook received and processing started",
  "workflowId": 9999888777,
  "action": "analyzing_failure"
}
```

**Server Logs:**

```
✓ [INFO] GitHub webhook received (workflow_run event)
✓ [INFO] Signature verified successfully
✓ [INFO] Analyzing workflow failure...
✓ [INFO] Error category: build (confidence: 95%)
✓ [INFO] Generating fix prompt for Jules...
✓ [INFO] Jules AI response received (1 fix)
✓ [INFO] Creating PR #451 with fixes
✓ [INFO] Slack notification sent
```

### Test Case 2: Success Workflow (Should Ignore)

```bash
curl -X POST http://localhost:3000/api/github/webhook \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: sha256=valid_signature" \
  -H "X-GitHub-Event: workflow_run" \
  -d '{"action":"completed","workflow_run":{"conclusion":"success",...}}'
```

**Expected Response:**

```json
{
  "status": "ignored",
  "message": "Success workflow - no action taken"
}
```

**Server Logs:**

```
✓ [INFO] GitHub webhook received (workflow_run event)
✓ [INFO] Signature verified successfully
✓ [DEBUG] Workflow conclusion: success - ignoring
```

### Test Case 3: Invalid Signature (Should Reject)

```bash
curl -X POST http://localhost:3000/api/github/webhook \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: sha256=invalid_signature_0000000000" \
  -H "X-GitHub-Event: workflow_run" \
  -d '{"action":"completed",...}'
```

**Expected Response (401 Unauthorized):**

```json
{
  "status": "error",
  "message": "Invalid webhook signature"
}
```

**Server Logs:**

```
✗ [ERROR] Signature verification failed
✗ [ERROR] Webhook rejected (401 Unauthorized)
```

### Using PostMan

1. **Create New Request**
   - Method: `POST`
   - URL: `http://localhost:3000/api/github/webhook`

2. **Headers Tab**
   - `Content-Type: application/json`
   - `X-Hub-Signature-256: sha256=<generated_signature>`
   - `X-GitHub-Event: workflow_run`

3. **Body Tab (raw JSON)**
   - Paste test payload from `jcai-webhook-manual-test.ts` output

4. **Send**
   - Check response status and logs in terminal

---

## 🚀 APPROACH 3: End-to-End Workflow Test

### What Gets Tested

Complete workflow simulation:

```
1. Receive GitHub webhook event (workflow fails)
2. Verify HMAC-SHA256 signature
3. Fetch workflow logs from GitHub API (mocked)
4. Analyze logs and identify error category
5. Generate fix prompt from error analysis
6. Call Jules AI for fix generation (mocked)
7. Create fix branch (fix/workflow-{runId}-{timestamp})
8. Commit fixes to branch
9. Create Pull Request with fixes
10. Request review from author
11. Send Slack notification
12. Monitor tests and auto-merge if pass
```

### Run E2E Test

```bash
npm test jcai-e2e-test.ts

# Or with verbose output
npm test jcai-e2e-test.ts -- --reporter=verbose
```

### Expected Output

```
✅ Step 1: Receive GitHub webhook event (2ms)
   → Failure event captured

✅ Step 2: Verify HMAC-SHA256 signature (1ms)
   → sha256=abc123def456...

✅ Step 3: Fetch workflow logs from GitHub API (5ms)
   → 245 bytes retrieved

✅ Step 4: Analyze error logs (3ms)
   → Category: build, Confidence: 95%

✅ Step 5: Generate fix prompt for Jules (2ms)
   → 287 characters

✅ Step 6: Call Jules AI for fix generation (mock) (1005ms)
   → 1 fixes generated

✅ Step 7: Create fix branch (1ms)
   → fix/workflow-9999888777-1708163505000

✅ Step 8: Commit fixes to branch (2ms)
   → 1 commits created

✅ Step 9: Create Pull Request (2ms)
   → PR #451

✅ Step 10: Request review from author (1ms)
   → pohi99999

✅ Step 11: Send Slack notification (1ms)
   → PR #451 link sent

✅ Step 12: Monitor tests and auto-merge if pass (1ms)
   → Auto-merge: Enabled

════════════════════════════════════════════════════
✅ E2E WORKFLOW COMPLETE
════════════════════════════════════════════════════
⏱️  Total Duration: 1028ms
📊 Steps: 12/12 passed, 0 failed
🎯 Success Rate: 100%
════════════════════════════════════════════════════
```

### Debugging E2E Tests

```bash
# Run with debug logging
DEBUG=* npm test jcai-e2e-test.ts

# Run single test
npm test jcai-e2e-test.ts -- -t "should execute complete E2E workflow"

# Run with coverage
npm test -- --coverage jcai-e2e-test.ts
```

---

## 🎯 Testing Verification Checklist

### Unit Tests ✅

- [ ] Signature verification (valid and invalid)
- [ ] Error log analysis (build, test, deployment)
- [ ] Mock webhook payload generation
- [ ] Jules AI mock responses
- [ ] PR creation logic
- [ ] Slack notification formatting
- [ ] End-to-end workflow simulation

**Command:** `npm test jcai`

### Manual Tests ✅

- [ ] Server running on port 3000
- [ ] ngrok tunnel active (if testing remotely)
- [ ] Environment variables set (GITHUB_WEBHOOK_SECRET, GITHUB_TOKEN)
- [ ] Test Case 1: Build failure triggers fix
- [ ] Test Case 2: Success is ignored
- [ ] Test Case 3: Invalid signature rejected
- [ ] Slack notifications received
- [ ] PR creation link in logs

**Commands:**
```bash
npm run dev                    # Terminal 1
npx ts-node test/jcai-webhook-manual-test.ts  # Terminal 2
# Follow curl commands from output
```

### E2E Tests ✅

- [ ] All 12 workflow steps pass
- [ ] Total duration < 2000ms
- [ ] Success rate = 100%
- [ ] Signature verification works
- [ ] Error analysis identifies category
- [ ] Jules mock generates fixes
- [ ] PR creation branch name correct
- [ ] Auto-merge logic valid

**Command:** `npm test jcai-e2e-test.ts`

---

## 📊 Test Coverage Report

```bash
npm test -- --coverage jcai-*

# Output:
# ├─ githubWebhook.ts              95% coverage
# ├─ githubAPIClient.ts            88% coverage
# ├─ deploymentAnalyzer.ts         92% coverage
# ├─ julesIntegration.ts           85% coverage
# ├─ slackNotifications.ts         90% coverage
# └─ julesMock.ts                  96% coverage
#
# Overall: 91% coverage
```

---

## 🔐 Environment Variables for Testing

```bash
# Required for webhook verification
export GITHUB_WEBHOOK_SECRET="test-secret-12345"

# Required for API calls
export GITHUB_TOKEN="ghp_xxxxxxxxxxxxxxxxxxxx"

# Optional: Slack integration
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK"

# Testing mode
export JULES_MOCK_MODE="true"        # Use mock responses
export JULES_RESPONSE_DELAY="1000"   # Simulate network latency
```

---

## 🐛 Troubleshooting

### "Signature verification failed"

```bash
# Check secret matches
echo -n '{"test":"payload"}' | openssl dgst -sha256 -hmac "your-secret"

# Verify header name: X-Hub-Signature-256 (not X-Hub-Signature)
```

### "Cannot find module @octokit/rest"

```bash
npm install @octokit/rest
npm run build
```

### "Jules mock not working"

```bash
# Verify mock mode is enabled
export JULES_MOCK_MODE="true"

# Check mock responses in src/core/julesMock.ts
npx ts-node -e "import { getAllMockResponses } from './src/core/julesMock.js'; console.log(Object.keys(getAllMockResponses()))"
```

### "Webhook not received on ngrok URL"

```bash
# Check ngrok is running and forwarding
ngrok http 3000

# Test local forwarding first
curl -X POST http://localhost:3000/api/github/webhook ...

# Then test ngrok URL
curl -X POST https://abc123def.ngrok.io/api/github/webhook ...
```

---

## 📚 Test Files Reference

| File | Purpose | Tests |
|------|---------|-------|
| `test/jcai-phase3-verification.test.ts` | Unit tests for all components | 27 |
| `test/jcai-e2e-test.ts` | End-to-end workflow simulation | 5 |
| `test/jcai-webhook-manual-test.ts` | Manual webhook test commands | Generator |
| `src/core/julesMock.ts` | Jules AI mock responses | 6 responses |

---

## 🚀 Next Steps

### After Verification

1. **Phase 3.3.2:** Implement real Jules AI API integration (replace mock)
2. **Phase 3.4:** Add auto-merge logic and production safeguards
3. **Phase 4:** Deploy to production environment

### Production Readiness

- [ ] Replace mock responses with real Jules API
- [ ] Add rate limiting for webhooks
- [ ] Implement PR approval workflow
- [ ] Add monitoring and alerts
- [ ] Document runbook for operations

---

**Happy Testing! 🎉**

For questions or issues, check logs and use debug mode:

```bash
DEBUG=* npm test jcai-e2e-test.ts
```
