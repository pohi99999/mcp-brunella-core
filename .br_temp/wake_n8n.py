import requests, time

N8N_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkZTMzZTc2ZC03YmJmLTRkZTgtOTg2Ny1kNDY0NmE0M2VmZjQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzczNDE0MjM5LCJleHAiOjE3NzU5NDQ4MDB9.LuupmMbXzlYae0Etj1QS5AD0bwQoIcP-CtBWq4KzCes'
N8N_BASE = 'https://iszapfalo.app.n8n.cloud/api/v1'
headers = {'X-N8N-API-KEY': N8N_KEY}

print('Waking up n8n instance...')
try:
    r = requests.get('https://iszapfalo.app.n8n.cloud', timeout=60)
    print(f'Wake-up status: {r.status_code}')
except Exception as e:
    print(f'Wake-up error: {e}')

print('Waiting 15s for instance to start...')
time.sleep(15)

print('Checking API...')
try:
    r2 = requests.get(f'{N8N_BASE}/workflows', headers=headers, timeout=60)
    print(f'API status: {r2.status_code}')
    if r2.ok:
        data = r2.json()
        wfs = data.get('data', [])
        print(f'Workflows found: {len(wfs)}')
        for w in wfs:
            wid = w.get('id', '')
            wname = w.get('name', '')
            wactive = w.get('active', False)
            print(f'  {wid} | {wname} | active={wactive}')
    else:
        print(r2.text[:400])
except Exception as e:
    print(f'Error: {e}')
