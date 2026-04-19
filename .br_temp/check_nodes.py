"""Workflow node-ok vizsgálata"""
import json

FILES = [
    ("geppark.json", "GEPPARK"),
    ("okos_ajanlo.json", "OKOS_AJANLO"),
    ("error_mon.json", "ERROR_MON"),
]

for fname, label in FILES:
    try:
        with open("F:/mcp-brunella-core/_br_temp/" + fname, encoding="utf-8") as f:
            d = json.load(f)
        inner = d.get("data", d)
        name = inner.get("name", "?")
        print("\n=== " + label + ": " + name + " ===")
        for n in inner.get("nodes", []):
            ntype = n.get("type", "?").split(".")[-1]
            nname = n.get("name", "?")
            creds = [v.get("name", "?") for v in n.get("credentials", {}).values()]
            credstr = ", ".join(creds) if creds else "-"
            print("  [" + ntype + "] " + nname + " | cred: " + credstr)
    except Exception as e:
        print("Hiba " + fname + ": " + str(e))
