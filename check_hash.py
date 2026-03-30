import sqlite3
conn = sqlite3.connect(r'C:\Users\pohi9\.n8n\database.sqlite')
cur = conn.cursor()
cur.execute("SELECT email, password, updatedAt FROM user WHERE email='peterpohankapersonal@gmail.com'")
row = cur.fetchone()
print('Email:', row[0])
print('Hash:', repr(row[1]))
print('Updated:', row[2])
conn.close()
