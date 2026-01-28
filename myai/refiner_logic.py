import re
import json
import logging
from datetime import datetime

# BAS Strukturált Logging inicializálása
# Ensure logs directory exists or handle error, usually logs/ is at root.
# Note: When running from PythonShell, cwd is usually set to project root.
try:
    logging.basicConfig(
        filename='logs/data_refiner.log',
        level=logging.INFO,
        format='{"time": "%(asctime)s", "level": "%(levelname)s", "message": %(message)s}'
    )
except FileNotFoundError:
    # Fallback if logs dir doesn't exist
    import os
    if not os.path.exists('logs'):
        os.makedirs('logs')
    logging.basicConfig(
        filename='logs/data_refiner.log',
        level=logging.INFO,
        format='{"time": "%(asctime)s", "level": "%(levelname)s", "message": %(message)s}'
    )

class DataRefiner:
    """A BAS Adattudós Ügynök belső zajszűrő motorja."""

    def __init__(self, context_db=None):
        self.context_db = context_db
        # Releváns kulcsszavak a Pohi AI Pro és BAS számára
        self.priority_topics = ["fuvarszervezés", "mcp", "logisztika", "ai-agent", "adatbázis"]

    def remove_noise(self, raw_text):
        """1. Fázis: Strukturális zajmentesítés (HTML, reklám, felesleg)"""
        # HTML tag-ek eltávolítása
        clean = re.sub('<.*?>', '', raw_text)
        # Felesleges whitespace-ek és URL-ek tisztítása
        clean = re.sub(r'http\S+', '', clean)
        clean = " ".join(clean.split())
        return clean

    def semantic_check(self, text):
        """2. Fázis: Szemantikai szűrés (Relevancia ellenőrzés)"""
        score = sum(1 for word in self.priority_topics if word in text.lower())
        # Ha nincs benne releváns kulcsszó, 'zajnak' minősítjük
        return score > 0

    def extract_entities(self, text):
        """3. Fázis: Entitás kinyerés a 'kis csibészek' számára"""
        # Példa: Rendszámok, dátumok vagy technikai kifejezések azonosítása
        entities = {
            "timestamps": datetime.now().isoformat(),
            "detected_topics": [w for w in self.priority_topics if w in text.lower()],
            "is_actionable": False
        }
        if len(entities["detected_topics"]) > 0:
            entities["is_actionable"] = True
        return entities

    def process_data(self, input_payload):
        """A teljes tisztítási folyamat futtatása."""
        try:
            raw_data = input_payload.get("content", "")

            # 1. Tisztítás
            clean_text = self.remove_noise(raw_data)

            # 2. Relevancia vizsgálat
            if not self.semantic_check(clean_text):
                logging.info(json.dumps({"status": "DROPPED", "reason": "Low relevance"}))
                return None

            # 3. Strukturálás
            structured_data = {
                "clean_content": clean_text,
                "metadata": self.extract_entities(clean_text),
                "source": input_payload.get("source", "unknown")
            }

            logging.info(json.dumps({"status": "SUCCESS", "topic": structured_data["metadata"]["detected_topics"]}))
            return structured_data

        except Exception as e:
            logging.error(json.dumps({"status": "ERROR", "error": str(e)}))
            return None

# Instantiation for external use
refiner = DataRefiner()
