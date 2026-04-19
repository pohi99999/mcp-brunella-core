import json

with open(r'F:\mcp-brunella-core\_br_temp\munkado_current.json', encoding='utf-8') as f:
    wf = json.load(f)

nodes = wf.get('nodes', [])
print(f"Total nodes: {len(nodes)}")
print()

for node in nodes:
    nname = node.get('name', '')
    ntype = node.get('type', '')
    print(f"NODE: {nname} ({ntype})")
    
    params = node.get('parameters', {})
    
    if 'airtable' in ntype.lower():
        cols = params.get('columns', {})
        schema = cols.get('schema', [])
        mode = cols.get('mappingMode', '')
        values = cols.get('value', {})
        print(f"  mappingMode: {mode}")
        print(f"  Schema fields:")
        for s in schema:
            stype = s.get('type', '')
            sid = s.get('id', '')
            display = s.get('displayName', '')
            print(f"    {sid} | {stype} | display={display}")
        print(f"  Values:")
        for k, v in values.items():
            print(f"    {k}: {str(v)[:80]}")
    print()

print("\n=== CONNECTIONS ===")
conns = wf.get('connections', {})
for src, targets in conns.items():
    for conn_type, conn_list in targets.items():
        for group in conn_list:
            if group:
                for c in group:
                    print(f"  {src} -> {c.get('node', '?')} [{conn_type}]")
