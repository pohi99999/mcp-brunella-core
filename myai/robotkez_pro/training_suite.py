import time
import requests
import random
import datetime

# A te helyi szervereid
API_URL = "http://localhost:8090"
N8N_URL = "http://localhost:5678" # Írd át, ha más a portod!
LANGFLOW_URL = "http://localhost:7860"

# Teszt feladatok listája (Magyarul, ahogy kérted)
TRAINING_TASKS = [
    f"Navigálj az n8n felületére: {N8N_URL} és kattints az 'Add Workflow' gombra.",
    "Keress egy 'HTTP Request' node-ot az n8n-ben és húzd be a vászonra.",
    "Nyisd meg a HTTP Request node-ot és írd be az URL mezőbe: https://api.google.com",
    f"Menj a Langflow-ra: {LANGFLOW_URL} és próbálj meg elhelyezni egy 'OpenAI' modult.",
    "Köss össze két tetszőleges dobozt a Langflow vásznán.",
    "Kattints a Windows tálcán a Start menüre (Computer Use teszt).",
    "Nyiss meg egy Jegyzettömböt (Notepad) és írd bele: 'Brunella Robotkez Pro Teszt SIKERES'"
]

def run_training_loop(duration_hours=4):
    end_time = time.time() + (duration_hours * 3600)
    print(f"--- 🚀 KIKÉPZÉS INDUL: {datetime.datetime.now()} ---")
    print(f"--- ⏱️ IDŐTARTAM: {duration_hours} óra ---")

    # Első lépés: Böngésző indítása
    requests.post(f"{API_URL}/start_browser")
    
    cycle = 1
    while time.time() < end_time:
        task = random.choice(TRAINING_TASKS)
        print(f"\n[Ciklus {cycle}] Feladat: {task}")
        
        try:
            # Meghívjuk a Robotkéz Pro Computer Use végpontját
            response = requests.post(f"{API_URL}/computer_use", params={"task": task}, timeout=120)
            result = response.json()
            
            if result.get("status") == "success":
                print(f"✅ SIKER: {result['last_action']['reason']}")
            else:
                print(f"❌ HIBA a végrehajtás során.")
                
        except Exception as e:
            print(f"🚨 KRITIKUS HIBA (Szerver nem elérhető?): {e}")
            time.sleep(10)
            
        cycle += 1
        time.sleep(5) # Rövid szünet a feladatok között

    print(f"--- 🏁 KIKÉPZÉS VÉGE: {datetime.datetime.now()} ---")

if __name__ == "__main__":
    # Indítsd el ezt a fájlt egy külön ablakban!
    run_training_loop(duration_hours=4)
