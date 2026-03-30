import sqlite3
conn = sqlite3.connect(r'C:\Users\pohi9\.n8n\database.sqlite')
cursor = conn.cursor()
cursor.execute('SELECT id, name, active, updatedAt FROM workflow_entity ORDER BY name, updatedAt')
wf = cursor.fetchall()
print('All workflows in n8n:')
for w in wf:
    state = 'ACTIVE' if w[2] else 'INACTIVE'
    print(f'  [{w[0]}] "{w[1]}" | state={state} | updated={w[3]}')
conn.close()
