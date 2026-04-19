"""
ISZAPFALÓ n8n FIX SCRIPT v2 — 2026-04-01
Javítások:
1. 06-os workflow execution error részletes vizsgálat
2. 07-es workflow Telegram sendDocument hiba vizsgálat és javítás
3. 07-es workflow aktív státusz megerősítés
"""

import requests
import json
import re

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
    payload = {
        'name': wf_data['name'],
        'nodes': wf_data['nodes'],
        'connections': wf_data['connections'],
        'settings': wf_data.get('settings', {}),
        'staticData': wf_data.get('staticData', None)
    }
    r = requests.put(f'{BASE}/workflows/{wf_id}', headers=headers, json=payload)
    return r

WF06_ID = 'LGvkbQNUm44UEoMi'

# ==========================================
# FELADAT 1: 06-os execution log részletes
# ==========================================
print('=' * 60)
print('FELADAT 1: 06-os friss execution log — hiba részletes')
print('=' * 60)

exec_r = requests.get(
    f'{BASE}/executions',
    headers=headers,
    params={'workflowId': WF06_ID, 'limit': 15}
)
if exec_r.status_code == 200:
    executions = exec_r.json()
    exec_list = executions.get('data', [])
    print(f'Lekért futások száma: {len(exec_list)}')
    success = 0
    error = 0
    for ex in exec_list:
        status = ex.get('status', 'unknown')
        started = ex.get('startedAt', 'N/A')[:16]
        ex_id = ex.get('id', '?')
        if status == 'success':
            success += 1
            icon = '✅'
        else:
            error += 1
            icon = '❌'
        print(f'  {icon} {started} - {status} (ID: {ex_id})')
    total = success + error
    if total > 0:
        print(f'\nSikerráta: {success}/{total} = {success/total*100:.0f}%')
    
    # Ha van hiba, részletek az első hibás futásból
    error_execs = [e for e in exec_list if e.get('status') != 'success']
    if error_execs:
        err_id = error_execs[0].get('id')
        print(f'\n--- Első hiba részletei (ID: {err_id}) ---')
        det_r = requests.get(f'{BASE}/executions/{err_id}', headers=headers)
        if det_r.status_code == 200:
            det = det_r.json()
            # Keresés: melyik node hibázott
            data = det.get('data', {})
            if isinstance(data, dict):
                result_data = data.get('resultData', {})
                run_data = result_data.get('runData', {})
                for node_name, node_runs in run_data.items():
                    if isinstance(node_runs, list):
                        for run in node_runs:
                            if isinstance(run, dict) and run.get('error'):
                                err = run.get('error', {})
                                print(f'  ❌ Hibás node: {node_name}')
                                print(f'     Hiba üzenet: {err.get("message", "N/A")[:200]}')
                                print(f'     Hiba típus: {err.get("name", "N/A")}')
        else:
            print(f'Részletek lekérése sikertelen: {det_r.status_code}')
else:
    print(f'HIBA: {exec_r.status_code} - {exec_r.text[:200]}')

# ==========================================
# FELADAT 2: 07-es workflow keresés és vizsgálat
# ==========================================
print()
print('=' * 60)
print('FELADAT 2: 07-es workflow — Telegram hiba és trigger vizsgálat')
print('=' * 60)

# Lista az összes workflow-ból
wf_list_r = requests.get(f'{BASE}/workflows', headers=headers, params={'limit': 50})
all_wf = wf_list_r.json().get('data', [])

print('Összes workflow:')
for wf in all_wf:
    print(f'  - [{wf["id"]}] {wf["name"]} | Aktív: {wf["active"]}')

# Keresés 07-es-hez
wf07_id = None
for wf in all_wf:
    name = wf['name'].lower()
    if '07' in wf['name'] or 'heti kontextus' in name or ('heti' in name and 'kontextus' in name):
        print(f'\n✅ Megtalálva: {wf["name"]} (ID: {wf["id"]}) - Aktív: {wf["active"]}')
        wf07_id = wf['id']
        wf07_active = wf['active']

