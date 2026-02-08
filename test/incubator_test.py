# FILE: test/incubator_test.py
# PURPOSE: Ellenőrzi a tréning adat mentési folyamatot.

import os
import json
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'myai'))

from utils.dataset_manager import save_gold_sample, TRAINING_DATA_PATH

def test_data_collection():
    if os.path.exists(TRAINING_DATA_PATH):
        os.remove(TRAINING_DATA_PATH)
    
    save_gold_sample("Test System", "Test User", "Test Assistant", {"source": "unit_test"})
    
    assert os.path.exists(TRAINING_DATA_PATH)
    with open(TRAINING_DATA_PATH, "r") as f:
        line = f.readline()
        data = json.loads(line)
        assert data["messages"][1]["content"] == "Test User"
    
    print("✅ Incubator Data Collection Test Passed!")

if __name__ == "__main__":
    test_data_collection()
