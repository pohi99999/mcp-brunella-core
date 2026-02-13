#!/usr/bin/env python3
"""
sync_conductor.py - Conductor Dokumentáció Szinkronizáló

Ez a script a .ai/FOSZAL.md tartalmát dolgozza fel, és frissíti
a conductor/tracks.md fájlt, valamint az érintett track-ek plan.md fájljait.

Működés:
1. Beolvassa a .ai/FOSZAL.md legfrissebb bejegyzéseit.
2. Keresi a "**Track:** `track_id`" mintákat.
3. Minden talált track esetén:
   - Frissíti a conductor/tracks.md-ben a dátumot és eredményeket.
   - Hozzáadja a naplóbejegyzést a conductor/tracks/<id>/plan.md-hez.
"""

import re
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

# UTF-8 encoding for Windows console
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

PROJECT_ROOT = Path(__file__).parent.parent
FOSZAL_PATH = PROJECT_ROOT / ".ai" / "FOSZAL.md"
TRACKS_INDEX_PATH = PROJECT_ROOT / "conductor" / "tracks.md"
TRACKS_DIR = PROJECT_ROOT / "conductor" / "tracks"

def parse_last_entries(limit=5) -> List[Dict]:
    """Beolvassa a legutóbbi bejegyzéseket a FOSZAL-ból."""
    if not FOSZAL_PATH.exists():
        print(f"[ERROR] Nem található: {FOSZAL_PATH}")
        return []

    content = FOSZAL_PATH.read_text(encoding="utf-8")
    entries = []
    
    # Regex a bejegyzések és Track ID-k keresésére
    # ### YYYY-MM-DD HH:MM - Cím
    entry_pattern = r"### (\d{4}-\d{2}-\d{2} \d{2}:\d{2}) - (.*?)\n(.*?)(?=### \d{4}-|\Z)"
    matches = list(re.finditer(entry_pattern, content, re.DOTALL))
    
    # Csak a legfrissebbeket nézzük
    for match in matches[:limit]:
        timestamp = match.group(1)
        title = match.group(2)
        body = match.group(3)
        
        # Track ID keresése
        track_match = re.search(r"\*\*Track:\*\*\s*`?([a-zA-Z0-9_]+)`?", body)
        
        if track_match:
            track_id = track_match.group(1).strip()
            
            # Státusz, Eredmények kinyerése
            results_match = re.search(r"\*\*Eredmények:\*\*(.*?)(?=\*\*|$)", body, re.DOTALL)
            results = results_match.group(1).strip() if results_match else ""
            
            entries.append({
                "timestamp": timestamp,
                "title": title,
                "track_id": track_id,
                "body": body,
                "results": results
            })
            
    return entries

def update_plan_file(entry: Dict) -> bool:
    """Frissíti egy adott track plan.md fájlját."""
    plan_path = TRACKS_DIR / entry['track_id'] / "plan.md"
    
    if not plan_path.exists():
        print(f"[WARN] Track nem található: {entry['track_id']} (path: {plan_path})")
        return False
        
    content = plan_path.read_text(encoding="utf-8")
    
    # Ellenőrizzük, hogy ez a bejegyzés szerepel-e már
    date_str = entry['timestamp'].split(' ')[0] # YYYY-MM-DD
    log_header = f"### {date_str}"
    
    entry_summary = f"- **{entry['timestamp'].split(' ')[1]}**: {entry['title']}"
    if entry['title'] in content:
         # Már benne van, skip
         return False

    # Napló szekció keresése
    if "## 📝 Napló" in content:
        # Ha van már ilyen dátum blokk
        if log_header in content:
             # Beszúrjuk alá
             pattern = re.escape(log_header)
             replacement = f"{log_header}\n{entry_summary}"
             new_content = re.sub(pattern, replacement, content, count=1)
        else:
             # Új dátum blokk a Napló szekció alá
             pattern = r"(## 📝 Napló)"
             replacement = f"\\1\n\n{log_header}\n{entry_summary}"
             new_content = re.sub(pattern, replacement, content, count=1)
    else:
        # Nincs napló szekció, hozzáadjuk a végére
        new_content = content + f"\n\n## 📝 Napló\n\n{log_header}\n{entry_summary}\n"

    plan_path.write_text(new_content, encoding="utf-8")
    print(f"[OK] Plan frissítve: {entry['track_id']}")
    return True

def update_tracks_index(entries: List[Dict]) -> bool:
    """Frissíti a conductor/tracks.md fájlt."""
    if not TRACKS_INDEX_PATH.exists():
        return False
        
    content = TRACKS_INDEX_PATH.read_text(encoding="utf-8")
    updated = False
    
    for entry in entries:
        track_id = entry['track_id']
        # Keresés a tracks.md-ben: ID: `track_id` vagy ID: track_id
        # Ezután jön az Utolsó aktivitás sor
        
        # Regex: Find the block for this track
        # - [ ] **Name** ... ID: `track_id` ... Utolsó aktivitás: YYYY-MM-DD
        
        # Egyszerűbb megközelítés: Keressük meg a sort és cseréljük
        # Először megkeressük a blokkot
        track_block_pattern = re.compile(r"(\*\*ID:\*\*\s*`?" + re.escape(track_id) + r"`?[\s\S]*?)(\*\*Utolsó aktivitás:\*\*).*?(\n)", re.MULTILINE)
        
        match = track_block_pattern.search(content)
        if match:
            new_date = entry['timestamp'].split(' ')[0]
            current_activity = match.group(0) # A teljes illeszkedés
            
            # Csak akkor cserélünk, ha újabb
            # Itt most egyszerűen overwrite-oljuk a dátumot
            updated_block = track_block_pattern.sub(f"\\1\\2 {new_date}\\3", content)
            
            # Ha volt eredmény, beszúrhatjuk
            if content != updated_block:
                content = updated_block
                updated = True
                print(f"[OK] Index frissítve: {track_id} -> {new_date}")

    if updated:
        TRACKS_INDEX_PATH.write_text(content, encoding="utf-8")
        
    return updated

def main():
    print("="*50)
    print("   CONDUCTOR SYNC (FOSZAL -> TRACKS)")
    print("="*50)
    
    entries = parse_last_entries()
    if not entries:
        print("[INFO] Nincs feldolgozandó bejegyzés.")
        return
        
    print(f"[INFO] {len(entries)} bejegyzés feldolgozása...")
    
    for entry in entries:
        update_plan_file(entry)
        
    update_tracks_index(entries)
    print("\n[SUCCESS] Szinkronizálás kész.")

if __name__ == "__main__":
    main()
