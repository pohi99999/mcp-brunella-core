import json
import os

input_path = r"F:\mcp-brunella-core\.worktrees\004_Iszapfaló_n8n\Migracio\IMPORTALVA_N8N\MASTER_DEPLOY_V13\02_ISZ_AI_Agent_V2_V13.json"
output_path = r"F:\mcp-brunella-core\.worktrees\004_Iszapfaló_n8n\N8N_PRO\02_ISZ_AI_Agent_V2_V13_FIXED.json"

try:
    with open(input_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
except FileNotFoundError:
    print(f"File not found: {input_path}")
    exit(1)

nodes = data.get('nodes', [])
connections = data.get('connections', {})

# Renaming map
node_rename_map = {
    'Airtable_Tool': 'Munkaido_Rogzites',
    'Airtable_Tool1': 'Feladat_Letrehozas',
    'Airtable_Tool2': 'Koltseg_Rogzites',
    'Airtable_Tool3': 'Szabadsag_Rogzites'
}

# Chat ID expression
chat_id_expr = '={{ $node["Telegram_zenet"].json["message"]["chat"]["id"] }}'

# Field Mappings
# Note: Using $fromAI("Key") based on Prompt instructions where possible.
# 1. Munkaidő (Munkaido_Rogzites)
mapping_1 = {
    "Dátum": '={{ $fromAI("Date") }}',
    "Kezdés": '={{ $fromAI("StartTime") }}', # Not in prompt, but maybe implicit? Or use Date as Start?
    # Prompt only asks for Date. StartTime/EndTime are not in prompt.
    # But table needs them.
    # Strategy: Use Date for StartTime if missing? Or just leave empty?
    # I'll add StartTime/EndTime to mapping, assuming AI might provide them if asked or inferred.
    "Befejezés": '={{ $fromAI("EndTime") }}',
    "Leírás": '={{ $fromAI("Note") }}', # Prompt uses "Note"
    "Típus": '={{ $fromAI("Type") }}',
    "Chat ID": chat_id_expr
}

# 2. Munka (Feladat_Letrehozas)
mapping_2 = {
    "Feladat": '={{ $fromAI("Task_Description") }}', # Prompt uses "Task_Description"
    "Státusz": '={{ $fromAI("Status") }}', # "Várakozás" in prompt, but we can map it
    "Határidő": '={{ $fromAI("Deadline") }}',
    "Prioritás": '={{ $fromAI("Priority") }}',
    "Felelős": '={{ $fromAI("Assignee") }}',
    "Chat ID": chat_id_expr
}

# 3. Költség (Koltseg_Rogzites)
mapping_3 = {
    "Tétel": '={{ $fromAI("Note") }}', # Prompt uses "Note" for description, mapping to Tétel (Item)
    "Összeg": '={{ $fromAI("Amount") }}',
    "Kategória": '={{ $fromAI("Category") }}',
    "Dátum": '={{ $fromAI("Date") }}',
    "Chat ID": chat_id_expr
}

# 4. Szabadság (Szabadsag_Rogzites)
mapping_4 = {
    "Kezdés": '={{ $fromAI("Start_Date") }}', # Prompt uses Start_Date
    "Vége": '={{ $fromAI("End_Date") }}',     # Prompt uses End_Date
    "Típus": '={{ $fromAI("Type") }}',
    "Indoklás": '={{ $fromAI("Reason") }}',
    "Státusz": '={{ $fromAI("Status") }}',
    "Chat ID": chat_id_expr
}

mappings = {
    'Munkaido_Rogzites': ('Munkaidő Nyilvántartás', mapping_1),
    'Feladat_Letrehozas': ('MUNKAK', mapping_2),
    'Koltseg_Rogzites': ('KOLTSEGEK', mapping_3),
    'Szabadsag_Rogzites': ('SZABADSAGOK', mapping_4)
}

# 1. Rename Nodes
print("Renaming nodes...")
for node in nodes:
    if node['name'] in node_rename_map:
        old_name = node['name']
        new_name = node_rename_map[old_name]
        print(f"  Renaming {old_name} -> {new_name}")
        node['name'] = new_name

# 2. Update Connections
print("Updating connections...")
new_connections = {}
for source, targets in connections.items():
    new_source = node_rename_map.get(source, source)
    new_targets = {} # Connections are typically list of lists or dict
    # Actually 'targets' structure: { "main": [[{node:..., ...}]], ... }
    
    new_targets_struct = {}
    for conn_type, conn_list in targets.items():
        new_conn_list = []
        for conn_sublist in conn_list:
            new_sublist = []
            for conn in conn_sublist:
                new_conn = conn.copy()
                if new_conn['node'] in node_rename_map:
                    new_conn['node'] = node_rename_map[new_conn['node']]
                new_sublist.append(new_conn)
            new_conn_list.append(new_sublist)
        new_targets_struct[conn_type] = new_conn_list
    
    new_connections[new_source] = new_targets_struct

data['connections'] = new_connections

# 3. Apply Fixes (Table & Columns)
print("Applying fixes...")
for node in nodes:
    if node['name'] in mappings:
        target_table, mapping = mappings[node['name']]
        print(f"  Fixing {node['name']} -> {target_table}")
        
        # Ensure params exist
        if 'parameters' not in node: node['parameters'] = {}
        
        # Operation
        node['parameters']['operation'] = 'append'
        
        # Table
        # Force set table to target
        current_table = node['parameters'].get('table', {})
        if isinstance(current_table, dict):
            current_table['value'] = target_table
            current_table['mode'] = 'name'
        else:
            node['parameters']['table'] = {'value': target_table, 'mode': 'name'}
            
        # Columns
        new_columns_value = {}
        for airtable_field, source_expression in mapping.items():
            new_columns_value[airtable_field] = source_expression
            
        node['parameters']['columns'] = {
            "mappingMode": "defineBelow",
            "value": new_columns_value
        }
        
        # Typecast
        if 'options' not in node['parameters']: node['parameters']['options'] = {}
        node['parameters']['options']['typecast'] = True

# Save
try:
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4)
    print(f"Saved fixed JSON to {output_path}")
except Exception as e:
    print(f"Error saving file: {e}")
