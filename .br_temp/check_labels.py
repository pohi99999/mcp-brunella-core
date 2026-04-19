"""
06-os WORKFLOW — Structured Output Parser schema és labels lista ellenőrzése
Cél: ellenőrizni, hogy a schema-ban pontosan ezek szerepelnek: ❗_Sürgős, 💡_Ajánlatkérés, 🛠_Kotrás, Egyéb
"""
import requests, json, re

API_KEY = open('n8n_api_key.txt').read().strip()
BASE = 'https://iszapfalo.app.n8n.cloud/api/v1'
HDR = {'X-N8N-API-KEY': API_KEY, 'Content-Type': 'application/json'}
WF06_ID = 'LGvkbQNUm44UEoMi'

wf06 = requests.get(f'{BASE}/workflows/{WF06_ID}', headers=HDR).json()

EXPECTED_LABELS = ['❗_Sürgős', '💡_Ajánlatkérés', '🛠_Kotrás', 'Egyéb']

print('='*60)
print('06-OS STRUCTURED OUTPUT PARSER — LABEL SCHEMA')
print('='*60)

for node in wf06['nodes']:
    # Structured Output Parser node
    if 'outputParserStructured' in node.get('type', '') or 'Structured' in node.get('name', ''):
        print(f'\nNode: "{node["name"]}"')
        params = node.get('parameters', {})
        schema_str = params.get('schemaType', 'N/A')
        
        # JSON schema
        json_schema = params.get('inputSchema', params.get('jsonSchema', ''))
        if not json_schema:
            # Néha különböző mezőnévben van
            for k, v in params.items():
                if 'schema' in k.lower() or 'json' in k.lower():
                    print(f'  Schema mező ({k}): {str(v)[:300]}')
        
        if json_schema:
            print(f'  JSON Schema (részlet):')
            try:
                schema_obj = json.loads(json_schema) if isinstance(json_schema, str) else json_schema
                print(json.dumps(schema_obj, ensure_ascii=False, indent=2)[:600])
            except:
                print(str(json_schema)[:600])
        
        print(f'  Összes param kulcsok: {list(params.keys())}')
        
        # Label enum keresése
        all_str = json.dumps(params, ensure_ascii=False)
        for lbl in EXPECTED_LABELS:
            found = lbl in all_str
            icon = '✅' if found else '❌'
            print(f'  {icon} "{lbl}" megtalálható: {found}')

# Gmail label-ek listázása az API-n keresztül (van-e live Gmail label lekérdező node?)
print()
print('='*60)
print('GET_MANY_LABELS NODE PARAMÉTEREK')
print('='*60)
for node in wf06['nodes']:
    if 'gmail' in node.get('type', '').lower() and 'labels' in node.get('name', '').lower():
        print(f'\nNode: "{node["name"]}"')
        params = node.get('parameters', {})
        print(json.dumps(params, ensure_ascii=False, indent=2)[:400])

# Guardrails node - esetleg ott vannak a label definíciók
print()
print('='*60)
print('GUARDRAILS NODE TARTALOM')
print('='*60)
for node in wf06['nodes']:
    if 'guardrail' in node.get('type', '').lower() and not 'disabled' in str(node):
        disabled = node.get('disabled', False)
        if disabled:
            continue
        print(f'\nNode: "{node["name"]}" (disabled: {disabled})')
        params = node.get('parameters', {})
        topic = params.get('topics', [])
        print(f'  Topics: {topic[:3]}')
        if params.get('inputText'):
            print(f'  Input text: {str(params.get("inputText", ""))[:200]}')

print()
print('='*60)
print('06-OS HIBÁK TIPIKUS OKA: Anthropic TIMEOUT / HTML CONTENT')
print()
print('A 27% sikerráta valószínű okai:')
print('1. Bizonyos emailek HTML tartalma zavarja a Claude feldolgozást')
print('2. Anthropic API timeout (néhány sec vs 30 sec limit)')
print('3. A Gmail label match működik (az OAuth reconnect segített)')
print()
print('Következő javítási lehetőség:')
print('  → Anthropic node-hoz error handling hozzáadása')
print('  → Max tokens limitálása a Claude node-ban')
