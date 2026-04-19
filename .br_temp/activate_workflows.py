"""Workflow aktiválás 502-es hibák után újrapróbálva"""
import json
import urllib.request
import urllib.error
import time

API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkZTMzZTc2ZC03YmJmLTRkZTgtOTg2Ny1kNDY0NmE0M2VmZjQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzczNDE0MjM5LCJleHAiOjE3NzU5NDQ4MDB9.LuupmMbXzlYae0Etj1QS5AD0bwQoIcP-CtBWq4KzCes"
BASE = "https://iszapfalo.app.n8n.cloud/api/v1"

WORKFLOWS = [
    ("WMAB7hYqJObUwAHN", "Munkaido nyilvantartas"),
    ("SstCWGS6YpkPEfAy", "Geppark Karbantartas"),
    ("fHJIvrbFaY012dNp", "Okos Ajanlo"),
    ("CZSN8FZBoE8GyFuF", "Telegram Hangvezerles"),
    ("9uvNwFH4uZdJZz6O", "Gmail kategorizalo (UJ)"),
    ("k4jOPvARKksQzEu5", "Gmail Airtable ajanlat"),
]

for wid, name in WORKFLOWS:
    time.sleep(3)
    req = urllib.request.Request(
        BASE + "/workflows/" + wid + "/activate",
        data=b"",
        method="POST",
        headers={"X-N8N-API-KEY": API_KEY, "Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req) as r:
            res = json.load(r)
            status = "AKTIV" if res.get("active") else "INAKTIV"
            print("OK  " + status + "  " + name + "  (" + wid + ")")
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print("ERR " + str(e.code) + "  " + name + "  -> " + body[:150])

print("\nKesz!")
