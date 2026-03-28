import sqlite3
conn=sqlite3.connect(r"data\\tasks.db")
cur=conn.cursor()
for row in cur.execute("SELECT name, type FROM sqlite_master WHERE type IN ('table','view') ORDER BY name;"):
    print(row)
conn.close()
