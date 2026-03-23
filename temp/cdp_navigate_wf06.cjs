const WebSocket = require('ws');
const http = require('http');

http.get('http://localhost:61105/json', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const pages = JSON.parse(data);
    const n8nPage = pages.find(p => p.type === 'page' && p.url.includes('iszapfalo'));
    if (!n8nPage) { console.log('NO N8N PAGE FOUND'); process.exit(1); }
    run(n8nPage.webSocketDebuggerUrl);
  });
});

function run(wsUrl) {
  const ws = new WebSocket(wsUrl);

  ws.on('open', () => {
    // Navigate to workflow 06 first
    ws.send(JSON.stringify({
      id: 1,
      method: 'Runtime.evaluate',
      params: {
        expression: "window.location.href = 'https://iszapfalo.app.n8n.cloud/workflow/LGvkbQNUm44UEoMi';",
        returnByValue: true
      }
    }));

    // Wait for navigation and then extract data
    setTimeout(() => {
      ws.send(JSON.stringify({
        id: 2,
        method: 'Runtime.evaluate',
        params: {
          expression: [
            "(function() {",
            "  var vueApp = document.querySelector('#app') && document.querySelector('#app').__vue_app__;",
            "  var pinia = vueApp && vueApp.config && vueApp.config.globalProperties && vueApp.config.globalProperties.$pinia;",
            "  var wfStore = pinia && pinia._s && pinia._s.get('workflows');",
            "  var ndvStore = pinia && pinia._s && pinia._s.get('ndv');",
            "  var canvasStore = pinia && pinia._s && pinia._s.get('canvas');",
            "  ",
            "  // Get workflow from the store",
            "  var wf = wfStore && wfStore.workflow;",
            "  if (!wf) return JSON.stringify({error: 'no workflow in store', url: window.location.href});",
            "  ",
            "  var nodes = wf.nodes || [];",
            "  var allNodes = nodes.map(function(n) {",
            "    return {",
            "      name: n.name,",
            "      type: n.type,",
            "      id: n.id,",
            "      credentials: n.credentials || null,",
            "      parameters: n.type && n.type.includes('anthropic') ? n.parameters : undefined",
            "    };",
            "  });",
            "  ",
            "  // Filter nodes that need credentials (Gmail or Anthropic)",
            "  var needFix = allNodes.filter(function(n) {",
            "    var isGmail = n.type && n.type.toLowerCase().includes('gmail');",
            "    var isAnthropic = n.type && n.type.toLowerCase().includes('anthropic');",
            "    var missingCred = !n.credentials || Object.keys(n.credentials).length === 0;",
            "    return (isGmail && missingCred) || isAnthropic;",
            "  });",
            "  ",
            "  return JSON.stringify({",
            "    url: window.location.href,",
            "    workflowName: wf.name,",
            "    totalNodes: nodes.length,",
            "    needFix: needFix,",
            "    gmailNodes: allNodes.filter(function(n) { return n.type && n.type.toLowerCase().includes('gmail'); }),",
            "    anthropicNodes: allNodes.filter(function(n) { return n.type && n.type.toLowerCase().includes('anthropic'); })",
            "  });",
            "})()"
          ].join('\n'),
          returnByValue: true
        }
      }));
    }, 5000);
  });

  ws.on('message', (raw) => {
    const msg = JSON.parse(raw);
    if (msg.id === 2) {
      console.log('RESULT:', msg.result?.result?.value);
      ws.close();
      process.exit(0);
    }
  });

  ws.on('error', (e) => { console.log('ERROR:', e.message); process.exit(1); });
  setTimeout(() => { console.log('TIMEOUT'); process.exit(1); }, 20000);
}
