/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const API_BASE = process.env.BAS_API_URL || 'http://localhost:3000/api/v1';

async function testCloudflareHistory() {
  console.log('🚀 Checking Cloudflare Integration...');
  
  try {
    // 1. Submit a Test Task
    console.log('\n📝 1. Submitting Test Task...');
    const taskPayload = {
      instruction: 'This is a test task for history verification via CLI script.',
      context: { source: 'cli_test' }
    };
    
    const taskResponse = await axios.post(`${API_BASE}/cloudflare/task`, taskPayload);
    const taskId = taskResponse.data.id || taskResponse.data.taskId;
    
    if (!taskId) {
      console.error('❌ Failed to get Task ID from response:', taskResponse.data);
      return;
    }
    
    console.log(`✅ Task Submitted! ID: ${taskId}`);
    console.log(`Response:`, taskResponse.data);

    // 2. Check Status immediately
    console.log('\n🔍 2. Checking Status...');
    const statusResponse = await axios.get(`${API_BASE}/cloudflare/status/${taskId}`);
    console.log(`✅ Status: ${statusResponse.data.status}`);
    
    // 3. Check History
    console.log('\n📚 3. Fetching History...');
    // Give time for D1 write/propagation if needed (though usually instant for single write)
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const historyResponse = await axios.get(`${API_BASE}/cloudflare/history?limit=5`);
    const history = historyResponse.data.tasks || historyResponse.data;
    
    console.log(`✅ History fetched! Found ${Array.isArray(history) ? history.length : 0} items.`);
    
    if (Array.isArray(history)) {
        const found = history.find((t: any) => t.id === taskId);
        if (found) {
            console.log(`🎉 SUCCESS: Created task ${taskId} found in history!`);
            console.table([found]);
        } else {
            console.warn(`⚠️ Created task ${taskId} NOT found in recent history.`);
            console.log('Recent items:', history.slice(0, 3));
        }
    } else {
        console.error('❌ History format unexpected:', history);
    }

  } catch (error: any) {
    console.error('\n❌ Error during test:');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error('Data:', error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

testCloudflareHistory();