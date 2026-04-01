"""Extract decrypted Chrome cookies using DPAPI on Windows."""
import sqlite3
import json
import base64
import win32crypt
from Crypto.Cipher import AES
import shutil
import os

def get_chrome_encryption_key(user_data_dir):
    """Get Chrome's AES encryption key from Local State."""
    local_state_path = os.path.join(user_data_dir, "Local State")
    with open(local_state_path, "r", encoding='utf-8') as f:
        local_state = json.load(f)
    
    encrypted_key_b64 = local_state["os_crypt"]["encrypted_key"]
    encrypted_key = base64.b64decode(encrypted_key_b64)
    # Remove the DPAPI prefix (first 5 bytes "DPAPI")
    encrypted_key = encrypted_key[5:]
    # Decrypt using Windows DPAPI
    decrypted_key = win32crypt.CryptUnprotectData(encrypted_key, None, None, None, 0)[1]
    return decrypted_key

def decrypt_cookie_value(encrypted_value, key):
    """Decrypt Chrome v80+ AES-256-GCM encrypted cookie."""
    try:
        # Skip first 3 bytes (v10 prefix)
        encrypted_value = encrypted_value[3:]
        # IV is next 12 bytes
        iv = encrypted_value[:12]
        # The rest is the encrypted data + 16 byte auth tag
        payload = encrypted_value[12:]
        
        cipher = AES.new(key, AES.MODE_GCM, nonce=iv)
        decrypted = cipher.decrypt(payload[:-16])
        return decrypted.decode('utf-8')
    except Exception as e:
        return f"ERROR: {e}"

# Use the original profile (Chrome must be closed or use copy)
user_data_dir = r'C:\Users\pohi9\.cache\chrome-devtools-mcp\chrome-profile'
cookie_db_path = os.path.join(user_data_dir, 'Default', 'Network', 'Cookies')

# Get encryption key
try:
    key = get_chrome_encryption_key(user_data_dir)
    print(f"✅ Got encryption key: {key.hex()[:20]}...")
except Exception as e:
    print(f"❌ Failed to get key: {e}")
    exit(1)

# Copy DB to temp (avoid lock issues)
temp_db = r'C:\Users\pohi9\AppData\Local\Temp\cookies_temp.db'
shutil.copy2(cookie_db_path, temp_db)

# Read and decrypt cookies
conn = sqlite3.connect(f'file:{temp_db}?mode=ro&immutable=1', uri=True)
cur = conn.cursor()

query = "SELECT host_key, name, value, encrypted_value, expires_utc, is_secure, path FROM cookies WHERE host_key LIKE '%n8n%'"
rows = cur.execute(query).fetchall()

n8n_cookies = []
for row in rows:
    host, name, plain_value, enc_value, expires, secure, path = row
    
    if plain_value:
        value = plain_value
    elif enc_value:
        if enc_value[:3] == b'v10':
            value = decrypt_cookie_value(enc_value, key)
        else:
            # Try DPAPI directly
            try:
                value = win32crypt.CryptUnprotectData(enc_value, None, None, None, 0)[1].decode('utf-8')
            except:
                value = f"<encrypted {len(enc_value)} bytes>"
    else:
        value = ''
    
    cookie_info = {
        'name': name,
        'value': value,
        'domain': host,
        'path': path,
        'secure': bool(secure),
        'httpOnly': True,
        'sameSite': 'None'
    }
    n8n_cookies.append(cookie_info)
    print(f"  {name}: {value[:60]}...")

conn.close()
os.remove(temp_db)

# Save cookies for Playwright
with open('tasks/n8n_cookies_decrypted.json', 'w') as f:
    json.dump(n8n_cookies, f, indent=2)

print(f"\n✅ Extracted {len(n8n_cookies)} cookies, saved to tasks/n8n_cookies_decrypted.json")
