import requests, json

AIRTABLE_KEY = 'patOVCOi3JeisHwOW.cd711ffb54eb7fd4a846f1ae591775487670a6323f299d2f088af386b2b5af6d'
BASE_IDS = {
    'Folyamatfigyelő': 'appU3xQMuAmpmmCEy',
    'Iszapfalo_elesos': 'apptMJgDmNy3I1lMm',
}

headers = {'Authorization': f'Bearer {AIRTABLE_KEY}'}

for base_name, base_id in BASE_IDS.items():
    print(f'\n{"="*60}')
    print(f'BASE: {base_name} ({base_id})')
    print('='*60)
    r = requests.get(f'https://api.airtable.com/v0/meta/bases/{base_id}/tables', headers=headers)
    print('Status:', r.status_code)
    if r.ok:
        data = r.json()
        for t in data.get('tables', []):
            print(f'\n  TABLE: {t["name"]} (ID: {t["id"]})')
            for f in t.get('fields', []):
                opts = ''
                ftype = f['type']
                if 'options' in f:
                    o = f['options']
                    if 'linkedTableId' in o:
                        opts = f' -> linkedTable: {o["linkedTableId"]}'
                    elif 'choices' in o:
                        choices = [c['name'] for c in o['choices'][:6]]
                        opts = ' choices: ' + ', '.join(choices)
                print(f'    [{ftype}] {f["name"]} (ID: {f["id"]}){opts}')
    else:
        print(r.text[:500])
