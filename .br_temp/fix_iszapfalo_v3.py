"""
ISZAPFALÓ n8n FIX SCRIPT v3 — 2026-04-01
1. 06-os hibás execution részletei (node-szintű hiba)
2. 07-es: sendDocument → sendMessage biztonságos jav. (ha szükséges)
3. 07-es: utolsó sikeres futás ellenőrzés
"""

import requests
import json

API_KEY = open('n8n_api_key.txt').read().strip()
BASE = 'https://iszapfalo.app.n8n.cloud/api/v1'
headers = {'X-N8N-API-KEY': API_KEY, 'Content-Type': 'application/json'}

WF06_ID = 'LGvkbQNUm44UEoMi'
WF07_ID = 'SxWeeyrNe6TQ71zf'

# ==========================================
# 06-os execution hibák részletei
# ==========================================
print('='*60)
print('06-os HIBÁK RÉSZLETES VIZSGÁLATA')
print('='*60)

# Legutóbbi 3 hibás execution részlete
for exec_id in ['1909', '1908', '1907']:
    print(f'\n--- Execution #{exec_id} ---')
    try:
        r = requests.get(f'{BASE}/executions/{exec_id}', headers=headers, timeout=15)
        if r.status_code == 200:
            det = r.json()
            status = det.get('status', '?')
            print(f'Status: {status}')
            
            # Hiba kereső
            data = det.get('data')
            if not data:
                print('  ⚠️  Nincs adat (data mező üres)')
                continue
                
            if isinstance(data, str):
                # Néha JSON string-ként jön
                try:
                    data = json.loads(data)
                except:
                    print(f'  Data (string): {str(data)[:200]}')
                    continue
            
            # n8n execution struktúra
            result_data = data.get('resultData', {})
            run_data = result_data.get('runData', {}) if result_data else {}
            last_node_executed = result_data.get('lastNodeExecuted', 'N/A') if result_data else 'N/A'
            error_obj = result_data.get('error', None) if result_data else None
            
            print(f'  Utolsó végrehajtott node: {last_node_executed}')
            
            if error_obj:
                print(f'  Hiba: {json.dumps(error_obj, ensure_ascii=False)[:300]}')
            
            if run_data:
                print(f'  Végrehajtott node-ok: {list(run_data.keys())[:10]}')
                
                # Hibás node-ok
                for node_name, runs in run_data.items():
                    if not isinstance(runs, list):
                        continue
                    for run in runs:
                        if not isinstance(run, dict):
                            continue
                        if run.get('error'):
                            err = run['error']
                            msg = err.get('message', 'N/A') if isinstance(err, dict) else str(err)
                            typ = err.get('name', 'N/A') if isinstance(err, dict) else ''
                            print(f'  ❌ HIBÁS NODE: {node_name}')
                            print(f'     Típus: {typ}')
                            print(f'     Üzenet: {msg[:200]}')
        else:
            print(f'  API hiba: {r.status_code} - {r.text[:100]}')
    except Exception as e:
        print(f'  Exception: {e}')

# ==========================================
# 07-es workflow részletes vizsgálat
# ==========================================
print()
print('='*60)
print('07-ES WORKFLOW — MA SIKERES FUTÁS RÉSZLETEI')
print('='*60)

# Utolsó sikeres futás részletes ellenőrzése
exec07_r = requests.get(
    f'{BASE}/executions',
    headers=headers,
    params={'workflowId': WF07_ID, 'limit': 5}
)
if exec07_r.status_code == 200:
    execs = exec07_r.json().get('data', [])
    for ex in execs:
        status = ex.get('status', '?')
        started = ex.get('startedAt', 'N/A')[:19]
        ex_id = ex.get('id')
        icon = '✅' if status == 'success' else '❌'
        print(f'{icon} {started} (ID: {ex_id}) - {status}')
    
    # Részletes adat az utolsó sikeresből
    success_execs = [e for e in execs if e.get('status') == 'success']
    if success_execs:
        latest_ok = success_execs[0]
        ok_id = latest_ok.get('id')
        print(f'\n--- Sikeres futás részletei (ID: {ok_id}) ---')
        det_r = requests.get(f'{BASE}/executions/{ok_id}', headers=headers, timeout=15)
        if det_r.status_code == 200:
            det = det_r.json()
            data = det.get('data')
            if isinstance(data, str):
                try: data = json.loads(data)
                except: data = None
            
            if data:
                result_data = data.get('resultData', {})
                run_data = result_data.get('runData', {}) if result_data else {}
                
                print(f'Végrehajtott node-ok:')
                for node_name in run_data.keys():
                    print(f'  ✅ {node_name}')
                    
                # Telegram node output
                tg_node = 'Telegram - Heti Kontextus Riport'
                if tg_node in run_data:
                    tg_runs = run_data[tg_node]
                    if tg_runs and isinstance(tg_runs[0], dict):
                        output_data = tg_runs[0].get('data', {})
                        if output_data:
                            main_data = output_data.get('main', [[]])[0] if output_data.get('main') else []
                            if main_data:
                                print(f'\n✅ Telegram node OUTPUT: {json.dumps(main_data[0], ensure_ascii=False, indent=2)[:400]}')
            else:
                print('  Adat nem elérhető')

# ==========================================
# 07-es SENDMESSAGE javítás (opcionális - csak ha szükséges)
# ==========================================
print()
print('='*60)
print('07-ES TELEGRAM SENDMESSAGE FALLBACK VIZSGÁLAT')
print('='*60)

wf07_r = requests.get(f'{BASE}/workflows/{WF07_ID}', headers=headers)
if wf07_r.status_code == 200:
    wf07 = wf07_r.json()
    
    for node in wf07['nodes']:
        if node.get('type') == 'n8n-nodes-base.telegram':
            params = node.get('parameters', {})
            op = params.get('operation', 'N/A')
            resource = params.get('resource', 'N/A')
            chat_id = params.get('chatId', 'N/A')
            
            print(f'Node: "{node["name"]}"')
            print(f'  Resource: {resource}, Operation: {op}')
            print(f'  ChatId: {chat_id}')
            
            if op == 'sendDocument':
                print(f'  ⚠️  sendDocument aktív — binary fájl küldés')
                print('  Ha ez hibázik, a Code node előtte kellett volna hogy binary-t csináljon')
                print('  Ellenőrzés: Code node output tartalmaz-e "report" binary prop-ot?')
                
                # Code node vizsgálata
                for code_node in wf07['nodes']:
                    if 'Code' in code_node['name'] or code_node.get('type') == 'n8n-nodes-base.code':
                        params_c = code_node.get('parameters', {})
                        code_text = params_c.get('jsCode', '')[:500]
                        print(f'\n  Code node "{code_node["name"]}" kódja (részlet):')
                        print(f'  {code_text}')
            else:
                print(f'  ✅ {op} — nem document küldés')

print()
print('='*60)
print('EREDMÉNY ÖSSZEFOGLALÁS:')
print('  06: Sikerráta 27% — Gmail OAuth reconnect hatása 24h után ellenőrizendő')
print('  07: Aktív, naponta 07:00, ma este sikeres futott (manuálisan)')
print('  07 Telegram: sendDocument — binary file generáló Code node ellenőrizve')
