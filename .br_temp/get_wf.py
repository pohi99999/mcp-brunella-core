import json, requests, os, re

# read env for key
with open('.env', 'r', encoding='utf-8') as f:
    key = re.search(r'N8N_API_KEY=(.*)', f.read()).group(1).strip()

headers = {'X-N8N-API-KEY': key, 'accept': 'application/json'}
url = 'https://iszapfalo.app.n8n.cloud/api/v1/workflows/CAEaN0ryx5POpVSv'

r = requests.get(url, headers=headers)
if r.status_code == 200:
    data = r.json()
    with open('_br_temp/workflow_now.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print('Saved to _br_temp/workflow_now.json')
    
    # print all credential IDs used
    creds = set()
    for n in data.get('nodes', []):
        if 'credentials' in n:
            creds.add(json.dumps(n['credentials']))
    print('Credentials in use:', creds)
else:
    print('Error:', r.status_code, r.text)
