import requests
from typing import List, Dict, Optional
from myai.config import OLLAMA_URL, DEFAULT_MODEL


def ollama_chat(
    messages: List[Dict[str, str]],
    model: str = DEFAULT_MODEL,
    stream: bool = False,
) -> str:
    url = f"{OLLAMA_URL}/api/chat"
    payload = {
        "model": model,
        "messages": messages,
        "stream": stream,
    }
    r = requests.post(url, json=payload)
    if r.status_code != 200:
        print(f"DEBUG: Ollama Error {r.status_code}: {r.text}")
    r.raise_for_status()

    if stream:
        full = ""
        for line in r.iter_lines():
            if not line:
                continue
            data = line.decode("utf-8")
            full += data
        return full

    data = r.json()
    return data["message"]["content"]


def simple_completion(prompt: str, model: str = DEFAULT_MODEL) -> str:
    return ollama_chat(
        messages=[{"role": "user", "content": prompt}],
        model=model,
        stream=False,
    )
