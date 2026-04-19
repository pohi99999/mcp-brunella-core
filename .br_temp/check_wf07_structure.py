import requests, json
API_KEY = open('n8n_api_key.txt').read().strip()
HDR = {'X-N8N-API-KEY': API_KEY}
wf07 = requests.get('https://iszapfalo.app.n8n.cloud/api/v1/workflows/SxWeeyrNe6TQ71zf', headers=HDR).json()
print(f'07-es workflow OSSZES NODE ({len(wf07["nodes"])} db):')
print()
for i, node in enumerate(wf07['nodes']):
    disabled = node.get('disabled', False)
    dis_icon = ' [DISABLED/KIKAPCSOLT]' if disabled else ' [AKTIV]'
    ntype = node['type'].split('.')[-1]
    print(f'  {i+1}. [{ntype}] "{node["name"]}"{dis_icon}')
    if 'drive' in node['name'].lower() or 'drive' in node['type'].lower() or 'googledrive' in node['type'].lower():
        print(f'     >>> GOOGLE DRIVE NODE!')
        print(f'     Params: {json.dumps(node.get("parameters", {}), ensure_ascii=False)[:300]}')
    if 'telegram' in node['type'].lower():
        params = node.get('parameters', {})
        print(f'     >>> TELEGRAM: operation={params.get("operation","N/A")} chatId={params.get("chatId","N/A")}')

# Connections - mi kapcsolódik mihez
print()
print('=== CONNECTIONS (folyamatábra) ===')
conns = wf07.get('connections', {})
for from_node, conn_data in conns.items():
    for port_type, targets in conn_data.items():
        for target_list in targets:
            for target in target_list:
                print(f'  {from_node} --> {target["node"]}')
