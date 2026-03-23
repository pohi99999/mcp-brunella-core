const WebSocket = require('ws');

// First get current page list to find the right tab
const http = require('http');

http.get('http://localhost:61105/json', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const pages = JSON.parse(data);
    const n8nPage = pages.find(p => p.type === 'page' && p.url.includes('iszapfalo'));
    if (!n8nPage) {
      console.log('NO N8N PAGE FOUND');
      console.log('Pages:', pages.map(p => p.url));
      process.exit(1);
    }
    console.log('Found n8n page:', n8nPage.url, n8nPage.title);
    connectAndTest(n8nPage.webSocketDebuggerUrl);
  });
});

function connectAndTest(wsUrl) {
  const ws = new WebSocket(wsUrl);
  
  ws.on('open', () => {
    // Test if session is authenticated
    ws.send(JSON.stringify({
      id: 1,
      method: 'Runtime.evaluate',
      params: {
        expression: "fetch('/rest/workflows', {credentials: 'include'}).then(r => r.json()).then(d => JSON.stringify({status: 'ok', count: d.data?.length || 0, names: (d.data || []).slice(0, 10).map(w => w.name)}))",
        awaitPromise: true,
        returnByValue: true
      }
    }));
  });

  ws.on('message', (raw) => {
    const msg = JSON.parse(raw);
    if (msg.id === 1) {
      console.log('API RESULT:', JSON.stringify(msg.result, null, 2));
      ws.close();
      process.exit(0);
    }
  });

  ws.on('error', (e) => { console.log('WS ERROR:', e.message); process.exit(1); });
  setTimeout(() => { console.log('TIMEOUT'); process.exit(1); }, 15000);
}
