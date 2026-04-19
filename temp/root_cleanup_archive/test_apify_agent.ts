import { ApifyScrapingAgent } from './src/agents/ApifyScrapingAgent.js';
import dotenv from 'dotenv';

dotenv.config();

async function testApify() {
  console.log('--- ApifyScrapingAgent Test ---');
  const agent = new ApifyScrapingAgent();
  
  try {
    const response = await agent.execute('google: KKV ügyvezető Zala megye', { limit: 5 });
    console.log('Status:', response.status);
    if (response.status === 'success') {
      console.log('Results found:', response.metadata?.count);
      console.log('Sample data:', JSON.stringify(response.data?.[0], null, 2));
    } else {
      console.error('Error:', response.error);
    }
  } catch (error) {
    console.error('Fatal error:', error);
  }
}

testApify();
