# CEAN Research Agent Worker

Daily AI trends aggregator from GitHub, HackerNews, and arXiv.

## Features

- **Multi-source research**: GitHub repos, HackerNews stories, arXiv papers
- **LLM analysis**: Gemini Flash or GPT-4o-mini for relevance scoring
- **D1 storage**: Persistent results storage
- **Scheduled runs**: Daily at 2 AM UTC
- **REST API**: On-demand research queries

## API Endpoints

### POST /query
Execute research query.

**Request:**
```json
{
  "query": "LLM inference optimization",
  "sources": ["github", "hackernews", "arxiv"],
  "limit": 50
}
```

**Response:**
```json
{
  "task_id": "task-1234567890-abc",
  "query": "LLM inference optimization",
  "results": [
    {
      "id": "github-12345",
      "title": "vllm-project/vllm",
      "description": "High-throughput LLM serving",
      "url": "https://github.com/vllm-project/vllm",
      "source": "github",
      "relevance_score": 95,
      "confidence_score": 92,
      "category": "Tool",
      "tags": ["llm", "inference", "optimization"],
      "summary": "Production-ready LLM serving framework"
    }
  ],
  "total_found": 47,
  "duration_ms": 1234
}
```

### GET /health
Health check endpoint.

## Deployment

```bash
# Development
npm install
wrangler dev

# Production
wrangler deploy --env production

# Set secrets (API keys)
wrangler secret put GEMINI_API_KEY --env production
wrangler secret put GITHUB_TOKEN --env production
```

## Configuration

Secrets (set via `wrangler secret put`):
- `GEMINI_API_KEY` - Google Gemini API key (optional)
- `OPENAI_API_KEY` - OpenAI API key (optional, required for Vectorize embeddings)
- `GITHUB_TOKEN` - GitHub PAT for higher rate limits (optional)

## Scheduled Jobs

Daily research runs at 2 AM UTC for default queries:
1. LLM inference optimization
2. Multi-agent systems
3. Transformer architecture improvements
4. AI safety and alignment
5. Edge computing AI deployment

Results stored in D1 `edge_results` table (binding: `bas-metadata`).

## Database Schema

Uses CEAN D1 tables:
- `edge_tasks` - Task queue
- `edge_results` - Research findings
- `edge_executions` - Execution logs

## Development

```bash
# Install dependencies
npm install

# Run locally
npm run dev

# Deploy to dev environment
wrangler deploy --env development

# View logs
wrangler tail --env production
```

## Cost Estimate

- **GitHub API**: Free (5000 req/hour with token)
- **HackerNews API**: Free (unlimited)
- **arXiv API**: Free (unlimited)
- **Gemini Flash**: ~$0.00001/request
- **Cloudflare Workers**: ~$0.000005/request (50ms CPU)

**Daily cost**: <$0.01/day

## License

MIT
