"""
Fix the Munkaidő workflow JSON locally + create Heti Kontextus Csomag workflow
"""
import json

# === FIX MUNKAIDŐ ===
print('=== Fixing Munkaidő workflow JSON ===')
with open(r'F:\mcp-brunella-core\_br_temp\munkado_current.json', encoding='utf-8') as f:
    wf = json.load(f)

OLD_VAL = '={{ [$json.munkatars_record_id] }}'
NEW_VAL = '={{ $json.munkatars_record_id ? [$json.munkatars_record_id] : [] }}'
fix_counter = [0]

def fix_recursive(obj, node_name, path=''):
    if isinstance(obj, dict):
        for k, v in obj.items():
            if isinstance(v, str) and OLD_VAL in v:
                print(f'  FIX in "{node_name}" -> {path}.{k}')
                print(f'    OLD: {v[:80]}')
                obj[k] = v.replace(OLD_VAL, NEW_VAL)
                print(f'    NEW: {obj[k][:80]}')
                fix_counter[0] += 1
            else:
                fix_recursive(v, node_name, f'{path}.{k}')
    elif isinstance(obj, list):
        for i, item in enumerate(obj):
            fix_recursive(item, node_name, f'{path}[{i}]')

for node in wf.get('nodes', []):
    fix_recursive(node.get('parameters', {}), node.get('name', ''))

print(f'Total fixes: {fix_counter[0]}')

# Save fixed version
with open(r'F:\mcp-brunella-core\_br_temp\munkado_FIXED.json', 'w', encoding='utf-8') as f:
    json.dump(wf, f, ensure_ascii=False, indent=2)
print('Saved: munkado_FIXED.json')

if fix_counter[0] == 0:
    print('WARNING: 0 fixes! Checking actual values in Airtable nodes...')
    for node in wf.get('nodes', []):
        if 'airtable' in node.get('type', '').lower() and 'agent' not in node.get('type','').lower():
            print(f'\nNode: {node["name"]}')
            params = node.get('parameters', {})
            # print full params
            print(json.dumps(params, indent=2, ensure_ascii=False)[:1200])
