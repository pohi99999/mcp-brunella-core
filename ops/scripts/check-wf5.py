import requests, re

env = open('F:/mcp-brunella-core/.env').read()
token = re.search(r'^N8N_API_DEV=(.+)', env, re.M).group(1).strip()
hdr = {'X-N8N-API-KEY': token}

wfs = requests.get('http://localhost:5678/api/v1/workflows', headers=hdr).json()
print('n8n Workflow allapotok:')
for wf in sorted(wfs['data'], key=lambda x: x['name']):
    status = '[AKTIV]' if wf['active'] else '[szunet]'
    name = wf['name']
    print(f'  {status} {name}')

print()
wf5_entry = next(w for w in wfs['data'] if 'WF-5' in w['name'])
wf5 = requests.get(f"http://localhost:5678/api/v1/workflows/{wf5_entry['id']}", headers=hdr).json()
webhook = next((n for n in wf5['nodes'] if 'webhook' in n['type'].lower()), None)
if webhook:
    path = webhook.get('parameters', {}).get('path', 'N/A')
    print(f"WF-5 webhook path: {path}")
    print(f"WF-5 webhook URL:  http://localhost:5678/webhook/{path}")

sheets_node = next((n for n in wf5['nodes'] if n['type'] == 'n8n-nodes-base.googleSheets'), None)
if sheets_node:
    sid = sheets_node['parameters']['documentId']['value']
    print(f"WF-5 Sheets ID:    {sid}")
    print(f"WF-5 Sheet neve:   {sheets_node['parameters']['sheetName']['value']}")
print()
print(f"WF-5 aktiv: {wf5.get('active')}")
print("=== MINDEN KESZ ===")
