"""Extract decrypted n8n-auth cookie from Chrome profile."""
import browser_cookie3
import json
import os

# Method 1: Use browser_cookie3 with the specific profile
try:
    # Try with default Chrome profile
    cookies = browser_cookie3.chrome(
        cookie_file=r'C:\Users\pohi9\.cache\chrome-devtools-mcp\chrome-profile\Default\Network\Cookies',
        domain_name='iszapfalo.app.n8n.cloud'
    )
    
    found = []
    for cookie in cookies:
        if 'n8n' in cookie.domain.lower() or 'n8n' in cookie.name.lower():
            found.append({
                'name': cookie.name,
                'value': cookie.value,
                'domain': cookie.domain,
                'path': cookie.path,
                'expires': cookie.expires,
                'secure': cookie.secure,
            })
            print(f"COOKIE: {cookie.name} = {cookie.value[:80]}...")
    
    if found:
        # Save to JSON for Playwright to use
        with open('tasks/n8n_cookies.json', 'w') as f:
            json.dump(found, f, indent=2)
        print(f"\n✅ Found {len(found)} n8n cookies, saved to tasks/n8n_cookies.json")
    else:
        print("No n8n cookies found with domain filter")
        
        # Try without domain filter
        all_cookies = list(browser_cookie3.chrome(
            cookie_file=r'C:\Users\pohi9\.cache\chrome-devtools-mcp\chrome-profile\Default\Network\Cookies'
        ))
        print(f"Total cookies: {len(all_cookies)}")
        n8n_cookies = [c for c in all_cookies if 'n8n' in (c.domain or '').lower()]
        print(f"n8n related cookies: {[c.name + '/' + c.domain for c in n8n_cookies]}")

except Exception as e:
    print(f"Error with browser_cookie3: {e}")
    
    # Fallback: Try using Rookiepy or direct DPAPI
    import subprocess
    result = subprocess.run(
        ['python', '-c', '''
import ctypes
import sqlite3
import json
import base64
import win32crypt
from Crypto.Cipher import AES

def get_chrome_encryption_key(user_data_dir):
    local_state_path = user_data_dir + r"\\Local State"
    with open(local_state_path, "r") as f:
        local_state = json.load(f)
    key = base64.b64decode(local_state["os_crypt"]["encrypted_key"])
    key = key[5:]  # Remove DPAPI prefix
    key = win32crypt.CryptUnprotectData(key, None, None, None, 0)[1]
    return key

user_data_dir = r"C:\\Users\\pohi9\\.cache\\chrome-devtools-mcp\\chrome-profile"
key = get_chrome_encryption_key(user_data_dir)
print("Got encryption key:", key.hex()[:32])
'''],
        capture_output=True, text=True
    )
    print("DPAPI attempt:", result.stdout, result.stderr)
