#!/usr/bin/env python3
"""
sync_foszal.py - FŐSZÁL automatikus generálása

Összegyűjti az összes AI ügynök naplóját és időrendbe rendezi őket.

Használat:
    python ops/scripts/sync_foszal.py
    python ops/scripts/sync_foszal.py --watch  # Folyamatos figyelés

Források:
    - .ai/claude.md
    - .ai/gemini.md
    - .ai/cursor.md
    - .ai/copilot.md

Kimenet:
    - .ai/FOSZAL.md
"""

import re
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional
from dataclasses import dataclass
import argparse
import time

# Windows konzol UTF-8 támogatás
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

# Konfiguráció
PROJECT_ROOT = Path(__file__).resolve().parents[2]
AI_DIR = PROJECT_ROOT / ".ai"
FOSZAL_PATH = AI_DIR / "FOSZAL.md"

AGENT_FILES = {
    "Claude": AI_DIR / "claude.md",
    "Gemini": AI_DIR / "gemini.md",
    "Cursor": AI_DIR / "cursor.md",
    "Copilot": AI_DIR / "copilot.md",
}


@dataclass
class LogEntry:
    """Egy napló bejegyzés"""
    date: str
    time: str
    agent: str
    title: str
    content: str
    status: str
    files: List[str]

    @property
    def datetime_key(self) -> str:
        """Rendezéshez használt kulcs"""
        return f"{self.date} {self.time}"


def parse_agent_log(agent_name: str, file_path: Path) -> List[LogEntry]:
    """
    Egy agent napló fájl feldolgozása.
    Keresi a ### YYYY-MM-DD formátumú bejegyzéseket.
    """
    entries = []

    if not file_path.exists():
        return entries

    content = file_path.read_text(encoding="utf-8", errors="replace")

    # Regex a bejegyzések keresésére
    # Formátum: ### YYYY-MM-DD HH:MM - Cím  VAGY  ### YYYY-MM-DD - Cím
    pattern = r"###\s+(\d{4}-\d{2}-\d{2})(?:\s+(\d{2}:\d{2}))?\s*-\s*(.+?)(?=\n###|\n---|\Z)"

    matches = re.finditer(pattern, content, re.DOTALL)

    for match in matches:
        date = match.group(1)
        time_str = match.group(2) or "00:00"
        title = match.group(3).strip().split("\n")[0]  # Csak az első sor
        full_content = match.group(3).strip()

        # Státusz keresése
        status = "⏳ Folyamatban"
        if "✅" in full_content:
            status = "✅ Befejezve"
        elif "❌" in full_content:
            status = "❌ Sikertelen"
        elif "⏳" in full_content or "folyamatban" in full_content.lower():
            status = "⏳ Folyamatban"

        # Érintett fájlok keresése
        files = []
        file_section = re.search(r"\*\*Érintett fájlok?:\*\*\s*([\s\S]*?)(?=\n\*\*|\n###|\n---|\Z)", full_content)
        if file_section:
            file_lines = file_section.group(1).strip().split("\n")
            for line in file_lines:
                line = line.strip().lstrip("-").strip()
                if line and not line.startswith("**"):
                    files.append(line)

        entry = LogEntry(
            date=date,
            time=time_str,
            agent=agent_name,
            title=title,
            content=full_content,
            status=status,
            files=files
        )
        entries.append(entry)

    return entries


def collect_all_entries() -> List[LogEntry]:
    """Összes agent naplójának összegyűjtése"""
    all_entries = []

    for agent_name, file_path in AGENT_FILES.items():
        entries = parse_agent_log(agent_name, file_path)
        all_entries.extend(entries)

    # Rendezés dátum szerint (legfrissebb elől)
    all_entries.sort(key=lambda e: e.datetime_key, reverse=True)

    return all_entries


def get_agent_stats() -> Dict[str, Dict]:
    """Agent statisztikák"""
    stats = {}

    for agent_name, file_path in AGENT_FILES.items():
        entries = parse_agent_log(agent_name, file_path)
        last_activity = entries[0].date if entries else "N/A"
        stats[agent_name] = {
            "count": len(entries),
            "last_activity": last_activity
        }

    return stats


