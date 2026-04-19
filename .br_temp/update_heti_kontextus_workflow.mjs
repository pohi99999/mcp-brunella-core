import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const token = env.match(/^N8N_API_KEY=(.+)$/m)?.[1]?.trim();
if (!token) throw new Error('N8N_API_KEY not found');

const workflowId = 'SxWeeyrNe6TQ71zf';
const baseUrl = 'https://iszapfalo.app.n8n.cloud';

const TELEGRAM_ADMIN_CHAT_ID = '7544590867';
const telegramCred = {
  telegramApi: {
    id: 'lEp8aDHGJcOoUhAT',
    name: 'Telegram account 4',
  },
};

const jsCode = fs.readFileSync('docs/snippets/n8n/iszapfalo_heti_kontextus_code_node.js', 'utf8');

function upsertNode(nodes, node) {
  const index = nodes.findIndex((candidate) => candidate.name === node.name);
  if (index >= 0) {
    nodes[index] = {
      ...nodes[index],
      ...node,
    };
  } else {
    nodes.push(node);
  }
}

const liveRes = await fetch(`${baseUrl}/api/v1/workflows/${workflowId}`, {
  method: 'GET',
  headers: {
    'X-N8N-API-KEY': token,
    'Content-Type': 'application/json',
  },
});

if (!liveRes.ok) {
  throw new Error(`Failed to fetch live workflow: ${liveRes.status} ${await liveRes.text()}`);
}

const liveWorkflow = await liveRes.json();

const nodes = Array.isArray(liveWorkflow.nodes) ? [...liveWorkflow.nodes] : [];
const connections = liveWorkflow.connections && typeof liveWorkflow.connections === 'object'
  ? { ...liveWorkflow.connections }
  : {};

upsertNode(nodes, {
  parameters: {
    jsCode,
  },
  name: 'Code - Heti Kontextus Generátor',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
});

upsertNode(nodes, {
  parameters: {
    resource: 'message',
    operation: 'sendDocument',
    chatId: TELEGRAM_ADMIN_CHAT_ID,
    binaryData: true,
    binaryPropertyName: 'report',
    replyMarkup: 'none',
    additionalFields: {
      caption: '=📦 Heti Kontextus riport elkészült: {{$json.fileName}}',
      fileName: '={{$json.fileName}}',
    },
  },
  name: 'Telegram - Heti Kontextus Riport',
  type: 'n8n-nodes-base.telegram',
  typeVersion: 1.2,
  position: [1900, 220],
  id: 'a4b6e2c1-4207-4ec6-9363-000000000009',
  credentials: telegramCred,
});

upsertNode(nodes, {
  parameters: {
    content: 'A heti markdown riport generálása live-ban működik.\n\nA végső kézbesítés most már Telegram dokumentumként történik a vezetői admin chatre (7544590867), a Code node `binary.report` kimenetéből. Google Drive feltöltés továbbra sincs bekötve; ha később megjelenik megfelelő Drive credential, az külön második kézbesítési ágnak hozzáadható.',
    height: 280,
    width: 460,
    color: 5,
  },
  type: 'n8n-nodes-base.stickyNote',
  typeVersion: 1,
  position: [1640, 20],
  id: 'a4b6e2c1-4207-4ec6-9363-000000000008',
  name: 'Sticky Note - Drive blokk',
});

connections['Code - Heti Kontextus Generátor'] = {
  main: [[{ node: 'Telegram - Heti Kontextus Riport', type: 'main', index: 0 }]],
};

const payload = {
  name: liveWorkflow.name ?? '07 - ISZ Heti Kontextus Csomag',
  nodes,
  connections,
  settings: liveWorkflow.settings ?? {
    executionOrder: 'v1',
  },
};

fs.writeFileSync('_br_temp/updated_07_workflow_payload.json', JSON.stringify(payload, null, 2));

const res = await fetch(`${baseUrl}/api/v1/workflows/${workflowId}`, {
  method: 'PUT',
  headers: {
    'X-N8N-API-KEY': token,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(payload),
});

console.log('status=', res.status);
const text = await res.text();
console.log(text);
