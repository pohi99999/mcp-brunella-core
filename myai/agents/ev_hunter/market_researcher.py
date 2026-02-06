# FILE: myai/agents/ev_hunter/market_researcher.py
# PURPOSE: A Perplexity kereső integrálása az autópiaci trendek figyelésére.
# SOURCE INSPIRATION: perplexity_search_tool.py

import os
import requests
from dotenv import load_dotenv

load_dotenv()

class EVMarketResearcher:
    def __init__(self):
        self.api_key = os.getenv("PERPLEXITY_API_KEY")
        self.url = "https://api.perplexity.ai/chat/completions"

    def get_latest_ev_trends(self, region: str):
        """Webes keresés a megadott régió elektromos autó piaci trendjeiről."""
        payload = {
            "model": "llama-3.1-sonar-large-128k-online",
            "messages": [
                {"role": "system", "content": "Te egy autópiaci elemző vagy. Keress friss híreket."},
                {"role": "user", "content": f"Milyen új EV állami támogatások vagy árváltozások vannak itt: {region}?"}
            ]
        }
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        response = requests.post(self.url, json=payload, headers=headers)
        return response.json()['choices'][0]['message']['content']

# Ezt a kutatási eredményt a Score (pontozó) logika bemenetként használhatja.