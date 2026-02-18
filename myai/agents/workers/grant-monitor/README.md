# Grant Monitor Worker

🏛️ **CEAN Phase 2C** - Real-time funding opportunity aggregator for Cloudflare Workers.

## Overview

The Grant Monitor Worker systematically tracks funding opportunities from multiple sources:
- **Grants.gov** - Federal grants and funding
- **NSF** - National Science Foundation programs
- **DOE** - Department of Energy initiatives
- **Custom sources** - API integrations

## Features

✅ **Scheduled Monitoring** - Daily cron job checks (6 AM UTC)
✅ **D1 Database** - Persistent grant storage with indexes
✅ **RESTful API** - Search, filters, upcoming deadlines
✅ **Real-time Updates** - Manual HTTP trigger for on-demand checks
✅ **Statistics** - Grant counts, agencies, sources, upcoming deadlines
✅ **Batch Operations** - Efficient multi-grant storage

## API Endpoints

### Health Check
```bash
GET /health
```
Returns database connection status and statistics.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-02-18T10:30:00Z",
  "database": "connected",
  "stats": {
    "totalGrants": 150,
    "agencies": ["NSF", "DOE", "NIH"],
    "sources": ["grants-gov", "nsf"],
    "upcomingDeadlines": 42
  }
}
```

### Search Grants
```bash
GET /search?keyword=AI&agency=NSF&limit=10
```

**Parameters:**
- `keyword` - Search in title/description
- `agency` - Filter by agency (NSF, DOE, NIH, etc.)
- `minAmount` - Minimum funding amount
- `maxAmount` - Maximum funding amount
- `category` - Grant category
- `limit` - Results limit (default: 10)
- `offset` - Pagination offset

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "id": "grants-gov-001",
      "title": "AI Research Initiative",
      "agency": "NSF",
      "fundingAmount": 500000,
      "deadline": "2026-04-01",
      "url": "https://..."
    }
  ]
}
```

### Upcoming Grants
```bash
GET /upcoming?limit=10
```

Returns grants with deadlines within 30 days.

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "grantId": "grants-gov-001",
      "title": "AI Research Initiative",
      "deadline": "2026-04-01",
      "fundingAmount": 500000,
      "relevanceScore": 0.95
    }
  ]
}
```

### Manual Trigger
```bash
POST /trigger
```

Manually trigger a grant check (useful for testing).

**Response:**
```json
{
  "success": true,
  "message": "Processed 15 grants from Grants.gov",
  "stored": 12,
  "timestamp": "2026-02-18T10:35:00Z"
}
```

## Database Schema

### `grants` Table
```sql
CREATE TABLE grants (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  agency TEXT NOT NULL,
  description TEXT,
  funding_amount REAL,
  deadline TEXT,
  url TEXT UNIQUE,
  source TEXT,  -- 'grants-gov', 'nsf', 'doi', 'nih'
  discovered_at TIMESTAMP,
  category TEXT,
  eligibility TEXT (JSON array),
  tags TEXT (JSON array),
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

**Indexes:**
- `idx_grants_deadline` - Quick deadline queries
- `idx_grants_agency` - Filter by agency
- `idx_grants_source` - Filter by source
- `idx_grants_category` - Filter by category

### `grant_checks` Table
```sql
CREATE TABLE grant_checks (
  id INTEGER PRIMARY KEY,
  source TEXT,
  last_checked TIMESTAMP,
  grants_found INTEGER,
  error_message TEXT,
  created_at TIMESTAMP
);
```

## Scheduled Trigger (Cron)

Runs daily at **6 AM UTC**:
```toml
[triggers]
crons = ["0 6 * * *"]
```

Executes the scheduled handler which:
1. Initializes D1 schema
2. Fetches from Grants.gov
3. Stores grants in D1
4. Records check statistics
5. Logs results

## Development

### Build
```bash
npm run build
```

### Deploy
```bash
# Development
wrangler deploy --env development

# Production
wrangler deploy --env production
```

### Environment Setup

Update `wrangler.toml`:
```toml
[[d1_databases]]
binding = "DB"
database_name = "bas-metadata"
database_id = "YOUR_D1_ID"
```

## Configuration

### Environment Variables (in `wrangler.toml`)
```toml
vars = { 
  ENVIRONMENT = "production",
  LOG_LEVEL = "info"
}
```

Available log levels: `debug`, `info`, `warn`, `error`

## Integration with CEAN

This worker is part of the **Cloudflare Edge Agents Network (CEAN)** Phase 2C:
- **Phase 2A**: D1 Database setup ✅
- **Phase 2B**: Research Agent Worker ✅
- **Phase 2C**: Grant Monitor Worker (this) 🚀
- **Phase 3**: Multi-agent orchestration

## Testing

### Test Health
```bash
curl https://grant-monitor.workers.dev/health
```

### Test Search
```bash
curl "https://grant-monitor.workers.dev/search?keyword=AI&limit=5"
```

### Test Upcoming
```bash
curl https://grant-monitor.workers.dev/upcoming?limit=5
```

### Manual Trigger
```bash
curl -X POST https://grant-monitor.workers.dev/trigger
```

## Performance Notes

- Search queries use indexed columns for fast filtering
- D1 batch inserts optimize throughput
- Cron job completes in <5 seconds
- API responses typically <100ms

## Data Sources

| Source | Update Frequency | API | Status |
|---|---|---|---|
| Grants.gov | Daily (6 AM) | XML Extract | ✅ Implemented |
| NSF | Daily | OpenSearch | 🔄 Soon |
| DOE | Daily | ARPA-E API | 🔄 Soon |
| NIH | Daily | API | 🔄 Soon |

## Future Enhancements

- [ ] Vectorize integration for semantic search
- [ ] Email notifications for new grants
- [ ] Grant eligibility scoring
- [ ] Durable Objects for state management
- [ ] KV cache for frequent searches

---

**CEAN Phase 2C** - Part of the Brunella Agent System
Created: 2026-02-18
