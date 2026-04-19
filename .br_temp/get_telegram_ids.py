import requests, json

AIRTABLE_KEY = 'patOVCOi3JeisHwOW.cd711ffb54eb7fd4a846f1ae591775487670a6323f299d2f088af386b2b5af6d'
BASE_ID = 'appU3xQMuAmpmmCEy'
headers = {'Authorization': f'Bearer {AIRTABLE_KEY}'}

# Get Munkatársak with Telegram Chat ID
print('=== Munkatársak (Telegram Chat IDs) ===')
r = requests.get(
    f'https://api.airtable.com/v0/{BASE_ID}/tblu9E94nW9llCUD8',
    headers=headers,
    params={
        'fields[]': ['Név', 'Beosztás', 'Telegram Chat ID', 'Aktív státusz'],
        'filterByFormula': '{Aktív státusz}'
    }
)
if r.ok:
    for rec in r.json().get('records', []):
        f = rec.get('fields', {})
        print(f'  ID: {rec["id"]} | {f.get("Név","?")} | {f.get("Beosztás","?")} | TG: {f.get("Telegram Chat ID","N/A")} | Aktív: {f.get("Aktív státusz",False)}')
else:
    print(r.status_code, r.text[:400])

# Get active processes count
print('\n=== Aktív Folyamatok ===')
r2 = requests.get(
    f'https://api.airtable.com/v0/{BASE_ID}/tblvF6O9evfV0bPfX',
    headers=headers,
    params={
        'fields[]': ['Folyamat neve', 'Státusz', 'Határidő', 'Fő felelős'],
        'filterByFormula': 'NOT({Státusz} = "Befejezve")',
        'maxRecords': 10
    }
)
if r2.ok:
    for rec in r2.json().get('records', []):
        f = rec.get('fields', {})
        print(f'  {f.get("Folyamat neve","?")} | {f.get("Státusz","?")} | Határidő: {f.get("Határidő","N/A")}')
else:
    print(r2.status_code, r2.text[:400])

# Check Heti Emlékeztető for Telegram Chat ID
print('\n=== Heti Emlékeztető JSON (Telegram target) ===')
import glob, os
for path in glob.glob(r'F:\mcp-brunella-core\docs\**\*Emlékeztető*', recursive=True):
    print(f'Found: {path}')
    with open(path, encoding='utf-8') as f2:
        wf = json.load(f2)
    for node in wf.get('nodes', []):
        ntype = node.get('type', '')
        params = node.get('parameters', {})
        if 'telegram' in ntype.lower() and 'trigger' not in ntype.lower():
            print(f'  Telegram Send node: {node["name"]}')
            print(f'  chatId: {params.get("chatId", "?")}')
            print(f'  Full params: {json.dumps(params, ensure_ascii=False)[:300]}')
