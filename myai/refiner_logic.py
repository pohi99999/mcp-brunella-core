import re
import json
import logging
import os
from datetime import datetime
import asyncio
from typing import Optional

# Optional LanceDB support
try:
    import lancedb
    import pyarrow as pa
    HAS_LANCEDB = True
except ImportError:
    lancedb = None
    pa = None
    HAS_LANCEDB = False

try:
    from myai.chromadb_adapter import ChromaDbAdapter
except Exception:  # pragma: no cover - optional dependency
    ChromaDbAdapter = None

# Addded: Incubator (Fine-tuning) support
try:
    from myai.utils.dataset_manager import save_gold_sample
    HAS_INCUBATOR = True
except ImportError:
    save_gold_sample = None
    HAS_INCUBATOR = False

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
        self.lancedb_path = os.path.join(PROJECT_ROOT, 'data', 'brunella_lancedb_python') # Hozzáadva
        self.embedding_model = None # Placeholder a jövőbeli embedding modellhez # Hozzáadva
        self.vector_db: Optional[object] = None
        if ChromaDbAdapter:
            try:
                self.vector_db = ChromaDbAdapter()
            except Exception:
                self.vector_db = None

    def _generate_embedding(self, text: str) -> list[float]: # Hozzáadva
        # Itt történne az embedding generálás, pl. a get_registry() használatával
        # Mivel nincs konkrét modell megadva, egy placeholder 1536 dimenziós nullvektort adunk vissza
        return [0.0] * 1536 # Hozzáadva

    async def save_to_lancedb(self, data: dict):
        if not HAS_LANCEDB:
            logging.info(json.dumps({"status": "LANCEDB_SKIP", "reason": "lancedb not installed"}))
            return
        try:
            # Győződjünk meg róla, hogy a lancedb_path könyvtár létezik
            os.makedirs(self.lancedb_path, exist_ok=True)

            db = await lancedb.connect_async(self.lancedb_path)
            table_names = await db.table_names()
            
            table = None
            if "memory" in table_names:
                table = await db.open_table("memory")
            else:
                # LanceDB séma definiálása az embedding vektorral együtt
                schema = pa.schema([
                    pa.Field("vector", pa.list_(pa.float32(), 1536)), # 1536 dimenziós vektor
                    pa.Field("text", pa.string()),
                    pa.Field("metadata", pa.string()) # metadata JSON stringként
                ])
                table = await db.create_table("memory", schema=schema)
            
            # Embedding generálás
            embedding = self._generate_embedding(data["clean_content"])

            # Adatok előkészítése a beszúráshoz
            # A LanceDB add metódusa Dictionary-ket vár, nem PyArrow táblát közvetlenül,
            # ha a séma már definiálva van a create_table során.
            record = {
                "vector": embedding,
                "text": data["clean_content"],
                "metadata": json.dumps(data["metadata"])
            }
            
            await table.add([record]) # [record] mert listát vár
            logging.info(json.dumps({"status": "LANCEDB_SAVE_SUCCESS", "doc_len": len(data["clean_content"])}))
        except Exception as e:
            logging.error(json.dumps({"status": "LANCEDB_SAVE_ERROR", "error": str(e)}))

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

    async def process_data(self, input_payload): # Aszinkronná téve
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
            
            # 4. Mentés LanceDB-be (Hozzáadva)
            await self.save_to_lancedb(structured_data) # Hozzáadva

            # 4b. Mentés az "Arany Adatkészletbe" tréning céljára (Incubator Pipeline)
            if HAS_INCUBATOR and save_gold_sample:
                try:
                    save_gold_sample(
                        system_prompt="You are a Brunella Data Refiner. Extract structured JSON from HTML.",
                        user_input=raw_data,
                        assistant_output=structured_data["clean_content"],
                        metadata={"source": "harvester_swarm", **structured_data["metadata"]}
                    )
                    logging.info(json.dumps({"status": "GOLDEN_DATASET_SAVED", "source": "harvester_swarm"}))
                except Exception as e:
                    logging.error(json.dumps({"status": "GOLDEN_DATASET_ERROR", "error": str(e)}))

            # 5. Mentés ChromaDB-be (ha elérhető)
            if self.vector_db:
                try:
                    await self.vector_db.add_document(
                        structured_data["clean_content"],
                        {"source": structured_data.get("source"), **structured_data["metadata"]}
                    )
                except Exception as e:
                    logging.error(json.dumps({"status": "CHROMADB_SAVE_ERROR", "error": str(e)}))
            
            return structured_data

        except Exception as e:
            logging.error(json.dumps({"status": "ERROR", "error": str(e)}))
            return None

# Instantiation for external use
refiner = DataRefiner()