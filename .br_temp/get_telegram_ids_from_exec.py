import json, requests, re

with open('.env', 'r', encoding='utf-8') as f:
    key = re.search(r'N8N_API_KEY=(.*)', f.read()).group(1).strip()
headers = {'X-N8N-API-KEY': key, 'accept': 'application/json'}

print("Extracing Chat IDs from executions...")
# Fetch executions
url = 'https://iszapfalo.app.n8n.cloud/api/v1/executions?workflowId=CAEaN0ryx5POpVSv&limit=50&includeData=true'
r = requests.get(url, headers=headers)
if r.status_code == 200:
    execs = r.json().get('data', [])
    chat_ids = {}
    
    for e in execs:
        # data is usually in data.resultData.runData
        result_data = e.get('data', {}).get('resultData', {})
        run_data = result_data.get('runData', {})
        
        # Look for Telegram trigger node data
        trigger_node = run_data.get('Telegram_Uzenet') or run_data.get('Telegram Trigger')
        if trigger_node:
            for item in trigger_node:
                try:
                    msg = item.get('data', {}).get('main', [[]])[0][0].get('json', {}).get('message', {})
                    if not msg: continue
                    chat = msg.get('chat', {})
                    user = msg.get('from', {})
                    
                    if chat.get('id'):
                        first_name = user.get('first_name', '')
                        last_name = user.get('last_name', '')
                        username = user.get('username', '')
                        name = f"{first_name} {last_name}".strip()
                        if not name: name = username
                        chat_ids[chat['id']] = name
                except Exception as ex:
                    pass
                    
    print("\nTalált Telegram felhasználók a korábbi futásokból:")
    for cid, name in chat_ids.items():
        print(f"- Név: {name} | Chat ID: {cid}")
else:
    print('Failed to get executions:', r.status_code, r.text)

