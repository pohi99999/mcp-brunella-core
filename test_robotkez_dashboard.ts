/**
 * RobotkezV2 Dashboard Test Script
 * 
 * Teszteli a RobotkezV2 agent működését a dashboardon keresztül
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:3000';
const API_URL = `${BASE_URL}/api/v1/robotkez`;

interface TestResult {
    test: string;
    success: boolean;
    duration: number;
    error?: string;
    data?: any;
}

const results: TestResult[] = [];

function log(message: string, data?: any) {
    console.log(`[${new Date().toLocaleTimeString('hu-HU')}] ${message}`);
    if (data) {
        console.log(JSON.stringify(data, null, 2));
    }
}

async function runTest(name: string, fn: () => Promise<any>): Promise<void> {
    const start = Date.now();
    log(`🧪 Test: ${name}`);
    
    try {
        const data = await fn();
        const duration = Date.now() - start;
        log(`✅ PASS (${duration}ms)`);
        results.push({ test: name, success: true, duration, data });
    } catch (error: any) {
        const duration = Date.now() - start;
        log(`❌ FAIL (${duration}ms)`);
        log(`Error: ${error.message}`);
        results.push({ 
            test: name, 
            success: false, 
            duration, 
            error: error.message 
        });
    }
}

// Test 1: Status endpoint
async function testStatus() {
    const response = await axios.get(`${API_URL}/status`);
    
    if (!response.data.agent) {
        throw new Error('Missing agent data in status response');
    }
    
    log(`Agent status: ${response.data.agent.status}`);
    log(`Browser active: ${response.data.browser.active}`);
    
    return response.data;
}

// Test 2: Plan generation (no execution)
async function testPlanGeneration() {
    const response = await axios.post(`${API_URL}/plan`, {
        instruction: 'Nyisd meg a google.com-ot'
    });
    
    if (!response.data.plan || !Array.isArray(response.data.plan.plan)) {
        throw new Error('Invalid plan structure');
    }
    
    log(`Plan generated: ${response.data.plan.plan.length} steps`);
    log('Steps:', response.data.plan.plan.map((s: any, i: number) => 
        `  ${i + 1}. ${s.description} (${s.action})`
    ).join('\n'));
    
    return response.data;
}

// Test 3: Simple execution (foreground)
async function testSimpleExecution() {
    const response = await axios.post(`${API_URL}/chat`, {
        instruction: 'Keress rá a TypeScript tutoriálokra'
    }, {
        timeout: 30000 // 30s timeout
    });
    
    if (!response.data.success) {
        throw new Error(`Execution failed: ${response.data.message || response.data.error}`);
    }
    
    log(`Execution result: ${response.data.message}`);
    if (response.data.data?.completedSteps) {
        log(`Completed steps: ${response.data.data.completedSteps.length}`);
    }
    
    return response.data;
}

// Test 4: Screenshot retrieval
async function testScreenshot() {
    // First, take a screenshot
    await axios.post(`${API_URL}/exec`, {
        action: 'screenshot'
    });
    
    // Wait a bit for it to be captured
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const response = await axios.get(`${API_URL}/screenshot`, {
        responseType: 'arraybuffer'
    });
    
    if (!response.data || response.data.byteLength === 0) {
        throw new Error('No screenshot data received');
    }
    
    log(`Screenshot size: ${(response.data.byteLength / 1024).toFixed(2)} KB`);
    
    return { size: response.data.byteLength };
}

// Test 5: Background task submission
async function testBackgroundTask() {
    const response = await axios.post(`${API_URL}/chat`, {
        message: 'Keresd meg az AI híreket és készíts összefoglalót',
        background: true
    }, {
        timeout: 5000 // Should return quickly with task ID
    });
    
    if (!response.data.taskId) {
        throw new Error('No task ID returned for background task');
    }
    
    log(`Background task created: ${response.data.taskId}`);
    
    // Wait a bit and check task status
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const statusResponse = await axios.get(`${API_URL}/tasks/${response.data.taskId}`);
    log(`Task status: ${statusResponse.data.task.status}`);
    
    return statusResponse.data;
}

// Test 6: List background tasks
async function testListTasks() {
    const response = await axios.get(`${API_URL}/tasks`);
    
    if (!Array.isArray(response.data.tasks)) {
        throw new Error('Tasks response is not an array');
    }
    
    log(`Total tasks: ${response.data.tasks.length}`);
    log(`Active tasks: ${response.data.tasks.filter((t: any) => t.status === 'running').length}`);
    
    return response.data;
}

// Main test runner
async function main() {
    console.log('\n='.repeat(60));
    console.log('🤖 RobotkezV2 Dashboard Test Suite');
    console.log('='.repeat(60));
    console.log();
    
    await runTest('1. Status Endpoint', testStatus);
    await runTest('2. Plan Generation', testPlanGeneration);
    await runTest('3. Simple Execution (Google Open)', testSimpleExecution);
    await runTest('4. Screenshot Retrieval', testScreenshot);
    // await runTest('5. Background Task', testBackgroundTask); // Skip for now (long running)
    await runTest('6. List Tasks', testListTasks);
    
    console.log();
    console.log('='.repeat(60));
    console.log('📊 Test Results Summary');
    console.log('='.repeat(60));
    
    const passed = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
    
    console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
    console.log(`Total duration: ${(totalDuration / 1000).toFixed(2)}s`);
    console.log();
    
    results.forEach(r => {
        const icon = r.success ? '✅' : '❌';
        console.log(`${icon} ${r.test} (${r.duration}ms)`);
        if (!r.success && r.error) {
            console.log(`   Error: ${r.error}`);
        }
    });
    
    console.log();
    process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
    console.error('Fatal error:', err.message);
    process.exit(1);
});
