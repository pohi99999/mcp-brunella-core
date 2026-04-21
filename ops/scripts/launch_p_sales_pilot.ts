import { agentManager } from '../src/agents/AgentManager.js';
import { logInfo, logError } from '../src/utils/logger.js';
import dotenv from 'dotenv';

dotenv.config();

async function launchPilot() {
  console.log('🚀 P-Sales Pilot Kampány Indítása...');

  try {
    // 1. KKV Lead Mining
    console.log('\n--- 1. KKV Lead Gyűjtés (LinkedIn) ---');
    const kkvResult = await agentManager.execute('lead_mining', {
      task: 'linkedin: magyar kkv ügyvezető gépgyártás építőipar Zala megye 10-100 fő',
      data: { leadType: 'KKV', limit: 25 }
    });
    console.log('KKV Eredmény:', kkvResult.message);

    // 2. Brand Lead Mining
    console.log('\n--- 2. Prémium Márka Gyűjtés (Instagram/Social) ---');
    const brandResult = await agentManager.execute('lead_mining', {
      task: 'linkedin: magyar divattervező alapító prémium márka #magyardesign',
      data: { leadType: 'Brand', limit: 25 }
    });
    console.log('Brand Eredmény:', brandResult.message);

    console.log('\n✅ A leadek szinkronizálva a Google Sheets-be!');
  } catch (error) {
    console.error('Hiba a kampány indítása közben:', error);
  }
}

launchPilot();
