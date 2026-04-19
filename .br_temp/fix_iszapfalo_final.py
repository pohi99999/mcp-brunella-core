"""
ISZAPFALÓ n8n FIX SCRIPT — 2026-04-01
Gergely visszajelzése után elvégzett javítások:
1. 06-os workflow: 'Gmail Trigger' (szóköz) → 'Gmail_Trigger' (aláhúzás) expression javítás
2. 07-es workflow: Telegram sendDocument hiba vizsgálata és javítása
"""

import requests
import json
import re
import sys

API_KEY = open('n8n_api_key.txt').read().strip()
BASE = 'https://iszapfalo.app.n8n.cloud/api/v1'
headers = {'X-N8N-API-KEY': API_KEY, 'Content-Type': 'application/json'}

def get_workflow(wf_id):
    r = requests.get(f'{BASE}/workflows/{wf_id}', headers=headers)
    if r.status_code != 200:
        print(f'HIBA: {r.status_code} - {r.text[:200]}')
        return None
    return r.json()

def update_workflow(wf_id, wf_data):
    # n8n API PATCH - csak name, nodes, connections, settings küldendő
    payload = {
        'name': wf_data['name'],
        'nodes': wf_data['nodes'],
        'connections': wf_data['connections'],
        'settings': wf_data.get('settings', {}),
        'staticData': wf_data.get('staticData', None)
    }
    r = requests.put(f'{BASE}/workflows/{wf_id}', headers=headers, json=payload)
    return r

# ==========================================
# FELADAT 1: 06-os workflow Gmail trigger fix
# ==========================================
print('=' * 60)
print('FELADAT 1: 06-os workflow - Gmail Trigger expression javítás')
print('=' * 60)

WF06_ID = 'LGvkbQNUm44UEoMi'
wf06 = get_workflow(WF06_ID)

if wf06:
    print(f'Workflow neve: {wf06["name"]}')
    print(f'Aktív: {wf06["active"]}')
    print(f'Node-ok száma: {len(wf06["nodes"])}')
    print()
    
    # Nodes listázása
    for node in wf06['nodes']:
        print(f'  Node: {node["name"]} [{node["type"]}]')
    
    print()
    print('=== Gmail Trigger szóközös hivatkozásokat keresem ===')
    
    # JSON-ba konvertálva keresés
    wf_str = json.dumps(wf06)
    
    # Keresés: "Gmail Trigger" szóközzel (rossz) vs "Gmail_Trigger" aláhúzással (helyes)
    bad_refs = re.findall(r'\$\([\'"](Gmail Trigger)[\'"]\)', wf_str)
    good_refs = re.findall(r'\$\([\'"](Gmail_Trigger)[\'"]\)', wf_str)
    
    print(f'Hibás hivatkozások ("Gmail Trigger" szóközzel): {len(bad_refs)}')
    print(f'Helyes hivatkozások ("Gmail_Trigger" aláhúzással): {len(good_refs)}')
    
    if bad_refs:
        print('\n⚠️  JAVÍTÁS SZÜKSÉGES: Cserélöm a szóközt aláhúzásra...')
        
        # Csere a JSON stringben
        fixed_str = wf_str.replace("$('Gmail Trigger')", "$('Gmail_Trigger')")
        fixed_str = fixed_str.replace('$("Gmail Trigger")', '$("Gmail_Trigger")')
        
        wf06_fixed = json.loads(fixed_str)
        
        # Ellenőrzés
        bad_after = re.findall(r'\$\([\'"](Gmail Trigger)[\'"]\)', json.dumps(wf06_fixed))
        print(f'Javítás után hibás hivatkozások: {len(bad_after)}')
        
        if len(bad_after) == 0:
            print('Frissítem a workflow-t az API-n...')
            resp = update_workflow(WF06_ID, wf06_fixed)
            if resp.status_code in [200, 204]:
                print(f'✅ 06-os workflow sikeresen frissítve! Status: {resp.status_code}')
            else:
                print(f'❌ HIBA a frissítéskor: {resp.status_code}')
                print(resp.text[:500])
        else:
            print('❌ Javítás nem sikerült teljesen, maradtak hibás hivatkozások')
    else:
        print('✅ Nem található szóközös "Gmail Trigger" hivatkozás - nem kell javítani')
        
        # Részletesebb keresés
        print('\nRészletesebb keresés minden "Gmail" előfordulásra:')
        gmail_refs = re.findall(r'Gmail[^"\']*', wf_str)
        for ref in set(gmail_refs)[:20]:
            print(f'  "{ref}"')

