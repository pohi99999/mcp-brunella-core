#!/usr/bin/env python3
"""
init_lancedb.py - LanceDB inicializálása a BAS projekthez

Létrehozza a szükséges LanceDB adatbázisokat:
- data/brunella_lancedb (Node.js kompatibilis)
- data/brunella_lancedb_python (Python kompatibilis)

Használat:
    python scripts/init_lancedb.py
"""

import os
import sys
import json
import asyncio
from datetime import datetime
from pathlib import Path

# Projekt gyökér meghatározása
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

# LanceDB importálása
try:
    import lancedb
    import pyarrow as pa
except ImportError:
    print("[ERROR] lancedb vagy pyarrow nincs telepítve!")
    print("Telepítés: pip install lancedb pyarrow")
    sys.exit(1)

# Konfigurációk
LANCEDB_PATHS = {
    "nodejs": PROJECT_ROOT / "data" / "brunella_lancedb",
    "python": PROJECT_ROOT / "data" / "brunella_lancedb_python",
}

# Alap séma (1536 dimenziós vektor - OpenAI/Ollama kompatibilis)
MEMORY_SCHEMA = pa.schema([
    pa.field("vector", pa.list_(pa.float32(), 1536)),
    pa.field("text", pa.utf8()),
    pa.field("path", pa.utf8()),
    pa.field("source", pa.utf8()),
    pa.field("created_at", pa.utf8()),
])


async def init_lancedb(name: str, db_path: Path) -> bool:
    """Egy LanceDB adatbázis inicializálása."""
    print(f"\n[INFO] {name} LanceDB inicializálása: {db_path}")

    try:
        # Mappa létrehozása
        db_path.parent.mkdir(parents=True, exist_ok=True)

        # Csatlakozás (létrehozza ha nem létezik)
        db = await lancedb.connect_async(str(db_path))

        # Táblák listázása
        table_list = await db.list_tables()
        # list_tables() returns a paged result with .tables attribute
        table_names = table_list.tables if hasattr(table_list, 'tables') else list(table_list)
        print(f"[INFO] Meglévő táblák: {table_names if table_names else '(üres)'}")

        # Memory tábla létrehozása ha nem létezik
        if "memory" not in table_names:
            print("[INFO] 'memory' tábla létrehozása...")

            # Kezdő rekord (a séma definiálásához kell legalább egy sor)
            initial_data = [{
                "vector": [0.0] * 1536,
                "text": "BAS Memory System initialized",
                "path": "system/init",
                "source": "init_lancedb.py",
                "created_at": datetime.utcnow().isoformat(),
            }]

            table = await db.create_table("memory", initial_data)
            print(f"[OK] 'memory' tábla létrehozva")
        else:
            table = await db.open_table("memory")
            # Rekordok száma
            count = await table.count_rows()
            print(f"[INFO] 'memory' tábla már létezik ({count} rekord)")

        return True

    except Exception as e:
        print(f"[ERROR] {name} inicializálás sikertelen: {e}")
        return False


async def main():
    print("=" * 50)
    print("   BAS LanceDB Initialization")
    print("=" * 50)

    results = {}

    for name, path in LANCEDB_PATHS.items():
        results[name] = await init_lancedb(name, path)

    print("\n" + "=" * 50)
    print("   Összegzés")
    print("=" * 50)

    for name, success in results.items():
        status = "[OK]" if success else "[FAILED]"
        print(f"  {name}: {status} ({LANCEDB_PATHS[name]})")

    # Sync script konfig frissítés tipp
    print("\n[TIP] A sync_to_r2.py-ban frissítsd a LANCEDB_PATH-ot:")
    print(f"      LANCEDB_PATH={LANCEDB_PATHS['nodejs']}")

    return all(results.values())


if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)
