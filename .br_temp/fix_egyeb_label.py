"""
06-os WORKFLOW JAVÍTÁS — 'Egyéb' label hozzáadása a Structured Output Parser sémájához
Gergely 4 labelt hozott létre: ❗_Sürgős, 💡_Ajánlatkérés, 🛠_Kotrás, Egyéb
De a séma csak 3-at tartalmaz — az Egyéb hiányzik!
"""
import requests, json, copy

API_KEY = open('n8n_api_key.txt').read().strip()
BASE = 'https://iszapfalo.app.n8n.cloud/api/v1'
HDR = {'X-N8N-API-KEY': API_KEY, 'Content-Type': 'application/json'}
WF06_ID = 'LGvkbQNUm44UEoMi'

# Új séma - mind a 4 labelt tartalmazza
NEW_SCHEMA_EXAMPLE = json.dumps({
    "labels": ["❗_Sürgős", "💡_Ajánlatkérés", "🛠_Kotrás", "Egyéb"],
    "confidence": 0.95,
    "reasoning": "Sürgős kulcsszó + új projekt + kotrás szolgáltatás",
    "categories": {
        "bejovo": ["❗_Sürgős", "💡_Ajánlatkérés"],
        "admin": ["Egyéb"],
        "tevekenyseg": ["🛠_Kotrás"],
        "rendszer": []
    }
}, ensure_ascii=False)

print('='*60)
print('06-OS STRUCTURED OUTPUT PARSER — "Egyéb" LABEL HOZZÁADÁSA')
print('='*60)

wf06 = requests.get(f'{BASE}/workflows/{WF06_ID}', headers=HDR).json()
wf06_modified = copy.deepcopy(wf06)

parser_nodes = ['Structured_Output_Parser', 'Structured_Output_Parser1', 
                'Structured Output Parser', 'Structured Output Parser1']

fixed_count = 0
for node in wf06_modified['nodes']:
    if node['name'] in parser_nodes:
        old_schema = node.get('parameters', {}).get('jsonSchemaExample', '')
        if 'Egyéb' not in old_schema:
            print(f'Javítás: "{node["name"]}" — Egyéb hozzáadva')
            node['parameters']['jsonSchemaExample'] = NEW_SCHEMA_EXAMPLE
            fixed_count += 1
        else:
            print(f'OK: "{node["name"]}" — már tartalmazza az Egyéb-et')

print(f'\nJavított node-ok száma: {fixed_count}/4')

if fixed_count > 0:
    print('\nFrissítem a workflow-t az API-n...')
    payload = {
        'name': wf06_modified['name'],
        'nodes': wf06_modified['nodes'],
        'connections': wf06_modified['connections'],
        'settings': wf06_modified.get('settings', {}),
        'staticData': wf06_modified.get('staticData', None)
    }
    resp = requests.put(f'{BASE}/workflows/{WF06_ID}', headers=HDR, json=payload)
    if resp.status_code in [200, 201]:
        print(f'✅ 06-os workflow sikeresen frissítve! HTTP {resp.status_code}')
        # Ellenőrzés
        updated = requests.get(f'{BASE}/workflows/{WF06_ID}', headers=HDR).json()
        for node in updated['nodes']:
            if node['name'] in parser_nodes:
                schema = node.get('parameters', {}).get('jsonSchemaExample', '')
                egyeb_ok = 'Egyéb' in schema
                icon = '✅' if egyeb_ok else '❌'
                print(f'  {icon} "{node["name"]}": Egyéb = {egyeb_ok}')
    else:
        print(f'❌ HIBA: HTTP {resp.status_code}')
        print(resp.text[:400])
else:
    print('Nem volt szükség javításra')

# ==========================================
# EXTRA: AI Agent prompt ellenőrzés
# ==========================================
print()
print('='*60)
print('AI AGENT NODE PROMPTOK — LABEL LISTA ELLENŐRZÉS')
print('='*60)

wf06_fresh = requests.get(f'{BASE}/workflows/{WF06_ID}', headers=HDR).json()

agent_nodes = ['E-mail_kategorizl', 'AI_Agent1', 'E-mail kategorizáló', 'AI Agent1', 'CRM_agent', 'CRM agent']
for node in wf06_fresh['nodes']:
    if node['name'] in agent_nodes or 'agent' in node.get('type', '').lower():
        disabled = node.get('disabled', False)
        if disabled:
            continue
        params = node.get('parameters', {})
        system_msg = params.get('systemMessage', '')
        if system_msg:
            print(f'\nAgent: "{node["name"]}"')
            # Label hivatkozások keresése
            if '❗' in system_msg or 'Sürgős' in system_msg or 'Egyéb' in system_msg:
                # Releváns sorok kiírása
                for line in system_msg.split('\n'):
                    if any(x in line for x in ['❗', '💡', '🛠', 'Egyéb', 'Sürgős', 'label', 'Label']):
                        print(f'  > {line.strip()[:120]}')
            else:
                print(f'  (nincs label hivatkozás a system message-ben)')

print()
print('KÉSZ!')
