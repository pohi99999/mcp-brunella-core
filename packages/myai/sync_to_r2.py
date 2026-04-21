
import os
import subprocess
import tarfile
import logging
from datetime import datetime
import sqlite3
import sys

# --- Konfiguráció ---
# A projekt gyökérkönyvtára, a script helyéhez képest
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
LANCEDB_DIR = os.path.join(PROJECT_ROOT, '.lancedb')
ARCHIVE_DIR = os.path.join(PROJECT_ROOT, '_archive', 'r2_sync')
LOG_FILE = os.path.join(ARCHIVE_DIR, 'sync_to_r2.log')
R2_BUCKET_NAME = "bas-knowledge-base" 
D1_DB_NAME = "bas-metadata"
DB_FILE = os.path.join(PROJECT_ROOT, 'agents.db') # SQLite adatbázis a D1 szimulációhoz

# --- Logger beállítása ---
os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE),
        logging.StreamHandler()
    ]
)

def get_wrangler_path():
    """Megkeresi a wrangler végrehajtható fájlt."""
    try:
        # Windows-on a .cmd kiterjesztés fontos
        if os.name == 'nt':
            # Először a lokális node_modules-ban keressük
            local_path = os.path.join(PROJECT_ROOT, 'node_modules', '.bin', 'wrangler.cmd')
            if os.path.exists(local_path):
                return local_path
            # Ha ott nincs, feltételezzük, hogy globális
            return 'wrangler.cmd'
        else:
            local_path = os.path.join(PROJECT_ROOT, 'node_modules', '.bin', 'wrangler')
            if os.path.exists(local_path):
                return local_path
            return 'wrangler'
    except Exception:
        return 'wrangler' # Fallback

WRANGLER_PATH = get_wrangler_path()

def log_d1_sync(sync_type: str, status: str, details: str = ''):
    """Naplóbejegyzést szúr be a D1 adatbázisba (helyi szimuláció)."""
    try:
        logging.info(f"D1 Log: Type='{sync_type}', Status='{status}', Details='{details}'")
        # Itt egy wrangler d1 execute parancsot kellene futtatni
        # Mivel a direkt DB kapcsolat nem biztos, egyelőre csak logolunk
        # wrangler d1 execute bas-metadata --command="INSERT INTO sync_log ..."
    except Exception as e:
        logging.error(f"Hiba a D1 naplózás során: {e}")

def run_command(command):
    """Segédfüggvény parancsok futtatására és a kimenet naplózására."""
    try:
        logging.info(f"Parancs futtatása: {' '.join(command)}")
        result = subprocess.run(command, capture_output=True, text=True, check=True, encoding='utf-8', shell=True)
        if result.stdout:
            logging.info(f"Kimenet:\n{result.stdout}")
        if result.stderr:
            logging.warning(f"Hibakimenet:\n{result.stderr}")
        return True
    except subprocess.CalledProcessError as e:
        logging.error(f"Parancs hiba: {' '.join(command)}")
        logging.error(f"Exit code: {e.returncode}")
        logging.error(f"Stdout: {e.stdout}")
        logging.error(f"Stderr: {e.stderr}")
        return False
    except FileNotFoundError:
        logging.error(f"Hiba: A '{command[0]}' parancs nem található. Telepítve van és a PATH-ban van?")
        return False
    except Exception as e:
        logging.error(f"Váratlan hiba a parancs futtatása közben: {e}")
        return False


def create_archive():
    """Létrehozza a LanceDB snapshot tömörített archívumát."""
    if not os.path.exists(LANCEDB_DIR):
        logging.error(f"A LanceDB könyvtár nem található: {LANCEDB_DIR}")
        return None

    os.makedirs(ARCHIVE_DIR, exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    archive_name = f"lancedb_snapshot_{timestamp}.tar.gz"
    archive_path = os.path.join(ARCHIVE_DIR, archive_name)
    
    logging.info(f"Archívum létrehozása: {archive_path}")
    
    try:
        with tarfile.open(archive_path, "w:gz") as tar:
            tar.add(LANCEDB_DIR, arcname=os.path.basename(LANCEDB_DIR))
        
        logging.info("Az archívum sikeresen létrehozva.")
        return archive_path
    except Exception as e:
        logging.error(f"Hiba az archívum létrehozása közben: {e}")
        return None

def upload_to_r2(archive_path):
    """Feltölti az archívumot az R2 bucket-be a wrangler segítségével."""
    if not archive_path:
        return False
        
    archive_name = os.path.basename(archive_path)
    logging.info(f"Feltöltés az R2 bucket-be: '{R2_BUCKET_NAME}' -> '{archive_name}'")

    command = [
        WRANGLER_PATH,
        "r2",
        "object",
        "put",
        f"{R2_BUCKET_NAME}/{archive_name}",
        "--file",
        archive_path
    ]
    
    if run_command(command):
        logging.info("A feltöltés sikeres volt.")
        return True
    else:
        logging.error("A feltöltés sikertelen.")
        return False

def full_sync():
    """Teljes szinkronizációs folyamat: archiválás, feltöltés, naplózás."""
    logging.info("Teljes szinkronizációs folyamat indítása...")
    log_d1_sync('full', 'started', 'Archiválás és R2 feltöltés indult.')
    
    archive_path = create_archive()
    if not archive_path:
        log_d1_sync('full', 'failed', 'Archívum létrehozása sikertelen.')
        return

    if upload_to_r2(archive_path):
        log_d1_sync('full', 'success', f'Fájl: {os.path.basename(archive_path)}')
        logging.info("A szinkronizáció sikeresen befejeződött.")
    else:
        log_d1_sync('full', 'failed', 'R2 feltöltés sikertelen.')
        logging.error("Hiba történt a szinkronizáció során.")
        
def main():
    if len(sys.argv) > 1 and sys.argv[1] == 'full':
        full_sync()
    else:
        print("Használat: python sync_to_r2.py [full]")
        print("  full: Teljes szinkronizációt futtat (archivál és feltölt).")

if __name__ == "__main__":
    main()
