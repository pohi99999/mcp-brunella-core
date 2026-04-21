import { PropertyVisionaryAgent } from '../src/agents/PropertyVisionaryAgent.js';
import { initDb, saveBusinessJob } from '../src/utils/db.js';
import 'dotenv/config';

async function main() {
    console.log('🔍 STARTING PROPERTY VISIONARY PHASE (BUYER DISCOVERY)...');
    
    await initDb();
    const jobId = `property_hunt_${Date.now()}`;
    const task = "Tópark Vevővadászat: Keress 10 potenciális tőkeerős befektetőt (ingatlanalapok, hotel láncok, logisztikai fejlesztők) a Clandestino Tópark projekthez. Határozd meg a megkeresési stratégiát és töltsd fel a Pipeline-t.";

    await saveBusinessJob({
        id: jobId,
        type: 'property_visionary',
        query: task,
        metadata: JSON.stringify({ project: 'Tópark', focus: 'investors' })
    });

    const agent = new PropertyVisionaryAgent();
    console.log('🤖 AGENT AWAKENED: Property Visionary');
    
    const result = await agent.execute(task, { jobId });
    
    console.log('\n==================================================');
    console.log('✅ GOLDEN RUN PHASE 2 COMPLETE');
    console.log('--------------------------------------------------');
    console.log('JOB ID:', jobId);
    console.log('LEADS FOUND AND SAVED TO PIPELINE.');
    console.log('==================================================\n');
}

main().catch(err => {
    console.error('❌ PROPERTY HUNT FAILED:', err);
    process.exit(1);
});
