import json, requests, os, re
with open('.env', 'r', encoding='utf-8') as f:
    key = re.search(r'N8N_API_KEY=(.*)', f.read()).group(1).strip()
headers = {'X-N8N-API-KEY': key, 'accept': 'application/json'}
url = 'https://iszapfalo.app.n8n.cloud/api/v1/executions?workflowId=CAEaN0ryx5POpVSv&limit=5'
r = requests.get(url, headers=headers)
if r.status_code == 200:
    for e in r.json().get('data', []):
        print(e['id'], e['status'], e['startedAt'], e.get('error'))
else:
    print('Failed', r.status_code)
