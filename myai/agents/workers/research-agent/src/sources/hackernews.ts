// HackerNews API Integration
import { ResearchResult } from '../types';

export async function fetchHackerNews(
  query: string,
  limit: number
): Promise<ResearchResult[]> {
  const results: ResearchResult[] = [];

  try {
    // Algolia HN Search API
    const searchUrl = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=${Math.min(limit, 100)}`;
    
    const response = await fetch(searchUrl);
    
    if (!response.ok) {
      console.error(`HackerNews API error: ${response.status}`);
      return results;
    }

    const data = await response.json() as any;

    for (const hit of data.hits || []) {
      if (!hit.url) continue; // Skip text posts without URL

      results.push({
        id: `hn-${hit.objectID}`,
        title: hit.title || 'No title',
        description: hit.story_text || hit.comment_text || 'Discussion on HackerNews',
        url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
        source: 'hackernews',
        relevance_score: calculateRelevance(hit, query),
        published_at: hit.created_at,
        metadata: {
          points: hit.points || 0,
          num_comments: hit.num_comments || 0,
          author: hit.author,
          created_at_i: hit.created_at_i,
        },
      });
    }

    return results;
  } catch (error: any) {
    console.error('HackerNews fetch error:', error.message);
    return results;
  }
}

function calculateRelevance(hit: any, query: string): number {
  let score = 0;
  const queryLower = query.toLowerCase();

  // Title match
  if (hit.title?.toLowerCase().includes(queryLower)) {
    score += 40;
  }

  // Points weight (normalized)
  const pointsScore = Math.min(30, (hit.points || 0) / 10);
  score += pointsScore;

  // Comments engagement
  const commentsScore = Math.min(20, (hit.num_comments || 0) / 5);
  score += commentsScore;

  // Recency (last 7 days = bonus)
  const hoursAgo = (Date.now() / 1000 - hit.created_at_i) / 3600;
  if (hoursAgo < 24 * 7) {
    score += 10;
  }

  return Math.min(100, score);
}
