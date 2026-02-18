// GitHub Trending API Integration
import { ResearchResult } from '../types.js';
import { logError } from '../utils/logger.js';

export async function fetchGitHubTrends(
  query: string,
  limit: number,
  githubToken?: string
): Promise<ResearchResult[]> {
  const results: ResearchResult[] = [];

  try {
    // GitHub Search API
    const searchUrl = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=${Math.min(limit, 100)}`;
    
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'CEAN-Research-Agent/1.0',
    };

    if (githubToken) {
      headers['Authorization'] = `Bearer ${githubToken}`;
    }

    const response = await fetch(searchUrl, { headers });
    
    if (!response.ok) {
      logError("GitHub API error", {
        status: response.status,
        statusText: response.statusText,
      });
      return results;
    }

    const data = await response.json() as any;

    for (const repo of data.items || []) {
      results.push({
        id: `github-${repo.id}`,
        title: repo.full_name,
        description: repo.description || 'No description',
        url: repo.html_url,
        source: 'github',
        relevance_score: calculateRelevance(repo, query),
        published_at: repo.created_at,
        metadata: {
          stars: repo.stargazers_count,
          forks: repo.forks_count,
          language: repo.language,
          topics: repo.topics || [],
          updated_at: repo.updated_at,
        },
      });
    }

    return results;
  } catch (error: any) {
    logError("GitHub fetch error", {
      message: error instanceof Error ? error.message : String(error),
    });
    return results;
  }
}

function calculateRelevance(repo: any, query: string): number {
  let score = 0;
  const queryLower = query.toLowerCase();

  // Check title match
  if (repo.full_name?.toLowerCase().includes(queryLower)) {
    score += 30;
  }

  // Check description match
  if (repo.description?.toLowerCase().includes(queryLower)) {
    score += 20;
  }

  // Stars weight (logarithmic)
  const starsScore = Math.min(30, Math.log10(repo.stargazers_count + 1) * 5);
  score += starsScore;

  // Recent activity weight
  const daysSinceUpdate = (Date.now() - new Date(repo.updated_at).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceUpdate < 30) {
    score += 20;
  } else if (daysSinceUpdate < 90) {
    score += 10;
  }

  return Math.min(100, score);
}
