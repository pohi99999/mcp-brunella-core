// arXiv API Integration
import { ResearchResult } from '../types';

export async function fetchArxivPapers(
  query: string,
  limit: number
): Promise<ResearchResult[]> {
  const results: ResearchResult[] = [];

  try {
    // arXiv API (XML format)
    const searchUrl = `http://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=${Math.min(limit, 100)}&sortBy=relevance&sortOrder=descending`;
    
    const response = await fetch(searchUrl);
    
    if (!response.ok) {
      console.error(`arXiv API error: ${response.status}`);
      return results;
    }

    const xmlText = await response.text();
    
    // Parse XML (simple regex-based parser for Cloudflare Workers)
    const entries = xmlText.match(/<entry>[\s\S]*?<\/entry>/g) || [];

    for (const entry of entries) {
      const id = extractXmlTag(entry, 'id');
      const title = extractXmlTag(entry, 'title')?.replace(/\s+/g, ' ').trim();
      const summary = extractXmlTag(entry, 'summary')?.replace(/\s+/g, ' ').trim();
      const published = extractXmlTag(entry, 'published');
      const updated = extractXmlTag(entry, 'updated');
      
      const authors = entry.match(/<author>[\s\S]*?<name>(.*?)<\/name>/g)?.map(
        a => a.match(/<name>(.*?)<\/name>/)?.[1] || ''
      ) || [];

      const categories = entry.match(/<category term="(.*?)"/g)?.map(
        c => c.match(/term="(.*?)"/)?.[1] || ''
      ) || [];

      if (id && title) {
        results.push({
          id: `arxiv-${id.split('/').pop()}`,
          title: title,
          description: summary || 'No summary available',
          url: id,
          source: 'arxiv',
          relevance_score: calculateRelevance(title, summary || '', query),
          published_at: published || new Date().toISOString(),
          metadata: {
            authors: authors.slice(0, 5), // Limit to 5 authors
            categories: categories,
            updated_at: updated,
            arxiv_id: id.split('/').pop(),
          },
        });
      }
    }

    return results;
  } catch (error: any) {
    console.error('arXiv fetch error:', error.message);
    return results;
  }
}

function extractXmlTag(xml: string, tagName: string): string | undefined {
  const match = xml.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\/${tagName}>`));
  return match ? match[1] : undefined;
}

function calculateRelevance(title: string, summary: string, query: string): number {
  let score = 0;
  const queryLower = query.toLowerCase();
  const titleLower = title.toLowerCase();
  const summaryLower = summary.toLowerCase();

  // Title exact match
  if (titleLower.includes(queryLower)) {
    score += 50;
  }

  // Summary match
  if (summaryLower.includes(queryLower)) {
    score += 30;
  }

  // Term frequency in summary
  const queryTerms = queryLower.split(/\s+/);
  const matchCount = queryTerms.filter(term => 
    summaryLower.includes(term) || titleLower.includes(term)
  ).length;
  
  score += (matchCount / queryTerms.length) * 20;

  return Math.min(100, score);
}
