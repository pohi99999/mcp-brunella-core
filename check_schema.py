import os
import urllib.request
import json
import sys

try:
    url = 'https://api.airtable.com/v0/meta/bases/appU3xQMuAmpmmCEy/tables'
    req = urllib.request.Request(url, headers={'Authorization': 'Bearer ' + os.environ.get('AIRTABLE_TOKEN', '')})
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
        print('SIKERES LEK�RDEZ�S. T�BL�K:')
        for table in data.get('tables', []):
            if table.get('name') in ['Munkaid� Nyilv�ntart�s', 'MUNKAK', 'KOLTSEGEK', 'SZABADSAGOK']:
                print(f'\n--- {table.get("name")} ---')
                for field in table.get('fields', []):
                    print(f\"  - '{field.get('name')}' (T�pus: {field.get('type')})\")
except Exception as e:
    print(f'HIBA: {e}')
