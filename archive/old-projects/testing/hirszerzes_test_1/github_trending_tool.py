"""
GitHub Trending Tool - Langflow Custom Component
Trending repositoryk gyűjtése
"""

import requests
from typing import Optional, List, Dict, Any
from datetime import datetime
from langflow.custom import CustomComponent
from langchain.tools import Tool


class GitHubTrendingTool(CustomComponent):
    """
    GitHub Trending API wrapper Langflow-hoz
    
    Használat: Népszerű nyílt forráskódú projektek felfedezése
    """
    
    display_name = "GitHub Trending"
    description = "Get trending repositories from GitHub"
    documentation = "https://docs.github.com/en/rest"
    
    def build_config(self) -> Dict[str, Any]:
        """Langflow UI konfiguráció"""
        return {
            "github_token": {
                "display_name": "GitHub Token (Optional)",
                "field_type": "str",
                "required": False,
                "password": True,
                "info": "Personal access token for higher rate limits"
            },
            "language": {
                "display_name": "Language",
                "field_type": "str",
                "required": False,
                "value": "python",
                "options": ["python", "javascript", "typescript", "rust", "go", "any"],
                "info": "Programming language filter"
            },
            "since": {
                "display_name": "Time Range",
                "field_type": "str",
                "required": False,
                "value": "weekly",
                "options": ["daily", "weekly", "monthly"],
                "info": "Trending period"
            },
            "min_stars": {
                "display_name": "Min Stars",
                "field_type": "int",
                "required": False,
                "value": 100,
                "info": "Minimum star count filter"
            },
            "max_results": {
                "display_name": "Max Results",
                "field_type": "int",
                "required": False,
                "value": 15,
                "info": "Maximum number of repos to return"
            }
        }
    
    def build(
        self,
        github_token: Optional[str] = None,
        language: str = "python",
        since: str = "weekly",
        min_stars: int = 100,
        max_results: int = 15
    ) -> Tool:
        """GitHub trending tool létrehozása"""
        
        def get_trending_repos(query: str) -> str:
            """
            GitHub trending repos lekérdezése
            
            Args:
                query: Keresési kifejezés (témakörök, pl. "llm agent rag")
            
            Returns:
                Formázott repo lista
            """
            
            # GitHub Search API
            base_url = "https://api.github.com/search/repositories"
            
            headers = {
                "Accept": "application/vnd.github.v3+json"
            }
            
            if github_token:
                headers["Authorization"] = f"token {github_token}"
            
            # Időintervallum számítás
            from datetime import datetime, timedelta
            
            if since == "daily":
                created_after = (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d')
            elif since == "weekly":
                created_after = (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d')
            else:  # monthly
                created_after = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
            
            # Query építés
            search_query = query
            if language and language != "any":
                search_query += f" language:{language}"
            
            search_query += f" stars:>={min_stars} created:>={created_after}"
            
            params = {
                "q": search_query,
                "sort": "stars",
                "order": "desc",
                "per_page": max_results
            }
            
            try:
                response = requests.get(base_url, headers=headers, params=params, timeout=15)
                response.raise_for_status()
                
                data = response.json()
                items = data.get('items', [])
                
                if not items:
                    return f"Nem találtam trending GitHub repókat a '{query}' témában."
                
                # Formázás
                output = f"**GitHub Trending Repositories ({len(items)} találat):**\n\n"
                
                for idx, repo in enumerate(items, 1):
                    output += f"{idx}. **{repo['name']}** by {repo['owner']['login']}\n"
                    output += f"   - Leírás: {repo['description'] or 'N/A'}\n"
                    output += f"   - Stars: ⭐ {repo['stargazers_count']:,}\n"
                    output += f"   - Forks: 🍴 {repo['forks_count']:,}\n"
                    output += f"   - Nyelv: {repo['language'] or 'N/A'}\n"
                    output += f"   - URL: {repo['html_url']}\n"
                    
                    # Topics (ha vannak)
                    if repo.get('topics'):
                        output += f"   - Topics: {', '.join(repo['topics'][:5])}\n"
                    
                    # Létrehozás dátuma
                    created = datetime.strptime(repo['created_at'], '%Y-%m-%dT%H:%M:%SZ')
                    output += f"   - Létrehozva: {created.strftime('%Y-%m-%d')}\n\n"
                
                # Rate limit info
                rate_limit = response.headers.get('X-RateLimit-Remaining', 'N/A')
                output += f"\n*GitHub API rate limit: {rate_limit} remaining*\n"
                
                return output
                
            except requests.exceptions.RequestException as e:
                return f"GitHub API error: {str(e)}"
            except Exception as e:
                return f"Unexpected error: {str(e)}"
        
        # LangChain Tool wrapper
        return Tool(
            name="github_trending",
            description=(
                f"Get trending GitHub repositories in {language}. "
                f"Shows repos from the last {since} with minimum {min_stars} stars. "
                "Use this for: popular open-source AI tools, new frameworks, "
                "innovative projects, community favorites."
            ),
            func=get_trending_repos
        )
