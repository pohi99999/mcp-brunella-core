import { searchRAG } from '@packages/utils/rag.js';

export interface BrunellaRagHit {
  text: string;
  path?: string;
  score?: number;
}

export function summarizeRagHits(hits: BrunellaRagHit[]): string[] {
  if (hits.length === 0) {
    return ['- No RAG matches found.'];
  }

  return hits.map((hit) => {
    const text = hit.text.replace(/\s+/g, ' ').trim();
    const shortText = text.length > 180 ? `${text.slice(0, 177)}...` : text;
    const pathPart = hit.path ? ` [${hit.path}]` : '';
    return `- ${shortText}${pathPart}`;
  });
}

export async function queryProjectSummary(
  query: string,
  limit = 5,
): Promise<BrunellaRagHit[]> {
  return searchRAG(query, limit);
}

