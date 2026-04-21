import { MarketingDirectorAgent } from '../src/agents/MarketingDirectorAgent.js';
import { initDb, saveBusinessJob } from '../src/utils/db.js';
import { v4 as uuidv4 } from 'uuid';
import 'dotenv/config';

async function main() {
    console.log('🚀 INITIALIZING TÓPARK GOLDEN RUN...');
    
    await initDb();
    const jobId = `gold_run_${Date.now()}`;
    const task = "Tópark Golden Run: Generálj teljes kampányt a Clandestino Tópark projekthez. Üdülőpark fejlesztés, tavi panoráma, befektetési lehetőség. Indíts el egy Studio projektet egy profi landing page-hez.";

    await saveBusinessJob({
        id: jobId,
        type: 'marketing_director',
        query: task,
        metadata: JSON.stringify({ source: 'manual_trigger', project: 'Tópark' })
    });

    const agent = new MarketingDirectorAgent();
    console.log('🤖 AGENT AWAKENED: Marketing Director');
    
    const result = await agent.execute(task, { jobId });
    
    console.log('\n==================================================');
    console.log('✅ GOLDEN RUN PHASE 1 COMPLETE');
    console.log('--------------------------------------------------');
    console.log('JOB ID:', jobId);
    console.log('RESULT:', JSON.stringify(result, null, 2));
    console.log('==================================================\n');
}

main().catch(err => {
    console.error('❌ GOLDEN RUN FAILED:', err);
    process.exit(1);
});
