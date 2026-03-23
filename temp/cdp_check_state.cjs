const WebSocket = require('ws');
const http = require('http');

http.get('http://localhost:61105/json', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const pages = JSON.parse(data);
    const n8nPage = pages.find(p => p.type === 'page' && p.url.includes('iszapfalo'));
    if (!n8nPage) { console.log('NO N8N PAGE FOUND'); process.exit(1); }
    console.log('Found:', n8nPage.url, '|', n8nPage.title);
    run(n8nPage.webSocketDebuggerUrl);
  });
});

function run(wsUrl) {
  const ws = new WebSocket(wsUrl);

  ws.on('open', () => {
    // Check Pinia store and cookies
    ws.send(JSON.stringify({
      id: 1,
      method: 'Runtime.evaluate',
      params: {
        expression: [
          "(function() {",
          "  var cookies = document.cookie;",
          "  var vueApp = document.querySelector('#app') && document.querySelector('#app').__vue_app__;",
          "  var pinia = vueApp && vueApp.config && vueApp.config.globalProperties && vueApp.config.globalProperties.$pinia;",
          "  var usersStore = pinia && pinia._s && pinia._s.get('users');",
          "  var user = usersStore && usersStore.currentUser;",
          "  var workflowStore = pinia && pinia._s && pinia._s.get('workflows');", 
          "  var wfCount = workflowStore && workflowStore.allWorkflows ? workflowStore.allWorkflows.length : -1;",
          "  return JSON.stringify({",
          "    url: window.location.href,",
          "    cookies: cookies ? cookies.substring(0, 200) : 'none',",
          "    hasPinia: !!pinia,",
          "    user: user ? {id: user.id, email: user.email, firstName: user.firstName} : null,",
          "    workflowCount: wfCount",
          "  });",
          "})()"
        ].join('\n'),
        returnByValue: true
      }
    }));
  });

  ws.on('message', (raw) => {
    const msg = JSON.parse(raw);
    if (msg.id === 1) {
      console.log('PAGE STATE:', msg.result?.result?.value);
      ws.close();
      process.exit(0);
    }
  });

  ws.on('error', (e) => { console.log('ERROR:', e.message); process.exit(1); });
  setTimeout(() => { console.log('TIMEOUT'); process.exit(1); }, 15000);
}
