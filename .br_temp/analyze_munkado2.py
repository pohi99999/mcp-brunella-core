import json

with open(r'F:\mcp-brunella-core\_br_temp\munkado_current.json', encoding='utf-8') as f:
    wf = json.load(f)

nodes = wf.get('nodes', [])

# Print code nodes
for node in nodes:
    nname = node.get('name', '')
    ntype = node.get('type', '')
    if 'code' in ntype.lower():
        params = node.get('parameters', {})
        code = params.get('jsCode', params.get('pythonCode', ''))
        print(f"\n=== CODE NODE: {nname} ===")
        print(code[:3000])

# Print set nodes
for node in nodes:
    nname = node.get('name', '')
    ntype = node.get('type', '')
    if ntype == 'n8n-nodes-base.set':
        params = node.get('parameters', {})
        print(f"\n=== SET NODE: {nname} ===")
        print(json.dumps(params, indent=2, ensure_ascii=False)[:1000])

# Print switch/if nodes
for node in nodes:
    nname = node.get('name', '')
    ntype = node.get('type', '')
    if ntype in ['n8n-nodes-base.switch', 'n8n-nodes-base.if']:
        params = node.get('parameters', {})
        print(f"\n=== {ntype.upper()}: {nname} ===")
        print(json.dumps(params, indent=2, ensure_ascii=False)[:1500])
