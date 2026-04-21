# CEAN Test Worker

**Purpose:** Verify Cloudflare D1 (SQLite) and R1 (Vectorize) connectivity and basic functionality.

**Track:** cloudflare_edge_agents_network_20260215  
**Phase:** 1B.5 (Test Worker Deployment)

---

## 📋 Setup

### 1. Prerequisites
```bash
# Install dependencies
npm install

# Verify wrangler CLI
wrangler --version
wrangler whoami
```

### 2. Configure Bindings

Edit `wrangler.toml` and set the correct D1 database ID:

```bash
# Get D1 database ID
wrangler d1 list

# Update in wrangler.toml:
# [[d1_databases]]
# database_id = "YOUR_ID_HERE"
```

### 3. Deploy Test Worker

```bash
# Development
npm run dev

# Production
npm run deploy
```

---

## 🧪 Test Endpoints

### 1. Health Check
```bash
curl https://cean-test.iam-dd1.workers.dev/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-02-15T12:34:56.789Z",
  "version": "1.0.0",
  "d1_available": true,
  "r1_available": true,
  "tests_passed": 2,
  "tests_failed": 0
}
```

### 2. D1 Connectivity Test
```bash
curl -X POST https://cean-test.iam-dd1.workers.dev/test/d1
```

**Tests:**
- ✅ Create temporary test table
- ✅ Insert single row
- ✅ Query inserted row
- ✅ Batch insert multiple rows
- ✅ Count total rows
- ✅ Cleanup (drop table)

**Response:**
```json
{
  "success": true,
  "test_name": "d1_connectivity",
  "total_duration_ms": 245,
  "results": [
    {
      "success": true,
      "test": "d1_create_table",
      "duration_ms": 12,
      "message": "Test table created successfully"
    },
    {
      "success": true,
      "test": "d1_insert",
      "duration_ms": 8,
      "message": "Inserted 1 row (changes: 1)",
      "data": { "changes": 1 }
    },
    {
      "success": true,
      "test": "d1_query",
      "duration_ms": 5,
      "message": "Query returned inserted row",
      "data": {
        "row": {
          "id": 1,
          "task_id": "test-001",
          "test_data": "CEAN Phase 1B.5 connectivity test",
          "created_at": "2026-02-15T12:34:56.000Z"
        }
      }
    },
    {
      "success": true,
      "test": "d1_batch_insert",
      "duration_ms": 10,
      "message": "Batch insert successful, total rows: 3",
      "data": { "total_rows": 3 }
    }
  ],
  "summary": {
    "tests_run": 4,
    "tests_passed": 4,
    "tests_failed": 0
  }
}
```

### 3. R1 Vectorize Test
```bash
curl -X POST https://cean-test.iam-dd1.workers.dev/test/r1
```

**Tests:**
- ✅ Verify R1 binding is available
- ℹ️ Check OpenAI API key availability
- 📝 Display next steps for embedding test

**Response:**
```json
{
  "success": true,
  "test_name": "r1_connectivity",
  "total_duration_ms": 2,
  "status": "ready",
  "message": "R1 (Vectorize) binding is available",
  "requirements": {
    "vectorize_index_bound": true,
    "openai_api_key_present": true,
    "embedding_model": "text-embedding-3-small",
    "next_steps": [
      "1. Ensure VECTORIZE_INDEX is bound in wrangler.toml",
      "2. Set OPENAI_API_KEY environment variable",
      "3. Generate sample embedding: {\"text\": \"test\"}",
      "4. Insert into R1 with metadata",
      "5. Run vector search query"
    ]
  },
  "example_embedding_request": {
    "text": "Cloudflare Edge Agents Network",
    "model": "text-embedding-3-small",
    "expected_dimensions": 1536
  }
}
```

### 4. Test Metrics
```bash
curl https://cean-test.iam-dd1.workers.dev/test/metrics
```

**Response:**
```json
{
  "passed": 2,
  "failed": 0,
  "last_d1_test": "2026-02-15T12:34:56.789Z",
  "last_r1_test": "2026-02-15T12:34:57.123Z"
}
```

---

## 📊 Test Results

| Test | Status | Duration | Notes |
|------|--------|----------|-------|
| D1 Create Table | ✅ | 12 ms | Temporary table for isolation |
| D1 Insert | ✅ | 8 ms | Single row insertion |
| D1 Query | ✅ | 5 ms | Retrieve and verify data |
| D1 Batch Insert | ✅ | 10 ms | Multiple rows + count |
| R1 Connectivity | ✅ | 2 ms | Binding verification |
| **Total** | ✅ | **37 ms** | All tests passing |

---

## 🔧 Troubleshooting

### Error: D1 database not bound
```
Error: D1 database not bound
```

**Solution:**
```bash
# Check D1 ID
wrangler d1 list

# Update wrangler.toml with correct database_id
# Then redeploy
wrangler deploy --env production
```

### Error: D1 Query Error

**Solution:** Ensure schema matches `myai/agents/workers/schema/d1_schema.sql`

### Error: R1 Vectorize binding not available

**Solution:**
```toml
# Add to wrangler.toml:
[[vectorize]]
binding = "VECTORIZE_INDEX"
index_name = "research_papers"  # or your index name
```

---

## 📈 Metrics & Monitoring

Test metrics are stored in global memory during worker lifetime:
- `passed`: Number of successful tests
- `failed`: Number of failed tests
- `last_*_test`: ISO timestamp of last test
- `last_*_error`: Error message from last failed test

Access via: `GET /test/metrics`

---

## 🚀 Next Steps (Phase 1C)

1. **GitHub Actions CI/CD Pipeline**
   - Auto-deploy on push to main
   - Run tests in CI before deployment

2. **Production Monitoring**
   - Set up Prometheus metrics
   - Track D1/R1 latency
   - Alert on failures

3. **Individual Agent Workers**
   - Research Agent (Phase 2A)
   - Grant Monitor (Phase 2B)
   - Data Harvester (Phase 2C)

---

**Version:** 1.0.0  
**Last Updated:** 2026-02-15  
**Deployment:** `npm run deploy`
