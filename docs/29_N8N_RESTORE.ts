import * as fs from 'fs';

async function restore() {
  try {
    const env = fs.readFileSync('.env', 'utf-8');
    const token = env.match(/N8N_API_KEY=(.+)/)?.[1].trim();
    if (!token) throw new Error('No n8n token');

    const backup = JSON.parse(fs.readFileSync('.worktrees/004_Iszapfaló_n8n/N8N_PRO/api_live_audit/02_CAEaN0ryx5POpVSv_pre_columns_prompt_fix_20260326.json', 'utf-8'));
    
    // VISSZAÁLLÍTÁS A STABIL ÁLLAPOTBA!
    const response = await fetch('https://iszapfalo.app.n8n.cloud/api/v1/workflows/CAEaN0ryx5POpVSv', {
      method: 'PUT',
      headers: {
        'X-N8N-API-KEY': token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: backup.name,
        nodes: backup.nodes,
        connections: backup.connections,
        settings: backup.settings
      })
    });
    
    if (response.ok) {
        console.log('? A 02-ES N8N WORKFLOW SIKERESEN VISSZAÁLLÍTVA A MÛKÖDÕ ÁLLAPOTBA!');
    } else {
        const err = await response.text();
        console.error('? Hiba a visszaállítás során:', err);
    }
  } catch (e) {
    console.error(e);
  }
}
restore();
