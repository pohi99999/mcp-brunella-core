import json, requests, re

with open('.env', 'r', encoding='utf-8') as f:
    key = re.search(r'N8N_API_KEY=(.*)', f.read()).group(1).strip()
headers = {'X-N8N-API-KEY': key, 'accept': 'application/json'}

chat_ids = {}

url = 'https://iszapfalo.app.n8n.cloud/api/v1/executions?limit=250&includeData=true'
r = requests.get(url, headers=headers)
if r.status_code == 200:
    for e in r.json().get('data', []):
        run_data = e.get('data', {}).get('resultData', {}).get('runData', {})
        for node_name, items in run_data.items():
            if 'Telegram' in node_name or 'telegram' in node_name.lower():
                for item in items:
                    try:
                        msg = item.get('data', {}).get('main', [[]])[0][0].get('json', {}).get('message', {})
                        if not msg: msg = item.get('data', {}).get('main', [[]])[0][0].get('json', {}).get('body', {}).get('message', {})
                        if msg and 'chat' in msg:
                            cid = msg['chat']['id']
                            name = f"{msg.get('from',{}).get('first_name','')} {msg.get('from',{}).get('last_name','')}".strip()
                            chat_ids[cid] = name or 'Ismeretlen'
                    except: pass
print(chat_ids)
