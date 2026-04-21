"""
ArXiv API Tool - Langflow Custom Component
Tudományos publikációk lekérdezése
"""

import arxiv
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from langflow.custom import CustomComponent
from langchain.tools import Tool


class ArxivSearchTool(CustomComponent):
    """
    ArXiv API wrapper Langflow-hoz
    
    Használat: AI kutatási cikkek automatikus gyűjtése
    """
    
    display_name = "ArXiv Search"
    description = "Search scientific papers on ArXiv"
    documentation = "https://info.arxiv.org/help/api/index.html"
    
    def build_config(self) -> Dict[str, Any]:
        """Langflow UI konfiguráció"""
        return {
            "categories": {
                "display_name": "ArXiv Categories",
                "field_type": "str",
                "required": False,
                "value": "cs.AI,cs.CL,cs.LG",
                "info": "Comma-separated categories (cs.AI, cs.CL, cs.LG, cs.CV, etc.)"
            },
            "max_results": {
                "display_name": "Max Results",
                "field_type": "int",
                "required": False,
                "value": 20,
                "info": "Maximum number of papers to return"
            },
            "days_back": {
                "display_name": "Days Back",
                "field_type": "int",
                "required": False,
                "value": 7,
                "info": "Search papers from the last N days"
            },
            "sort_by": {
                "display_name": "Sort By",
                "field_type": "str",
                "required": False,
                "value": "submittedDate",
                "options": ["relevance", "submittedDate", "lastUpdatedDate"],
                "info": "Sort order for results"
            }
        }
    
    def build(
        self,
        categories: str = "cs.AI,cs.CL,cs.LG",
        max_results: int = 20,
        days_back: int = 7,
        sort_by: str = "submittedDate"
    ) -> Tool:
        """ArXiv search tool létrehozása"""
        
        def search_arxiv(query: str) -> str:
            """
            ArXiv API hívás
            
            Args:
                query: Keresési kifejezés (pl. "large language models")
            
            Returns:
                Formázott cikklista
            """
            
            # Kategória filter
            cat_list = [c.strip() for c in categories.split(',')]
            category_query = " OR ".join([f"cat:{c}" for c in cat_list])
            
            # Dátum filter
            cutoff_date = datetime.now() - timedelta(days=days_back)
            
            # Query konstrukció
            full_query = f"{query} AND ({category_query})"
            
            try:
                # ArXiv client
                client = arxiv.Client()
                
                # Sort mapping
                sort_map = {
                    "relevance": arxiv.SortCriterion.Relevance,
                    "submittedDate": arxiv.SortCriterion.SubmittedDate,
                    "lastUpdatedDate": arxiv.SortCriterion.LastUpdatedDate
                }
                
                search = arxiv.Search(
                    query=full_query,
                    max_results=max_results * 2,  # Extra fetch for filtering
                    sort_by=sort_map.get(sort_by, arxiv.SortCriterion.SubmittedDate),
                    sort_order=arxiv.SortOrder.Descending
                )
                
                results = []
                for paper in client.results(search):
                    # Dátum filter alkalmazás
                    if paper.published.replace(tzinfo=None) < cutoff_date:
                        continue
                    
                    results.append({
                        'title': paper.title,
                        'authors': [author.name for author in paper.authors[:3]],
                        'published': paper.published.strftime('%Y-%m-%d'),
                        'summary': paper.summary[:200] + "...",
                        'url': paper.entry_id,
                        'arxiv_id': paper.get_short_id(),
                        'categories': paper.categories
                    })
                    
                    if len(results) >= max_results:
                        break
                
                # Formázás
                if not results:
                    return f"Nem találtam ArXiv cikkeket a '{query}' témában az elmúlt {days_back} napból."
                
                output = f"**ArXiv Papers ({len(results)} találat):**\n\n"
                
                for idx, paper in enumerate(results, 1):
                    authors_str = ", ".join(paper['authors'])
                    if len(paper['authors']) < len(results[0]['authors']):
                        authors_str += " et al."
                    
                    output += f"{idx}. **{paper['title']}**\n"
                    output += f"   - Szerzők: {authors_str}\n"
                    output += f"   - Dátum: {paper['published']}\n"
                    output += f"   - ArXiv ID: {paper['arxiv_id']}\n"
                    output += f"   - URL: {paper['url']}\n"
                    output += f"   - Összefoglaló: {paper['summary']}\n\n"
                
                return output
                
            except Exception as e:
                return f"ArXiv API error: {str(e)}"
        
        # LangChain Tool wrapper
        return Tool(
            name="arxiv_search",
            description=(
                f"Search scientific papers on ArXiv in categories: {categories}. "
                f"Returns papers from the last {days_back} days, sorted by {sort_by}. "
                "Use this for: latest AI research papers, theoretical advances, "
                "machine learning innovations, NLP breakthroughs."
            ),
            func=search_arxiv
        )
