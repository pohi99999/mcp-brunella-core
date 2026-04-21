import os
import sqlite3
import logging
from datetime import datetime
from typing import List, Optional

logger = logging.getLogger(__name__)

class ActionMemory:
    """SQLite alapu memoria a sikeres bongeszo akciokhoz"""

    def __init__(self, db_path: str = "data/comet_memory.db"):
        self.db_path = db_path
        # Biztositjuk a data mappa letezest
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        self._init_db()

    def _init_db(self):
        """Adatbazis es tablak inicializalasa"""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS site_actions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    domain TEXT,
                    action_description TEXT,
                    working_selector TEXT,
                    success_count INTEGER DEFAULT 1,
                    last_used TIMESTAMP,
                    UNIQUE(domain, action_description, working_selector)
                )
            """)
            conn.commit()

    async def get_hints(self, domain: str, action_desc: str) -> List[str]:
        """Visszaadja a korabban mukodo selectorokat tippkent"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute(
                    "SELECT working_selector, success_count FROM site_actions "
                    "WHERE domain = ? AND action_description LIKE ? "
                    "ORDER BY success_count DESC LIMIT 3",
                    (domain, f"%{action_desc}%")
                )
                hints = [f"Selector '{row[0]}' (mar {row[1]}x mukodott)" for row in cursor.fetchall()]
                return hints
        except Exception as e:
            logger.error(f"[ActionMemory] Hiba a tippek lekeresekor: {e}")
            return []

    async def record_success(self, domain: str, action_desc: str, selector: str):
        """Sikeres akcio mentese vagy frissitese"""
        if not selector: return
        
        try:
            now = datetime.now().isoformat()
            with sqlite3.connect(self.db_path) as conn:
                conn.execute("""
                    INSERT INTO site_actions (domain, action_description, working_selector, last_used)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT(domain, action_description, working_selector) DO UPDATE SET
                        success_count = success_count + 1,
                        last_used = excluded.last_used
                """, (domain, action_desc, selector, now))
                conn.commit()
        except Exception as e:
            logger.error(f"[ActionMemory] Hiba a menteskor: {e}")

    async def clear_old(self, days: int = 30):
        """Regi, nem hasznalt bejegyzesek torlese"""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("DELETE FROM site_actions WHERE last_used < date('now', ?)", (f'-{days} days',))
            conn.commit()
