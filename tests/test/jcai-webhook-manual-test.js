#!/usr/bin/env node
/**
 * JCAI Phase 3 - Manual Webhook Test Tool
 *
 * Usage:
 *   npx ts-node test/jcai-webhook-manual-test.ts
 *
 * Or with npm:
 *   npm run test:jcai-webhook
 *
 * This generates test payloads and signatures that can be sent to:
 * - Local development server (port 3000)
 * - ngrok tunnel
 * - PostMan
 */
import crypto from 'crypto';
const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || 'test-webhook-secret-12345';
function generateSignature(payload) {
    const bodyString = JSON.stringify(payload);
    const hash = crypto.createHmac('sha256', WEBHOOK_SECRET).update(bodyString).digest('hex');
    return `sha256=${hash}`;
}
const testCases = [
    {
        name: 'Workflow Failure - Build Error',
        scenario: 'CI/CD pipeline fails during build phase',
        payload: {
            action: 'completed',
            workflow_run: {
                id: 9999888777,
                name: 'CI/CD Pipeline',
                head_branch: 'feature/new-agent',
                head_commit: {
                    id: 'abc123def456789',
                    message: 'Add new AI agent feature'
                },
                conclusion: 'failure',
                status: 'completed',
                run_number: 42,
                workflow_id: 12345,
                created_at: '2026-02-17T10:00:00Z',
                updated_at: '2026-02-17T10:15:00Z'
            },
            repository: {
                id: 555666777,
                name: 'mcp-brunella-core',
                full_name: 'pohi99999/mcp-brunella-core',
                owner: {
                    login: 'pohi99999',
                    id: 12345,
                    type: 'User'
                },
                private: false,
                html_url: 'https://github.com/pohi99999/mcp-brunella-core',
                description: 'AI multi-agent system',
                url: 'https://api.github.com/repos/pohi99999/mcp-brunella-core',
                default_branch: 'main'
            },
            sender: {
                login: 'github-actions[bot]',
                id: 41898726,
                type: 'Bot'
            }
        },
        expectedResponse: 'Webhook received and processing started'
    },
    {
        name: 'Workflow Success - Should Ignore',
        scenario: 'CI/CD pipeline passes (should NOT trigger fix)',
        payload: {
            action: 'completed',
            workflow_run: {
                id: 9999888778,
                name: 'CI/CD Pipeline',
                head_branch: 'main',
                head_commit: {
                    id: 'def456abc789012',
                    message: 'Hotfix patch'
                },
                conclusion: 'success',
                status: 'completed',
                run_number: 43,
                workflow_id: 12345,
                created_at: '2026-02-17T11:00:00Z',
                updated_at: '2026-02-17T11:05:00Z'
            },
            repository: {
                id: 555666777,
                name: 'mcp-brunella-core',
                full_name: 'pohi99999/mcp-brunella-core',
                owner: { login: 'pohi99999', id: 12345, type: 'User' },
                private: false,
                html_url: 'https://github.com/pohi99999/mcp-brunella-core',
                description: 'AI multi-agent system',
                url: 'https://api.github.com/repos/pohi99999/mcp-brunella-core',
                default_branch: 'main'
            },
            sender: { login: 'github-actions[bot]', id: 41898726, type: 'Bot' }
        },
        expectedResponse: 'Success workflow - no action taken'
    },
    {
        name: 'Workflow Cancelled - Should Ignore',
        scenario: 'User cancelled the workflow (should NOT trigger fix)',
        payload: {
            action: 'completed',
            workflow_run: {
                id: 9999888779,
                name: 'CI/CD Pipeline',
                head_branch: 'draft/experiment',
                head_commit: {
                    id: 'xyz789abc123def',
                    message: 'WIP experiment'
                },
                conclusion: 'cancelled',
                status: 'completed',
                run_number: 44,
                workflow_id: 12345,
                created_at: '2026-02-17T12:00:00Z',
                updated_at: '2026-02-17T12:02:00Z'
            },
            repository: {
                id: 555666777,
                name: 'mcp-brunella-core',
                full_name: 'pohi99999/mcp-brunella-core',
                owner: { login: 'pohi99999', id: 12345, type: 'User' },
                private: false,
                html_url: 'https://github.com/pohi99999/mcp-brunella-core',
                description: 'AI multi-agent system',
                url: 'https://api.github.com/repos/pohi99999/mcp-brunella-core',
                default_branch: 'main'
            },
            sender: { login: 'github-actions[bot]', id: 41898726, type: 'Bot' }
        },
        expectedResponse: 'Cancelled workflow - no action taken'
    },
    {
        name: 'Workflow Failure - Test Error',
        scenario: 'Tests fail (high priority for quick fix)',
        payload: {
            action: 'completed',
            workflow_run: {
                id: 9999888780,
                name: 'CI/CD Pipeline',
                head_branch: 'feature/test-fixes',
                head_commit: {
                    id: 'test001test002test003',
                    message: 'Fix critical test failures'
                },
                conclusion: 'failure',
                status: 'completed',
                run_number: 45,
                workflow_id: 12345,
                created_at: '2026-02-17T13:00:00Z',
                updated_at: '2026-02-17T13:10:00Z'
            },
            repository: {
                id: 555666777,
                name: 'mcp-brunella-core',
                full_name: 'pohi99999/mcp-brunella-core',
                owner: { login: 'pohi99999', id: 12345, type: 'User' },
                private: false,
                html_url: 'https://github.com/pohi99999/mcp-brunella-core',
                description: 'AI multi-agent system',
                url: 'https://api.github.com/repos/pohi99999/mcp-brunella-core',
                default_branch: 'main'
            },
            sender: { login: 'github-actions[bot]', id: 41898726, type: 'Bot' }
        },
        expectedResponse: 'Test failure detected - analyzing and generating fix'
    }
];
/**
 * PART 2: Print curl commands for manual testing
 */
