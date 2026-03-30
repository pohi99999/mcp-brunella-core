import sqlite3

conn = sqlite3.connect(r'C:\Users\pohi9\.n8n\database.sqlite')
cur = conn.cursor()

print("=== WORKFLOWS ===")
cur.execute('SELECT id, name, active, createdAt, updatedAt FROM workflow_entity ORDER BY name')
cols = [d[0] for d in cur.description]
rows = cur.fetchall()
print(f"Total workflows: {len(rows)}")
for row in rows:
    d = dict(zip(cols, row))
    print(f"  [{d['active']}] {d['name']} (id={d['id'][:8]}...)")

print("\n=== BRUNELLA WORKFLOWS ===")
cur.execute("SELECT id, name, active FROM workflow_entity WHERE name LIKE '%Brunella%' ORDER BY name")
for row in cur.fetchall():
    print(f"  active={row[2]}, name={row[1]}, id={row[0][:8]}...")

print("\n=== N8N CONFIG ===")
try:
    with open(r'C:\Users\pohi9\.n8n\config', 'r') as f:
        print(f.read())
except Exception as e:
    print(f"Config read error: {e}")

conn.close()
