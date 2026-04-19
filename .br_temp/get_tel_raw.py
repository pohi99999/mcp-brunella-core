import json, requests, re
with open('.env', 'r', encoding='utf-8') as f:
    key = re.search(r'N8N_API_KEY=(.*)', f.read()).group(1).strip()
headers = {'X-N8N-API-KEY': key, 'accept': 'application/json'}
r = requests.get('https://iszapfalo.app.n8n.cloud/api/v1/executions?limit=5&includeData=true', headers=headers)
d = r.json()
execs = d.get('data', [])
for e in execs:
    run_data = e.get('data', {}).get('resultData', {}).get('runData', {})
    for node_name, items in run_data.items():
        if 'Telegram' in node_name:
            print(json.dumps(items[0]['data']['main'][0][0]['json'], indent=2))
            break
