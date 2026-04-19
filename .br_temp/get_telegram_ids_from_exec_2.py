import json, requests, re

with open('.env', 'r', encoding='utf-8') as f:
    key = re.search(r'N8N_API_KEY=(.*)', f.read()).group(1).strip()
headers = {'X-N8N-API-KEY': key, 'accept': 'application/json'}

chat_ids = {}

def process_workflow(wf_id, limit=100):
    url = f'https://iszapfalo.app.n8n.cloud/api/v1/executions?workflowId={wf_id}&limit={limit}&includeData=true'
    r = requests.get(url, headers=headers)
    if r.status_code == 200:
        execs = r.json().get('data', [])
        for e in execs:
            result_data = e.get('data', {}).get('resultData', {})
            run_data = result_data.get('runData', {})
            
            for node_name, items in run_data.items():
                if 'Telegram' in node_name or 'telegram' in node_name.lower():
                    for item in items:
                        try:
                            msg = item.get('data', {}).get('main', [[]])[0][0].get('json', {}).get('message', {})
                            if not msg:
                                msg = item.get('data', {}).get('main', [[]])[0][0].get('json', {}).get('body', {}).get('message', {})
                            if not msg: continue
                            chat = msg.get('chat', {})
                            user = msg.get('from', {})
                            
                            if chat.get('id'):
                                name = f"{user.get('first_name', '')} {user.get('last_name', '')}".strip()
                                if not name: name = user.get('username', '')
                                chat_ids[chat['id']] = name
                        except Exception:
                            pass

process_workflow('CAEaN0ryx5POpVSv', 100) # 02 
process_workflow('xRzVjIfw13N2Gk8C', 100) # 03 
# let's try getting all executions globally
process_workflow('', 100)

print("\nTalált Telegram felhasználók a korábbi futásokból:")
for cid, name in chat_ids.items():
    print(f"- Név: {name} | Chat ID: {cid}")
