import json, requests, re
with open('.env', 'r', encoding='utf-8') as f:
    key = re.search(r'N8N_API_KEY=(.*)', f.read()).group(1).strip()
headers = {'X-N8N-API-KEY': key, 'accept': 'application/json'}
r = requests.get('https://iszapfalo.app.n8n.cloud/api/v1/executions/1790?includeData=true', headers=headers)
if r.status_code == 200:
    d = r.json()
    e = d.get('data', {}).get('resultData', {}).get('error', {})
    print(json.dumps(e, indent=2))
else:
    print('Failed:', r.text)
