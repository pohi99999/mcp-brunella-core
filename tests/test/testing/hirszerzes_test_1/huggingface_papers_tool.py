"""
HuggingFace Papers Tool - Langflow Custom Component
HF Daily Papers lekérdezése
"""

import requests
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from langflow.custom import CustomComponent
from langchain.tools import Tool


class HuggingFacePapersTool(CustomComponent):
    """
    HuggingFace Papers API wrapper Langflow-hoz
    
    Használat: Legújabb ML/AI cikkek gyűjtése HuggingFace-ről
    """
    
    display_name = "HuggingFace Papers"
    description = "Get latest AI/ML papers from HuggingFace"
    documentation = "https://huggingface.co/docs/hub/api"
    
    def build_config(self) -> Dict[str, Any]:
        """Langflow UI konfiguráció"""
        return {
            "max_results": {
                "display_name": "Max Results",
                "field_type": "int",
                "required": False,
                "value": 10,
                "info": "Maximum number of papers to return"
            },
            "days_back": {
                "display_name": "Days Back",
                "field_type": "int",
                "required": False,
                "value": 7,
                "info": "Get papers from the last N days"
            }
        }
    
    def build(
        self,
        max_results: int = 10,
        days_back: int = 7
    ) -> Tool:
        """HuggingFace papers tool létrehozása"""
        
        def get_hf_papers(query: str) -> str:
            """
            HuggingFace papers lekérdezése
            
            Args:
                query: Szűrési kulcsszavak (opcionális)
            
            Returns:
                Formázott paperlista
            """
            
            # HuggingFace Papers API endpoint
            url = "https://huggingface.co/api/daily_papers"
            
            try:
                response = requests.get(url, timeout=15)
                response.raise_for_status()
                
                papers_data = response.json()
                
                # Dátum filter
                cutoff_date = datetime.now() - timedelta(days=days_back)
                
                # Filter és limit
                filtered_papers = []
                query_lower = query.lower() if query else ""
                
                for paper in papers_data:
                    # Dátum parse (ha van publishedAt)
                    published_str = paper.get('publishedAt', '')
                    if published_str:
                        try:
                            published_date = datetime.fromisoformat(published_str.replace('Z', '+00:00'))
                            if published_date.replace(tzinfo=None) < cutoff_date:
                                continue
                        except:
                            pass
                    
                    # Query filter (ha van)
                    if query_lower:
                        title = paper.get('title', '').lower()
                        abstract = paper.get('summary', '').lower()
                        
                        if query_lower not in title and query_lower not in abstract:
                            continue
                    
                    filtered_papers.append(paper)
                    
                    if len(filtered_papers) >= max_results:
                        break
                
                if not filtered_papers:
                    return f"Nem találtam HuggingFace papereket az elmúlt {days_back} napból."
                
                # Formázás
                output = f"**HuggingFace Papers ({len(filtered_papers)} találat):**\n\n"
                
                for idx, paper in enumerate(filtered_papers, 1):
                    title = paper.get('title', 'N/A')
                    authors = paper.get('authors', [])
                    summary = paper.get('summary', 'N/A')
                    paper_url = paper.get('paper', {}).get('url', '')
                    upvotes = paper.get('upvotes', 0)
                    
                    # Truncate summary
                    if len(summary) > 200:
                        summary = summary[:200] + "..."
                    
                    output += f"{idx}. **{title}**\n"
                    
                    if authors:
                        authors_str = ", ".join(authors[:3])
                        if len(authors) > 3:
                            authors_str += " et al."
                        output += f"   - Szerzők: {authors_str}\n"
                    
                    output += f"   - Összefoglaló: {summary}\n"
                    
                    if paper_url:
                        output += f"   - Paper URL: {paper_url}\n"
                    
                    # HuggingFace model link (ha van)
                    if 'repo' in paper:
                        output += f"   - HF Repo: https://huggingface.co/{paper['repo']}\n"
                    
                    output += f"   - Upvotes: 👍 {upvotes}\n\n"
                
                return output
                
            except requests.exceptions.RequestException as e:
                return f"HuggingFace API error: {str(e)}"
            except Exception as e:
                return f"Unexpected error: {str(e)}"
        
        # LangChain Tool wrapper
        return Tool(
            name="huggingface_papers",
            description=(
                f"Get latest AI/ML papers from HuggingFace Daily Papers. "
                f"Returns papers from the last {days_back} days. "
                "Use this for: trending ML research, model releases, "
                "HuggingFace ecosystem updates."
            ),
            func=get_hf_papers
        )
