// LLM Analyzer - Gemini/OpenAI integration for result analysis
import { ResearchResult, AnalyzedResult, Env } from '../types';

/**
 * Analyze research results with LLM (Gemini Flash or GPT-4o-mini)
 */
export async function analyzeWithLLM(
  results: ResearchResult[],
  query: string,
  env: Env
): Promise<AnalyzedResult[]> {
  // If no API key available, return results without additional analysis
  if (!env.GEMINI_API_KEY && !env.OPENAI_API_KEY) {
    console.warn('No LLM API key configured, skipping AI analysis');
    return results.map(r => ({
      ...r,
      confidence_score: r.relevance_score,
      category: 'Uncategorized',
      tags: [],
      summary: r.description.substring(0, 200),
    }));
  }

  const analyzed: AnalyzedResult[] = [];

  // Batch analyze (max 10 at a time to reduce API calls)
  const topResults = results
    .sort((a, b) => b.relevance_score - a.relevance_score)
    .slice(0, 20);

  for (const result of topResults) {
    try {
      const analysis = await analyzeResult(result, query, env);
      analyzed.push({
        ...result,
        ...analysis,
      });
    } catch (error: any) {
      console.error(`Analysis failed for ${result.id}:`, error.message);
      // Fallback to basic analysis
      analyzed.push({
        ...result,
        confidence_score: result.relevance_score,
        category: 'Uncategorized',
        tags: [],
        summary: result.description.substring(0, 200),
      });
    }
  }

  return analyzed;
}

/**
 * Analyze single result with LLM
 */
async function analyzeResult(
  result: ResearchResult,
  query: string,
  env: Env
): Promise<{
  confidence_score: number;
  category: string;
  tags: string[];
  summary: string;
}> {
  const prompt = `Analyze this research finding for relevance to the query: "${query}"

Title: ${result.title}
Description: ${result.description}
Source: ${result.source}

Provide analysis in JSON format:
{
  "confidence_score": <number 0-100>,
  "category": "<one of: Research, Tool, Framework, Tutorial, News, Discussion>",
  "tags": ["<tag1>", "<tag2>", "<tag3>"],
  "summary": "<one sentence summary>"
}`;

  // Try Gemini first (faster + cheaper)
  if (env.GEMINI_API_KEY) {
    try {
      return await analyzeWithGemini(prompt, env.GEMINI_API_KEY);
    } catch (error: any) {
      console.error('Gemini analysis failed:', error.message);
    }
  }

  // Fallback to OpenAI
  if (env.OPENAI_API_KEY) {
    return await analyzeWithOpenAI(prompt, env.OPENAI_API_KEY);
  }

  throw new Error('No LLM API available');
}

/**
 * Analyze with Gemini Flash (fast & cheap)
 */
async function analyzeWithGemini(
  prompt: string,
  apiKey: string
): Promise<any> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }],
        }],
        generationConfig: {
          temperature: 0.2,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 500,
        },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json() as any;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  
  // Extract JSON from markdown code blocks if present
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/);
  const jsonText = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : text;
  
  return JSON.parse(jsonText);
}

/**
 * Analyze with OpenAI GPT-4o-mini
 */
async function analyzeWithOpenAI(
  prompt: string,
  apiKey: string
): Promise<any> {
  const response = await fetch(
    'https://api.openai.com/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a research analyst. Always respond with valid JSON.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 500,
        response_format: { type: 'json_object' },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json() as any;
  const text = data.choices?.[0]?.message?.content || '{}';
  
  return JSON.parse(text);
}
