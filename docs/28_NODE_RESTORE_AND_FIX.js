const fs = require('fs');
const https = require('https');

const envFile = fs.readFileSync('F:/mcp-brunella-core/.env', 'utf8');
const n8nKeyMatch = envFile.match(/N8N_API_KEY=(.+)/);
const n8nKey = n8nKeyMatch ? n8nKeyMatch[1].trim() : '';

const baseUrl = 'https://iszapfalo.app.n8n.cloud';
const wfId = 'CAEaN0ryx5POpVSv';

// 1. Olvassuk be a BIZTONSÁGI MENTÉST (1784-es futás elõtti állapot)
const backupRaw = fs.readFileSync('F:/mcp-brunella-core/.worktrees/004_Iszapfaló_n8n/N8N_PRO/api_live_audit/02_CAEaN0ryx5POpVSv_pre_columns_prompt_fix_20260326.json', 'utf8');
const wf = JSON.parse(backupRaw);

// 2. Óvatos módosítások - CSISZOLT MEZÕK ÉS KÓDOLÁS TARTÁSA!
wf.nodes.forEach(node => {
    if (node.name === 'Munkaido_Rogzites') {
        // FONTOS: A tábla neve az Airtable-ben: "Munkaidõ Nyilvántartás"
        node.parameters.table.value = 'Munkaidõ Nyilvántartás';
        
        node.parameters.columns.value = {
            'Dátum': '={{ ("Date") || .toISO().split("T")[0] }}',
            'Ledolgozott Órák': '={{ ("Hours_Worked") }}',
            'Projekt': '={{ ("Project") || "Ismeretlen projekt" }}',
            'Munkaidõ Kezdete': '={{ ("StartTime") || "" }}',
            'Munkaidõ Vége': '={{ ("EndTime") || "" }}',
            'Nap Típusa': 'Munkanap'
        };
        
        node.parameters.columns.schema = [
            { id: 'Dátum', displayName: 'Dátum', type: 'string' },
            { id: 'Ledolgozott Órák', displayName: 'Ledolgozott Órák', type: 'string' },
            { id: 'Projekt', displayName: 'Projekt', type: 'string' },
            { id: 'Munkaidõ Kezdete', displayName: 'Munkaidõ Kezdete', type: 'string' },
            { id: 'Munkaidõ Vége', displayName: 'Munkaidõ Vége', type: 'string' },
            { id: 'Nap Típusa', displayName: 'Nap Típusa', type: 'string' }
        ];
    }
    
    if (node.name === 'Iszapfal_AI_Agent') {
        node.parameters.options.systemMessage = 
\Te vagy az Iszapfaló Kft. intelligens belsõ asszisztense. Feladatod a Telegram üzenetekbõl az adatok kinyerése és az Airtable toolok hívása.

1. MUNKAIDÕ RÖGZÍTÉS (Munkaido_Rogzites)
- Date: A nap dátuma YYYY-MM-DD. Ha "ma", akkor: {{ \.toISO().split('T')[0] }}
- Hours_Worked: A ledolgozott órák száma. Ha 8-tól 16-ig volt, az 8 óra. Csak számot adj!
- Project: A projekt vagy tó neve (pl. Gödöllõ, Balaton).
- StartTime: HH:mm formátum, ha van (pl. 08:00).
- EndTime: HH:mm formátum, ha van (pl. 16:00).

Minden sikeres tool hívás után röviden és barátságosan igazolj vissza magyarul, pl.: "Rendben, beírtam a 8 órát a Gödöllõ projekthez!"\;
    }
});

const payload = JSON.stringify({
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: wf.settings
});

// 3. Küldjük vissza n8n-nek
const options = {
    hostname: 'iszapfalo.app.n8n.cloud',
    path: '/api/v1/workflows/' + wfId,
    method: 'PUT',
    headers: {
        'X-N8N-API-KEY': n8nKey,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
    }
};

const req = https.request(options, (res) => {
    console.log('HTTP Státusz:', res.statusCode);
    res.on('data', (d) => process.stdout.write('JAVÍTVA NODEJS SEGÍTSÉGÉVEL!'));
});

req.on('error', (e) => console.error(e));
req.write(payload);
req.end();
