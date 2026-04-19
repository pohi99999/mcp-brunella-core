"""
Munkaidő workflow fix + Error Monitoring aktiválás
- Bug: Munkatárs Neve array field crashes on null record ID
- Fix: null-safe expression + PUT back to n8n
"""
import json, requests, copy

N8N_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkZTMzZTc2ZC03YmJmLTRkZTgtOTg2Ny1kNDY0NmE0M2VmZjQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzczNDE0MjM5LCJleHAiOjE3NzU5NDQ4MDB9.LuupmMbXzlYae0Etj1QS5AD0bwQoIcP-CtBWq4KzCes'
N8N_BASE = 'https://iszapfalo.app.n8n.cloud/api/v1'
MUNKADO_ID = 'WMAB7hYqJObUwAHN'
ERROR_MON_ID = 'Ofgnqc8dgFshia0b'

headers = {
    'X-N8N-API-KEY': N8N_KEY,
    'Content-Type': 'application/json'
}

# === STEP 1: Load the current Munkaidő workflow from n8n ===
print('=== STEP 1: Fetching Munkaidő workflow from n8n ===')
r = requests.get(f'{N8N_BASE}/workflows/{MUNKADO_ID}', headers=headers)
print(f'Status: {r.status_code}')
if not r.ok:
    print('ERROR:', r.text[:500])
    exit(1)

wf = r.json()
nodes = wf.get('nodes', [])
print(f'Total nodes: {len(nodes)}')

# === STEP 2: Find and fix all buggy Munkatárs Neve fields ===
print('\n=== STEP 2: Finding and fixing Munkatárs Neve bug ===')

OLD_VAL = '={{ [$json.munkatars_record_id] }}'
NEW_VAL = '={{ $json.munkatars_record_id ? [$json.munkatars_record_id] : [] }}'

fix_counter = [0]

def fix_recursive(obj, node_name, path=''):
    if isinstance(obj, dict):
        for k, v in obj.items():
            if isinstance(v, str) and OLD_VAL in v:
                print(f'  FIXING node "{node_name}" path "{path}.{k}":')
                print(f'    OLD: {v[:80]}')
                obj[k] = v.replace(OLD_VAL, NEW_VAL)
                print(f'    NEW: {obj[k][:80]}')
                fix_counter[0] += 1
            else:
                fix_recursive(v, node_name, f'{path}.{k}')
    elif isinstance(obj, list):
        for i, item in enumerate(obj):
            fix_recursive(item, node_name, f'{path}[{i}]')

for node in nodes:
    node_name = node.get('name', '')
    params = node.get('parameters', {})
    fix_recursive(params, node_name)

fixed_count = fix_counter[0]

print(f'\nTotal fixes applied: {fixed_count}')

if fixed_count == 0:
    print('WARNING: No fixes applied - checking actual node structure...')
    # Show Airtable nodes for inspection
    for node in nodes:
        if 'airtable' in node.get('type', '').lower():
            print(f'\nNode: {node["name"]}')
            print(json.dumps(node.get('parameters', {}), indent=2, ensure_ascii=False)[:800])

# === STEP 3: PUT the fixed workflow back ===
print('\n=== STEP 3: Pushing fixed workflow back to n8n ===')
r2 = requests.put(
    f'{N8N_BASE}/workflows/{MUNKADO_ID}',
    headers=headers,
    json=wf
)
print(f'PUT Status: {r2.status_code}')
if r2.ok:
    print('SUCCESS: Workflow updated!')
else:
    print('ERROR:', r2.text[:500])

# === STEP 4: Activate Munkaidő workflow ===
print('\n=== STEP 4: Activating Munkaidő workflow ===')
r3 = requests.patch(
    f'{N8N_BASE}/workflows/{MUNKADO_ID}/activate',
    headers=headers
)
print(f'Activate Status: {r3.status_code}')
if r3.ok:
    print('SUCCESS: Munkaidő workflow ACTIVATED!')
else:
    print('Response:', r3.text[:500])

# === STEP 5: Activate Error Monitoring ===
print('\n=== STEP 5: Activating Error Monitoring workflow ===')
r4 = requests.patch(
    f'{N8N_BASE}/workflows/{ERROR_MON_ID}/activate',
    headers=headers
)
print(f'Activate Status: {r4.status_code}')
if r4.ok:
    print('SUCCESS: Error Monitoring ACTIVATED!')
else:
    print('Response:', r4.text[:500])

print('\n=== DONE ===')
