import json, requests, re
with open('.env', 'r', encoding='utf-8') as f:
    key = re.search(r'N8N_API_KEY=(.*)', f.read()).group(1).strip()
headers = {'X-N8N-API-KEY': key, 'accept': 'application/json'}
url = 'https://iszapfalo.app.n8n.cloud/api/v1/executions/1790'
r = requests.get(url, headers=headers)
d = r.json()
print(list(d.keys()))
if 'data' in d:
    print(d['data'].get('resultData', {}).get('error', {}))
else:
    print("NO DATA?!", list(d.keys()), d.get('message', ''))
