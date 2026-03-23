const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:61105/devtools/page/25FC8A36C9C994880AA66F577F8DE122');

ws.on('open', () => {
  // Test REST API access
  ws.send(JSON.stringify({
    id: 1,
    method: 'Runtime.evaluate',
    params: {
      expression: "fetch('/rest/workflows', {credentials: 'include'}).then(r => r.status + ' ' + r.statusText)",
      awaitPromise: true,
      returnByValue: true
    }
  }));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data);
  if (msg.id === 1) {
    console.log('REST API STATUS:', JSON.stringify(msg.result));
    
    // Now try to get workflow data from Pinia store
    ws.send(JSON.stringify({
      id: 2,
      method: 'Runtime.evaluate',
      params: {
        expression: "fetch('/rest/workflows/LGvkbQNUm44UEoMi', {credentials: 'include'}).then(r => r.json()).then(d => JSON.stringify({name: d.name, nodeCount: d.nodes?.length, active: d.active}))",
        awaitPromise: true,
        returnByValue: true
      }
    }));
  }
  if (msg.id === 2) {
    console.log('WORKFLOW DATA:', JSON.stringify(msg.result));
    ws.close();
    process.exit(0);
  }
});

ws.on('error', (e) => console.log('ERROR:', e.message));
setTimeout(() => { console.log('TIMEOUT'); process.exit(1); }, 15000);
