import sqlite3

# Path to the SQLite database file
p = r'C:/Users/pohi9/.cache/chrome-devtools-mcp/chrome-profile/Default/Network/Cookies'

# Connect to the database
conn = sqlite3.connect(f'file:{p}?mode=ro&immutable=1', uri=True)
cur = conn.cursor()

# Execute the query
query = "SELECT host_key, name FROM cookies WHERE host_key LIKE '%n8n.cloud%' ORDER BY host_key, name"
rows = cur.execute(query).fetchall()

# Print the results
for row in rows:
    print(row)

# Close the connection
conn.close()