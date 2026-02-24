import * as dotenv from 'dotenv';
dotenv.config();
import { vectorizeClient } from './src/utils/vectorize.js';

async function run() {
  console.log('Status:', vectorizeClient.getStatus());
  
  console.log('Upserting text...');
  const upsertOk = await vectorizeClient.upsertText('test-id-1', 'This is a test memory about Cloudflare Vectorize.', { source: 'test' });
  console.log('Upsert OK:', upsertOk);
  
  console.log('Searching text...');
  const results = await vectorizeClient.searchText('What is this memory about?', 3);
  console.log('Search results:', JSON.stringify(results, null, 2));
}

run().catch(console.error);
