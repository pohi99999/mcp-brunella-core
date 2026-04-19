import json
with open(r'F:\mcp-brunella-core\_br_temp\munkado_current.json', encoding='utf-8') as f:
    wf = json.load(f)
for node in wf.get('nodes', []):
    creds = node.get('credentials', {})
    if creds:
        name = node.get('name', '')
        print(f'{name}: {json.dumps(creds, ensure_ascii=False)}')