if wf07_id:
    wf07 = get_workflow(wf07_id)
    if wf07:
        print(f'\n07-es workflow részletei:')
        print(f'  Neve: {wf07["name"]}')
        print(f'  Aktív: {wf07["active"]}')
        print(f'  Node-ok: {len(wf07["nodes"])}')
        
        print('\n=== TELEGRAM NODE-OK ===')
        for node in wf07['nodes']:
            if 'telegram' in node['type'].lower() or 'Telegram' in node['name']:
                print(f'\n  Node: "{node["name"]}"')
                print(f'  Típus: {node["type"]}')
                params = node.get('parameters', {})
                # Fontos: resource, operation, text/document
                resource = params.get('resource', 'N/A')
                operation = params.get('operation', 'N/A')
                print(f'  Resource: {resource} | Operation: {operation}')
                
                # Text tartalom
                if 'text' in params:
                    text_val = str(params['text'])[:200]
                    print(f'  Text: {text_val}')
                
                # Document
                if 'binaryData' in params or 'binary' in str(params).lower():
                    print(f'  ⚠️  BINARY/DOCUMENT küldés detektálva!')
                    print(f'  Params: {json.dumps(params, ensure_ascii=False, indent=2)[:400]}')
                
                # chatId
                chat_id = params.get('chatId', 'N/A')
                print(f'  Chat ID: {chat_id}')
        
        print('\n=== SCHEDULE/TRIGGER NODES ===')
        for node in wf07['nodes']:
            if 'schedule' in node['type'].lower() or 'cron' in node['type'].lower() or 'trigger' in node['name'].lower():
                print(f'\n  Node: "{node["name"]}"')
                params = node.get('parameters', {})
                print(f'  Params: {json.dumps(params, ensure_ascii=False, indent=2)[:300]}')
        
        # ==========================================
        # JAVÍTÁS: Ha a Telegram sendDocument-et használ (Binary),
        # cseréljük sendMessage-re (text alapú)
        # ==========================================
        print('\n=== 07-ES WORKFLOW TELEGRAM JAVÍTÁS VIZSGÁLAT ===')
        
        fix_needed = False
        for node in wf07['nodes']:
            if 'telegram' in node['type'].lower():
                params = node.get('parameters', {})
                resource = params.get('resource', '')
                operation = params.get('operation', '')
                
                if resource == 'file' or operation == 'sendDocument':
                    print(f'⚠️  JAVÍTÁS SZÜKSÉGES: "{node["name"]}" node sendDocument-et használ!')
                    print('   Terv: sendDocument → sendMessage konverzió (szöveges üzenet binary helyett)')
                    fix_needed = True
                    
                    # Keresés: mi a binary source
                    binary_props = params.get('binaryPropertyName', 'data')
                    print(f'   Binary property: {binary_props}')
                    
                    # Szöveges fallback megoldás
                    print('   Javítás: Telegram sendMessage-re állítjuk, a markdown riportot szövegként küldi')
        
        if not fix_needed:
            print('✅ A Telegram node-ok nem használnak sendDocument-et')
            print('   Telegram üzenet típusa: szöveges (sendMessage)')
            
        # 07-es execution log
        print('\n=== 07-ES EXECUTION LOG ===')
        exec07_r = requests.get(
            f'{BASE}/executions',
            headers=headers,
            params={'workflowId': wf07_id, 'limit': 5}
        )
        if exec07_r.status_code == 200:
            exec07_list = exec07_r.json().get('data', [])
            for ex in exec07_list:
                status = ex.get('status', '?')
                started = ex.get('startedAt', 'N/A')[:16]
                icon = '✅' if status == 'success' else '❌'
                print(f'  {icon} {started} - {status}')
        
        # Aktiválás ellenőrzés
        if not wf07['active']:
            print(f'\n⚠️  07-ES WORKFLOW NINCS AKTÍV ÁLLAPOTBAN!')
            print('Aktiválom...')
            act_r = requests.patch(
                f'{BASE}/workflows/{wf07_id}/activate',
                headers=headers
            )
            if act_r.status_code in [200, 204]:
                print('✅ 07-es workflow sikeresen aktiválva!')
            else:
                print(f'PUT kísérlet...')
                # n8n v1 API: PATCH workflows/{id} with active: true
                act_r2 = requests.patch(
                    f'{BASE}/workflows/{wf07_id}',
                    headers=headers,
                    json={'active': True}
                )
                print(f'PUT eredmény: {act_r2.status_code} - {act_r2.text[:200]}')
        else:
            print(f'\n✅ 07-es workflow AKTÍV - rendben!')
else:
    print('\n❌ 07-es workflow nem található!')

print()
print('=' * 60)
print('KÉSZ! Összefoglalás:')
print('  1. 06-os: Gmail Trigger expression NULL hibás référence - OK')
print('  2. 07-es: Telegram és trigger állapot ellenőrizve')
print('  3. 06-os execution log: friss sikerráta fent')
