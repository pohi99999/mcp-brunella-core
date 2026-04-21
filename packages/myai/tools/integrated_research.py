# FILE: myai/tools/integrated_research.py
# PURPOSE: Integrált kutatóeszközök a Perplexity, ArXiv és GitHub eléréséhez.

import os
import requests
import arxiv
from dotenv import load_dotenv

load_dotenv()

class ResearchSuite:
    def __init__(self):
        self.pplx_key = os.getenv("PERPLEXITY_API_KEY")

    def market_search(self, query: str):
        """Webes keresés Perplexity-vel (Real-time piaci hírek)."""
        url = "https://api.perplexity.ai/chat/completions"
        payload = {
            "model": "llama-3.1-sonar-large-128k-online",
            "messages": [
                {"role": "system", "content": "Autópiaci és technológiai elemző vagy. Keress friss híreket."},
                {"role": "user", "content": query}
            ]
        }
        headers = {"Authorization": f"Bearer {self.pplx_key}", "Content-Type": "application/json"}
        try:
            res = requests.post(url, json=payload, headers=headers).json()
            return res['choices'][0]['message']['content']
        except: return "Kutatási adat nem elérhető."

    def tech_trends(self, topic: str):
        """Technológiai trendek (ArXiv) lekérése (pl. akkumulátor fejlesztések)."""
        search = arxiv.Search(query=topic, max_results=2, sort_by=arxiv.SortCriterion.Relevance)
        return [{"title": r.title, "link": r.entry_id} for r in search.results()]