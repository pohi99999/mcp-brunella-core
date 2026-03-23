const WebSocket = require('ws');
const http = require('http');

http.get('http://localhost:61105/json', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const pages = JSON.parse(data);
    const n8nPage = pages.find(p => p.type === 'page' && p.url.includes('iszapfalo'));
    if (!n8nPage) { console.log('NO N8N PAGE FOUND'); process.exit(1); }
    console.log('Found:', n8nPage.url);
    run(n8nPage.webSocketDebuggerUrl);
  });
});

function run(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let step = 1;

  ws.on('open', () => {
    // Step 1: Get workflow 06 data
    ws.send(JSON.stringify({
      id: step,
      method: 'Runtime.evaluate',
      params: {
        expression: "fetch('/rest/workflows/LGvkbQNUm44UEoMi', {credentials: 'include'}).then(r => r.json()).then(d => { if (d.data) { const nodes = d.data.nodes || []; return JSON.stringify({ name: d.data.name, active: d.data.active, nodeCount: nodes.length, nodes: nodes.map(n => ({name: n.name, type: n.type, creds: n.credentials || null})) }); } else { return JSON.stringify({error: 'no data', raw: JSON.stringify(d).substring(0, 500)}); } })",
        awaitPromise: true,
        returnByValue: true
      }
    }));
  });

  ws.on('message', (raw) => {
    const msg = JSON.parse(raw);
    if (msg.id === 1) {
      const val = msg.result?.result?.value;
      console.log('WORKFLOW 06:', val);
      
      // Step 2: List all workflows 
      ws.send(JSON.stringify({
        id: 2,
        method: 'Runtime.evaluate',
        params: {
          expression: "fetch('/rest/workflows?limit=50', {credentials: 'include'}).then(r => r.json()).then(d => JSON.stringify({count: d.count || d.data?.length || 0, workflows: (d.data || []).map(w => ({id: w.id, name: w.name, active: w.active}))}))",
          awaitPromise: true,
          returnByValue: true
        }
      }));
    }
    if (msg.id === 2) {
      console.log('ALL WORKFLOWS:', msg.result?.result?.value);
      ws.close();
      process.exit(0);
    }
  });

  ws.on('error', (e) => { console.log('ERROR:', e.message); process.exit(1); });
  setTimeout(() => { console.log('TIMEOUT'); process.exit(1); }, 20000);
}
