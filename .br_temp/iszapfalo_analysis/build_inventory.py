import os, json
from collections import Counter, defaultdict

DIRS = [
    r"C:\Users\pohi9\OneDrive\Desktop\Gemini_cli",
    r"C:\Users\pohi9\OneDrive\Desktop\Iszapfaló_Projekt_FO",
]
OUTDIR = r"F:\mcp-brunella-core\_br_temp\iszapfalo_analysis"
os.makedirs(OUTDIR, exist_ok=True)

summary = {}
for d in DIRS:
    files = []
    ext_counter = Counter()
    for root, _, fnames in os.walk(d):
        for fn in fnames:
            p = os.path.join(root, fn)
            try:
                size = os.path.getsize(p)
            except OSError:
                size = -1
            rel = os.path.relpath(p, d)
            ext = os.path.splitext(fn)[1].lower() or "<noext>"
            ext_counter[ext] += 1
            files.append({"relativePath": rel, "size": size, "ext": ext})

    files.sort(key=lambda x: x["relativePath"].lower())
    base = os.path.basename(d)
    summary[base] = {
        "root": d,
        "fileCount": len(files),
        "extensions": dict(ext_counter.most_common()),
        "files": files,
    }

with open(os.path.join(OUTDIR, "inventory.json"), "w", encoding="utf-8") as f:
    json.dump(summary, f, ensure_ascii=False, indent=2)

with open(os.path.join(OUTDIR, "inventory.md"), "w", encoding="utf-8") as f:
    f.write("# Inventory\n\n")
    for name, data in summary.items():
        f.write(f"## {name}\n")
        f.write(f"- Root: `{data['root']}`\n")
        f.write(f"- File count: **{data['fileCount']}**\n")
        f.write("- Extensions:\n")
        for ext, cnt in data['extensions'].items():
            f.write(f"  - `{ext}`: {cnt}\n")
        f.write("\n### Files\n")
        for fi in data['files']:
            f.write(f"- `{fi['relativePath']}` ({fi['size']} B)\n")
        f.write("\n")

print("inventory generated:", os.path.join(OUTDIR, "inventory.json"))
print("inventory markdown:", os.path.join(OUTDIR, "inventory.md"))
