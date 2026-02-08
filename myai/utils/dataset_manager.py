# FILE: myai/utils/dataset_manager.py
# PURPOSE: Kezeli az 'Arany Adatkészlet' (Golden Dataset) mentését ChatML formátumban.

import json
import os
from datetime import datetime
from typing import Dict, Any, List

TRAINING_DATA_PATH = "data/training/golden_dataset.jsonl"

def save_gold_sample(system_prompt: str, user_input: str, assistant_output: str, metadata: Dict[str, Any] = None):
    """
    Elment egy sikeres interakciót a tréning adatkészletbe ChatML formátumban.
    """
    os.makedirs(os.path.dirname(TRAINING_DATA_PATH), exist_ok=True)
    
    entry = {
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_input},
            {"role": "assistant", "content": assistant_output}
        ],
        "metadata": {
            "timestamp": datetime.utcnow().isoformat(),
            "source": metadata.get("source", "unknown") if metadata else "unknown"
        }
    }
    
    with open(TRAINING_DATA_PATH, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")


# Kompatibilitás: régi függvény név
def save_to_golden_dataset(user_prompt, system_prompt, model_output, metadata):
    """ChatML formátum (Llama 3 kompatibilis) - LEGACY"""
    save_gold_sample(
        system_prompt=system_prompt,
        user_input=user_prompt,
        assistant_output=json.dumps(model_output) if isinstance(model_output, dict) else model_output,
        metadata=metadata
    )