import sqlite3, shutil, os, json, base64, win32crypt
from Crypto.Cipher import AES

user_data_dir = r'C:\Users\pohi9\.cache\chrome-devtools-mcp\chrome-profile'
local_state_path = os.path.join(user_data_dir, 'Local State')
with open(local_state_path, 'r', encoding='utf-8') as f:
    ls = json.load(f)

enc_key_b64 = ls['os_crypt']['encrypted_key']
enc_key = base64.b64decode(enc_key_b64)[5:]  # strip DPAPI prefix
key = win32crypt.CryptUnprotectData(enc_key, None, None, None, 0)[1]
print('Key length:', len(key), 'hex prefix:', key.hex()[:20])

# read cookie
temp = r'C:\Users\pohi9\AppData\Local\Temp\n8ncook.db'
shutil.copy2(os.path.join(user_data_dir, 'Default', 'Network', 'Cookies'), temp)
conn = sqlite3.connect(f'file:{temp}?mode=ro&immutable=1', uri=True)
query = "SELECT encrypted_value FROM cookies WHERE name='n8n-auth'"
row = conn.execute(query).fetchone()
conn.close()
os.remove(temp)

if not row:
    print('Cookie not found!')
    exit(1)

enc = row[0]
print('Encrypted length:', len(enc), 'prefix:', enc[:3])
enc_stripped = enc[3:]  # strip v10
iv = enc_stripped[:12]
payload = enc_stripped[12:]
print('IV:', iv.hex(), 'Payload len:', len(payload))
cipher = AES.new(key, AES.MODE_GCM, nonce=iv)
decrypted = cipher.decrypt(payload[:-16])
print('Decrypted bytes (first 30):', decrypted[:30])
print('Decrypted latin1 (first 100):', decrypted.decode('latin-1')[:100])
try:
    utf8_val = decrypted.decode('utf-8')
    print('Decrypted utf8:', utf8_val[:200])
    # Save as json for Playwright injection
    cookie_data = {
        'name': 'n8n-auth',
        'value': utf8_val,
        'domain': 'iszapfalo.app.n8n.cloud',
        'path': '/',
        'secure': True,
        'httpOnly': True,
        'sameSite': 'None'
    }
    with open('tasks/n8n_auth_cookie.json', 'w') as f:
        json.dump(cookie_data, f, indent=2)
    print('\nSaved to tasks/n8n_auth_cookie.json')
except Exception as e:
    print('Not valid utf-8:', e)
    # Save raw base64
    b64_val = base64.b64encode(decrypted).decode()
    print('Base64 encoded:', b64_val[:100])