function printWebhookTestCommands() {
    console.log('\n' + '='.repeat(80));
    console.log('🔧 JCAI PHASE 3 - MANUAL WEBHOOK TEST COMMANDS');
    console.log('='.repeat(80));
    console.log('\n📋 Prerequisites:');
    console.log('  1. Start backend server:       npm run dev');
    console.log('  2. Setup ngrok tunnel:         ngrok http 3000');
    console.log('  3. Configure GitHub webhook:   https://github.com/REPO/settings/hooks');
    console.log('  4. Set GITHUB_WEBHOOK_SECRET:  export GITHUB_WEBHOOK_SECRET="your-secret"');
    console.log('  5. Verify webhook endpoint:    /api/github/webhook');
    console.log('\n📌 Webhook Configuration in GitHub:');
    console.log('  Payload URL: https://your-ngrok-url.ngrok.io/api/github/webhook');
    console.log('  Content type: application/json');
    console.log('  Events: Workflow runs');
    console.log('  Active: ✅');
    testCases.forEach((testCase, index) => {
        const signature = generateSignature(testCase.payload);
        const payload = JSON.stringify(testCase.payload);
        console.log(`\n${'─'.repeat(80)}`);
        console.log(`\n📝 TEST CASE ${index + 1}: ${testCase.name}`);
        console.log(`   Scenario: ${testCase.scenario}`);
        console.log(`   Expected: ${testCase.expectedResponse}`);
        console.log(`\n💻 cURL Command:`);
        console.log(`\`\`\`bash`);
        console.log(`curl -X POST http://localhost:3000/api/github/webhook \\`);
        console.log(`  -H "Content-Type: application/json" \\`);
        console.log(`  -H "X-Hub-Signature-256: ${signature}" \\`);
        console.log(`  -H "X-GitHub-Event: workflow_run" \\`);
        console.log(`  -d '${payload}'`);
        console.log(`\`\`\``);
        console.log(`\n🌐 PostMan Settings:`);
        console.log(`  Method: POST`);
        console.log(`  URL: http://localhost:3000/api/github/webhook`);
        console.log(`  Headers:`);
        console.log(`    Content-Type: application/json`);
        console.log(`    X-Hub-Signature-256: ${signature}`);
        console.log(`    X-GitHub-Event: workflow_run`);
        console.log(`  Body (raw JSON):`);
        console.log(`  ${JSON.stringify(testCase.payload, null, 2)}`);
    });
    console.log(`\n${'─'.repeat(80)}`);
    console.log('\n🎯 Testing Strategy:\n');
    console.log('  1. Test Case 1 (Build Failure)    → Should trigger Jules AI fix');
    console.log('  2. Test Case 2 (Success)         → Should be ignored silently');
    console.log('  3. Test Case 3 (Cancelled)       → Should be ignored silently');
    console.log('  4. Test Case 4 (Test Failure)    → Should trigger Jules AI fix');
    console.log('\n✅ Expected Logs (in npm run dev terminal):\n');
    console.log('  ✓ [INFO] GitHub webhook received');
    console.log('  ✓ [INFO] Signature verified successfully');
    console.log('  ✓ [INFO] Analyzing workflow failure...');
    console.log('  ✓ [INFO] Generating fix prompt for Jules...');
    console.log('  ✓ [INFO] Slack notification sent');
    console.log('\n❌ If signature fails:\n');
    console.log('  ✗ [ERROR] Signature verification failed');
    console.log('  ✗ [ERROR] Missing X-Hub-Signature-256 header');
    console.log('  → Check GITHUB_WEBHOOK_SECRET environment variable');
    console.log(`\n${'='.repeat(80)}\n`);
}
/**
 * PART 3: Export for programmatic use (in other tests)
 */
export function getWebhookTestPayload(testCaseName) {
    const testCase = testCases.find((tc) => tc.name === testCaseName);
    if (!testCase) {
        throw new Error(`Test case not found: ${testCaseName}`);
    }
    return {
        payload: testCase.payload,
        signature: generateSignature(testCase.payload),
        headers: {
            'Content-Type': 'application/json',
            'X-Hub-Signature-256': generateSignature(testCase.payload),
            'X-GitHub-Event': 'workflow_run'
        }
    };
}
/**
 * PART 4: Environment validation
 */
function validateEnvironment() {
    console.log('\n🔐 Environment Validation:\n');
    const checks = [
        {
            name: 'GITHUB_WEBHOOK_SECRET',
            value: process.env.GITHUB_WEBHOOK_SECRET,
            required: true
        },
        {
            name: 'GITHUB_TOKEN',
            value: process.env.GITHUB_TOKEN,
            required: true
        },
        {
            name: 'SLACK_WEBHOOK_URL',
            value: process.env.SLACK_WEBHOOK_URL,
            required: false
        },
        {
            name: 'JULES_API_URL',
            value: process.env.JULES_API_URL,
            required: false
        }
    ];
    checks.forEach((check) => {
        const status = check.value ? '✅' : '⚠️';
        const required = check.required ? '[REQUIRED]' : '[OPTIONAL]';
        const value = check.value && !check.value.startsWith('http')
            ? '***[REDACTED]***'
            : check.value || '[NOT SET]';
        console.log(`  ${status} ${check.name}: ${value} ${required}`);
    });
    console.log();
}
/**
 * Main Entry Point
 */
if (import.meta.url === `file://${process.argv[1]}`) {
    validateEnvironment();
    printWebhookTestCommands();
}
