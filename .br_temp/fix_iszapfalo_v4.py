"""
06-os WORKFLOW CODE NODE VIZSGÁLAT + LIVE API HIVÁS A sendDocument javításhoz
"""
import requests, json, re

API_KEY = open('n8n_api_key.txt').read().strip()
BASE = 'https://iszapfalo.app.n8n.cloud/api/v1'
HDR = {'X-N8N-API-KEY': API_KEY, 'Content-Type': 'application/json'}

WF06_ID = 'LGvkbQNUm44UEoMi'
WF07_ID = 'SxWeeyrNe6TQ71zf'

# ==========================================
# 06-OS WORKFLOW LIVE - CODE NODE TARTALOM
# ==========================================
print('='*60)
print('06-OS LIVE WORKFLOW — CODE NODE LABEL NEVEK')
print('='*60)

wf06 = requests.get(f'{BASE}/workflows/{WF06_ID}', headers=HDR).json()

for node in wf06['nodes']:
    if 'Code' in node['name'] and node.get('type') == 'n8n-nodes-base.code':
        code = node.get('parameters', {}).get('jsCode', '')
        if not code:
            continue
        print(f'\nNode: "{node["name"]}"')
        
        # Gmail label nevek
        label_strs = re.findall(r'[❗💡🛠🔴🟠🟡🟢][\w_\-]+', code)
        print(f'Emoji label-ek: {label_strs}')
        
        # Minden "label" tartalmú sor
        for line in code.split('\n'):
            if 'label' in line.lower() or 'gmail' in line.lower() or '❗' in line or '💡' in line or '🛠' in line:
                print(f'  > {line.strip()[:120]}')

# ==========================================
# 07-ES WORKFLOW — SENDMESSAGE JAVÍTÁS
# ==========================================
print()
print('='*60)
print('07-ES WORKFLOW — TELEGRAM SENDMESSAGE JAVÍTÁS')
print('='*60)

wf07 = requests.get(f'{BASE}/workflows/{WF07_ID}', headers=HDR).json()
print(f'Aktív: {wf07["active"]}')

# Code node tartalom (heti kontextus generátor)
for node in wf07['nodes']:
    if node.get('type') == 'n8n-nodes-base.code':
        code = node.get('parameters', {}).get('jsCode', '')
        print(f'\nCode node: "{node["name"]}"')
        print(f'Kód (első 1000 kar):\n{code[:1000]}')

# Telegram node részletei
print()
print('--- TELEGRAM NODE ---')
for node in wf07['nodes']:
    if node.get('type') == 'n8n-nodes-base.telegram':
        params = node.get('parameters', {})
        print(f'Node: "{node["name"]}"')
        print(json.dumps(params, ensure_ascii=False, indent=2))

# ==========================================
# JAVÍTÁS: sendDocument → sendMessage
# A Code node markdown-t generál → szövegként küldjük Telegram-ba
# ==========================================
print()
print('='*60)
print('07-ES TELEGRAM SENDMESSAGE JAVÍTÁS VÉGREHAJTÁSA')
print('='*60)

# Megkeresni a Telegram node-ot és módosítani
wf07_modified = json.loads(json.dumps(wf07))  # deep copy
telegram_fixed = False

for node in wf07_modified['nodes']:
    if node.get('type') == 'n8n-nodes-base.telegram' and node['name'] == 'Telegram - Heti Kontextus Riport':
        old_op = node['parameters'].get('operation', 'N/A')
        
        if old_op == 'sendDocument':
            print(f'Javítás: "{node["name"]}" sendDocument → sendMessage')
            
            # Új paraméterek: szöveges üzenet
            node['parameters'] = {
                'resource': 'message',
                'operation': 'sendMessage',
                'chatId': node['parameters'].get('chatId', '8468817202'),
                'text': (
                    '=📦 *Heti Kontextus Riport* — {{ $now.format("yyyy-MM-dd") }}\n\n'
                    '={{ $json.markdown }}'
                ),
                'additionalFields': {
                    'parse_mode': 'Markdown',
                    'disable_notification': False
                }
            }
            telegram_fixed = True
            print('  ✅ Paraméterek frissítve sendMessage-re')
        else:
            print(f'  ✅ Már {old_op} — nem kell javítani')

if telegram_fixed:
    print('\nFrissítem a workflow-t API-n...')
    payload = {
        'name': wf07_modified['name'],
        'nodes': wf07_modified['nodes'],
        'connections': wf07_modified['connections'],
        'settings': wf07_modified.get('settings', {}),
        'staticData': wf07_modified.get('staticData', None)
    }
    resp = requests.put(f'{BASE}/workflows/{WF07_ID}', headers=HDR, json=payload)
    if resp.status_code in [200, 201, 204]:
        print(f'✅ 07-es workflow Telegram javítva! HTTP {resp.status_code}')
    else:
        print(f'❌ HIBA: HTTP {resp.status_code}')
        print(resp.text[:400])
else:
    print('Nem szükséges javítás')

print()
print('KÉSZ.')
