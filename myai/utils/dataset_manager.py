import json
from datetime import datetime

def save_to_golden_dataset(user_prompt, system_prompt, model_output, metadata):
    """ChatML formátum (Llama 3 kompatibilis)"""
    entry = {
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
            {"role": "assistant", "content": json.dumps(model_output)}
        ],
        "metadata": {
            "source": metadata.get("source"),
            "timestamp": datetime.now().isoformat(),
            "validation_score": 1.0
        }
    }
    # TODO: Append to a .jsonl file
    print(json.dumps(entry))