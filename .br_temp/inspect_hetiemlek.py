import json
path = r'F:\mcp-brunella-core\docs\Egyéb\Iszapfull_nyilvan\IMPLEMENTED_2026_03_13\Iszapfaló - Heti Emlékeztető (Csütörtök 16_00).json'
with open(path, encoding='utf-8') as f:
    wf = json.load(f)
for node in wf.get('nodes', []):
    ntype = node.get('type', '')
    nname = node.get('name', '')
    params = node.get('parameters', {})
    print(f'NODE: {nname} ({ntype})')
    # search for chatId
    txt = json.dumps(params, ensure_ascii=False)
    if 'chat' in txt.lower() or 'set' in ntype.lower() or 'code' in ntype.lower() or 'schedule' in ntype.lower():
        print(txt[:600])
    print()
