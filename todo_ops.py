import sqlite3
from datetime import datetime
import sys

db = r"data\\brunella.db"
conn = sqlite3.connect(db)
cur = conn.cursor()

print("--TODOS--")
for row in cur.execute("SELECT * FROM todos;"):
    print(row)

print("--TODO_DEPS--")
for row in cur.execute("SELECT * FROM todo_deps;"):
    print(row)

print("--READY--")
for row in cur.execute("SELECT * FROM todos WHERE status = 'pending' AND id NOT IN (SELECT todo_id FROM todo_deps td JOIN todos t ON td.depends_on = t.id WHERE t.status != 'done');"):
    print(row)

# Ensure todo_log exists
cur.execute('''CREATE TABLE IF NOT EXISTS todo_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    todo_id TEXT,
    action TEXT,
    message TEXT,
    created_at TEXT
)''')
conn.commit()

# Insert a log for smoke if not already present for today
cur.execute("SELECT COUNT(1) FROM todo_log WHERE todo_id = ? AND action = ?", ('smoke','done'))
count = cur.fetchone()[0]
if count == 0:
    cur.execute("INSERT INTO todo_log (todo_id, action, message, created_at) VALUES (?,?,?,?)",
                ('smoke','done','Smoke agent reported success and set status to done', datetime.utcnow().isoformat()))
    conn.commit()
    print("--INSERTED_LOG--")
else:
    print("--LOG_EXISTS--")

print("--TODO_LOG--")
for row in cur.execute("SELECT * FROM todo_log;"):
    print(row)

conn.close()