def generate_foszal() -> str:
    """FŐSZÁL markdown generálása"""
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    entries = collect_all_entries()
    stats = get_agent_stats()

    # Csoportosítás dátum szerint
    entries_by_date: Dict[str, List[LogEntry]] = {}
    for entry in entries:
        if entry.date not in entries_by_date:
            entries_by_date[entry.date] = []
        entries_by_date[entry.date].append(entry)

    # Markdown generálás
    md = f"""# FŐSZÁL - Egyesített Fejlesztési Napló

**Generálva:** {now}
**Script:** `ops/scripts/sync_foszal.py`

---

## Mi ez a fájl?

Ez a fájl **automatikusan generálódik** az `ops/scripts/sync_foszal.py` script által.
Összegyűjti az összes AI ügynök naplóját (claude.md, gemini.md, cursor.md, copilot.md) és időrendbe rendezi őket.

**NE SZERKESZD KÉZZEL!** - A következő szinkron felülírja.

---

## Parancsok

```bash
# FOSZAL frissítése
python ops/scripts/sync_foszal.py

# Teljes rendszer indítás (automatikusan frissíti)
start-full.bat
```

---

## Összesített Napló (Időrendben)

"""

    # Bejegyzések dátum szerint
    for date in sorted(entries_by_date.keys(), reverse=True):
        md += f"### {date}\n\n"

        for entry in entries_by_date[date]:
            md += f"#### {entry.time} - [{entry.agent}] {entry.title}\n"
            md += f"- **Agent:** {entry.agent}\n"
            md += f"- **Státusz:** {entry.status}\n"

            if entry.files:
                md += f"- **Érintett fájlok:** {', '.join(entry.files[:5])}"
                if len(entry.files) > 5:
                    md += f" (+{len(entry.files) - 5} további)"
                md += "\n"

            md += "\n"

        md += "---\n\n"

    # Statisztikák
    md += "## Statisztikák\n\n"
    md += "| Agent | Bejegyzések | Utolsó Aktivitás |\n"
    md += "|-------|-------------|------------------|\n"

    for agent_name, stat in stats.items():
        md += f"| {agent_name} | {stat['count']} | {stat['last_activity']} |\n"

    md += "\n---\n\n"
    md += "*Automatikusan generálva: ops/scripts/sync_foszal.py*\n"

    return md


def sync():
    """FŐSZÁL szinkronizálása"""
    print("=" * 50)
    print("   FŐSZÁL Szinkronizálás")
    print("=" * 50)
    print()

    # Ellenőrzés
    if not AI_DIR.exists():
        print(f"[ERROR] .ai mappa nem létezik: {AI_DIR}")
        return False

    # Források ellenőrzése
    print("[INFO] Források ellenőrzése...")
    for agent_name, file_path in AGENT_FILES.items():
        status = "✅" if file_path.exists() else "❌"
        print(f"  {status} {agent_name}: {file_path.name}")

    print()

    # Generálás
    print("[INFO] FŐSZÁL generálása...")
    content = generate_foszal()

    # Írás
    FOSZAL_PATH.write_text(content, encoding="utf-8")
    print(f"[OK] FŐSZÁL frissítve: {FOSZAL_PATH}")

    # Statisztikák
    entries = collect_all_entries()
    print(f"\n[INFO] Összesen {len(entries)} bejegyzés feldolgozva")

    return True


def watch(interval: int = 30):
    """Folyamatos figyelés és frissítés"""
    print(f"[INFO] Figyelés indítva ({interval} mp intervallum)")
    print("[INFO] Ctrl+C a leállításhoz")

    try:
        while True:
            sync()
            print(f"\n[INFO] Következő frissítés {interval} mp múlva...")
            time.sleep(interval)
    except KeyboardInterrupt:
        print("\n[INFO] Figyelés leállítva")


def main():
    parser = argparse.ArgumentParser(description="FŐSZÁL szinkronizálás")
    parser.add_argument("--watch", action="store_true", help="Folyamatos figyelés")
    parser.add_argument("--interval", type=int, default=30, help="Figyelés intervallum (mp)")

    args = parser.parse_args()

    if args.watch:
        watch(args.interval)
    else:
        sync()


if __name__ == "__main__":
    main()
