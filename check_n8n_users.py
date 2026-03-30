import sqlite3

conn = sqlite3.connect(r'C:\Users\pohi9\.n8n\database.sqlite')
cur = conn.cursor()
cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = [r[0] for r in cur.fetchall()]
print('Tables:', tables)

for t in tables:
    if 'user' in t.lower() or 'auth' in t.lower() or 'owner' in t.lower():
        print(f'\n=== {t} ===')
        try:
            cur.execute(f'SELECT * FROM "{t}" LIMIT 5')
            cols = [d[0] for d in cur.description]
            print('Columns:', cols)
            for row in cur.fetchall():
                row_d = dict(zip(cols, row))
                if 'password' in str(cols).lower():
                    for k in row_d:
                        if 'password' in k.lower() and row_d[k]:
                            row_d[k] = str(row_d[k])[:20] + '...'
                print(row_d)
        except Exception as e:
            print(f'Error: {e}')

conn.close()
