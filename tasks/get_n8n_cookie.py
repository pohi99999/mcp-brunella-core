import sqlite3

p = r'C:/Users/pohi9/.cache/chrome-devtools-mcp/chrome-profile/Default/Network/Cookies'
conn = sqlite3.connect('file:' + p + '?mode=ro&immutable=1', uri=True)
cur = conn.cursor()

query = "SELECT host_key, name, value, length(encrypted_value), expires_utc, is_secure, path FROM cookies WHERE host_key LIKE '%n8n%'"
rows = cur.execute(query).fetchall()
for r in rows:
    print(f"HOST: {r[0]}")
    print(f"NAME: {r[1]}")
    print(f"VALUE: {r[2][:100] if r[2] else '(empty, encrypted_len=' + str(r[3]) + ')'}")
    print(f"EXPIRES_UTC: {r[4]}")
    print(f"SECURE: {r[5]}")
    print(f"PATH: {r[6]}")
    print()

conn.close()
