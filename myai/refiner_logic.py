import re
import json
import logging
import os
from datetime import datetime

# BAS Strukturált Logging inicializálása
# Abszolút út meghatározása a projekt gyökeréhez képest
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOG_DIR = os.path.join(PROJECT_ROOT, 'logs')
LOG_FILE = os.path.join(LOG_DIR, 'data_refiner.log')

if not os.path.exists(LOG_DIR):
    os.makedirs(LOG_DIR, exist_ok=True)

logging.basicConfig(
    filename=LOG_FILE,
    level=logging.INFO,
    format='{"time": "%(asctime)s", "level": "%(levelname)s", "message": %(message)s}'
)

class DataRefiner:
    """A BAS Adattudós Ügynök belső zajszűrő motorja."""
    
    def __init__(self, context_db=None):
        self.context_db = context_db
        # Releváns kulcsszavak a Pohi AI Pro és BAS számára
        self.priority_topics = [
            "fuvarszervezés", "mcp", "logisztika", "ai-agent", 
            "adatbázis", "ai agents", "automation", "browser", "llm"
        ]
        # Tiltott minták (reklámok, navigációs elemek)
        self.junk_patterns = [
            r"REGISTER NOW", r"Tickets are live", r"IMAGE CREDITS", 
            r"Volume 90%", r"0 seconds of \d+ seconds", r"View Bio",
            r"Share on \w+", r"Most Popular", r"Loading the next article"
        ]

    def remove_noise(self, raw_text):
        """1. Fázis: Strukturális zajmentesítés (HTML, reklám, felesleg)"""
        # HTML tag-ek eltávolítása
        clean = re.sub('<.*?>', '', raw_text)
        
        # Ismert szemét minták eltávolítása
        for pattern in self.junk_patterns:
            clean = re.sub(pattern, '', clean, flags=re.IGNORECASE)

        # Felesleges whitespace-ek és URL-ek tisztítása
        clean = re.sub(r'http\S+', '', clean)
        clean = " ".join(clean.split())
        return clean

    def semantic_check(self, text):
        """2. Fázis: Szemantikai szűrés (Relevancia ellenőrzés)"""
        text_lower = text.lower()
        score = sum(1 for word in self.priority_topics if word in text_lower)
        # POC: Ha bármilyen releváns szót talál, vagy elég hosszú a szöveg
        return score > 0 or len(text) > 1000

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
            logging.info(json.dumps({"status": "PROCESSING", "raw_len": len(raw_data)}))
            
            # 1. Tisztítás
            clean_text = self.remove_noise(raw_data)
            logging.info(json.dumps({"status": "CLEANED", "clean_len": len(clean_text)}))
            
            # 2. Relevancia vizsgálat
            if not self.semantic_check(clean_text):
                logging.info(json.dumps({"status": "DROPPED", "reason": "Low relevance", "clean_len": len(clean_text)}))
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
