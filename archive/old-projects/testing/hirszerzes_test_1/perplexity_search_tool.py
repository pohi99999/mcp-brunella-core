"""
Perplexity Search Tool - Langflow Custom Component
Kutató ügynök eszköze real-time web search-höz
"""

import os
import requests
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from langflow.custom import CustomComponent
from langchain.tools import Tool


class PerplexitySearchTool(CustomComponent):
    """
    Perplexity API wrapper Langflow-hoz
    
    Használat: AI kutatási pipeline-ban real-time információgyűjtéshez
    """
    
    display_name = "Perplexity Search"
    description = "Real-time web search using Perplexity AI API"
    documentation = "https://docs.perplexity.ai/reference/post_chat_completions"
    
    def build_config(self) -> Dict[str, Any]:
        """Langflow UI konfiguráció"""
        return {
            "api_key": {
                "display_name": "Perplexity API Key",
                "field_type": "str",
                "required": True,
                "password": True,
                "info": "Get your API key from https://www.perplexity.ai/settings/api"
            },
            "model": {
                "display_name": "Model",
                "field_type": "str",
                "required": False,
                "value": "llama-3.1-sonar-large-128k-online",
                "options": [
                    "llama-3.1-sonar-small-128k-online",
                    "llama-3.1-sonar-large-128k-online",
                    "llama-3.1-sonar-huge-128k-online"
                ],
                "info": "Perplexity model for search"
            },
            "search_domain_filter": {
                "display_name": "Domain Filter",
                "field_type": "str",
                "required": False,
                "value": "",
                "info": "Comma-separated domains to focus on (e.g., arxiv.org,github.com)"
            },
            "search_recency_filter": {
                "display_name": "Recency Filter",
                "field_type": "str",
                "required": False,
                "value": "week",
                "options": ["day", "week", "month", "year"],
                "info": "How recent should the results be"
            },
            "max_results": {
                "display_name": "Max Results",
                "field_type": "int",
                "required": False,
                "value": 10,
                "info": "Maximum number of search results"
            }
        }
    
    def build(
        self,
        api_key: str,
        model: str = "llama-3.1-sonar-large-128k-online",
        search_domain_filter: str = "",
        search_recency_filter: str = "week",
        max_results: int = 10
    ) -> Tool:
        """Perplexity search tool létrehozása"""
        
        def search_perplexity(query: str) -> str:
            """
            Perplexity API hívás
            
            Args:
                query: Keresési kifejezés
            
            Returns:
                Formázott search eredmények
            """
            
            url = "https://api.perplexity.ai/chat/completions"
            
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }
            
            # Időintervallum számítás
            now = datetime.now()
            if search_recency_filter == "day":
                start_date = now - timedelta(days=1)
            elif search_recency_filter == "week":
                start_date = now - timedelta(days=7)
            elif search_recency_filter == "month":
                start_date = now - timedelta(days=30)
            else:  # year
                start_date = now - timedelta(days=365)
            
            # Query augmentation
            enhanced_query = query
            if search_domain_filter:
                domains = search_domain_filter.split(',')
                domain_filter = " OR ".join([f"site:{d.strip()}" for d in domains])
                enhanced_query = f"{query} ({domain_filter})"
            
            enhanced_query += f" after:{start_date.strftime('%Y-%m-%d')}"
            
            payload = {
                "model": model,
                "messages": [
                    {
                        "role": "system",
                        "content": "You are a research assistant. Provide concise, factual information with sources."
                    },
                    {
                        "role": "user",
                        "content": enhanced_query
                    }
                ],
                "max_tokens": 2000,
                "temperature": 0.2,
                "top_p": 0.9,
                "search_domain_filter": search_domain_filter.split(',') if search_domain_filter else None,
                "return_citations": True,
                "search_recency_filter": search_recency_filter
            }
            
            try:
                response = requests.post(url, json=payload, headers=headers, timeout=30)
                response.raise_for_status()
                
                data = response.json()
                
                # Eredmény formázás
                content = data['choices'][0]['message']['content']
                citations = data.get('citations', [])
                
                result = f"**Perplexity Search Results:**\n\n{content}\n\n"
                
                if citations:
                    result += "**Sources:**\n"
                    for idx, citation in enumerate(citations[:max_results], 1):
                        result += f"{idx}. {citation}\n"
                
                return result
                
            except requests.exceptions.RequestException as e:
                return f"Perplexity API error: {str(e)}"
            except Exception as e:
                return f"Unexpected error: {str(e)}"
        
        # LangChain Tool wrapper
        return Tool(
            name="perplexity_search",
            description=(
                "Search the web using Perplexity AI. "
                "Use this for: latest AI research, GitHub trending projects, "
                "recent papers, and real-time technology news. "
                f"Results limited to last {search_recency_filter}."
            ),
            func=search_perplexity
        )
