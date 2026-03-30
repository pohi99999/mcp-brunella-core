import sqlite3
conn = sqlite3.connect(r'C:\Users\pohi9\.n8n\database.sqlite')
cur = conn.cursor()
cur.execute("SELECT key, value FROM settings")
for row in cur.fetchall():
    print(f"{row[0]}: {row[1][:100] if row[1] else None}")
conn.close()