# ==========================================
# FELADAT 2: 07-es workflow - Telegram hiba vizsgálata
# ==========================================
print()
print('=' * 60)
print('FELADAT 2: 07-es workflow - Telegram sendDocument hiba vizsgálat')
print('=' * 60)

# Keressük a 07-es workflow-t (IDja nem ismert előre - keresni kell)
wf_list_r = requests.get(f'{BASE}/workflows', headers=headers, params={'limit': 50})
wf_list = wf_list_r.json()

wf07 = None
wf07_id = None
for wf in wf_list.get('data', []):
    if '07' in wf['name'] or 'Heti Kontextus' in wf['name'] or 'heti' in wf['name'].lower():
        print(f'Találat: {wf["name"]} (ID: {wf["id"]}) - Aktív: {wf["active"]}')
        wf07_id = wf['id']

if wf07_id:
    wf07 = get_workflow(wf07_id)
    if wf07:
        print(f'\nWorkflow neve: {wf07["name"]}')
        print(f'Aktív: {wf07["active"]}')
        print(f'Node-ok száma: {len(wf07["nodes"])}')
        print()
        
        print('=== Telegram node-ok vizsgálata ===')
        for node in wf07['nodes']:
            if 'telegram' in node['type'].lower() or 'Telegram' in node['name']:
                print(f'\nNode: {node["name"]}')
                print(f'Típus: {node["type"]}')
                params = node.get('parameters', {})
                print(f'Paraméterek: {json.dumps(params, ensure_ascii=False, indent=2)[:500]}')
        
        print('\n=== Schedule trigger vizsgálata ===')
        for node in wf07['nodes']:
            if 'schedule' in node['type'].lower() or 'cron' in node['type'].lower():
                print(f'Node: {node["name"]}')
                params = node.get('parameters', {})
                print(f'Paraméterek: {json.dumps(params, ensure_ascii=False, indent=2)[:300]}')
else:
    print('❌ 07-es workflow nem található a listában!')
    print('Összes workflow:')
    for wf in wf_list.get('data', []):
        print(f'  - {wf["name"]} (ID: {wf["id"]}) - Aktív: {wf["active"]}')

# ==========================================
# FELADAT 3: 06-os execution log ellenőrzés
# ==========================================
print()
print('=' * 60)
print('FELADAT 3: Friss execution log - 06-os workflow')
print('=' * 60)

exec_r = requests.get(
    f'{BASE}/executions',
    headers=headers,
    params={'workflowId': WF06_ID, 'limit': 10, 'status': 'all'}
)
if exec_r.status_code == 200:
    executions = exec_r.json()
    exec_list = executions.get('data', [])
    print(f'Utolsó {len(exec_list)} futás:')
    success = 0
    error = 0
    for ex in exec_list:
        status = ex.get('status', 'unknown')
        started = ex.get('startedAt', 'N/A')
        if status == 'success':
            success += 1
            icon = '✅'
        else:
            error += 1
            icon = '❌'
        print(f'  {icon} {started[:16]} - {status}')
    print(f'\nSikerráta: {success}/{success+error} = {success/(success+error)*100:.0f}%')
else:
    print(f'HIBA: {exec_r.status_code}')

print()
print('KÉSZ!')
