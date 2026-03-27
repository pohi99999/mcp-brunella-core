import urllib.request
import json
import sys

try:
    url = 'https://api.airtable.com/v0/meta/bases/appU3xQMuAmpmmCEy/tables'
    req = urllib.request.Request(url, headers={'Authorization': 'Bearer patOVCOi3JeisHwOW.cd711ffb54eb7fd4a846f1ae591775487670a6323f299d2f088af386b2b5af6d'})
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
        print('SIKERES LEKÉRDEZÉS. TÁBLÁK:')
        for table in data.get('tables', []):
            if table.get('name') in ['Munkaidõ Nyilvántartás', 'MUNKAK', 'KOLTSEGEK', 'SZABADSAGOK']:
                print(f'\n--- {table.get("name")} ---')
                for field in table.get('fields', []):
                    print(f\"  - '{field.get('name')}' (Típus: {field.get('type')})\")
except Exception as e:
    print(f'HIBA: {e}')
