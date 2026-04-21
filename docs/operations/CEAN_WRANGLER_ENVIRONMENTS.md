# Wrangler Environment Configuration - CEAN

**File:** `myai/agents/workers/cean-test/wrangler.toml`  
**Updated:** 2026-02-15  
**Purpose:** Multi-environment Cloudflare Workers configuration

---

## 🌍 Environment Targets

```toml
# Main configuration (inherited by all environments)
name = "cean-test"
main = "src/index.ts"
compatibility_date = "2024-11-01"
type = "service"

# Observability
observability = { enabled = true }

# Analytics Engine (for metrics)
analytics_engine_datasets = []

# Services (KV, D1, R1)
[services]
# These are inherited by all environments

# ============================================================================
# DEVELOPMENT ENVIRONMENT
# ============================================================================
[env.development]
name = "cean-test-dev"
route = "*/cean-test-dev.example.com/*"
zone_id = "ZONE_ID_DEV"  # Replace with your zone
account_id = "ACCOUNT_ID"  # From wrangler whoami

[env.development.vars]
ENVIRONMENT = "development"
API_BASE_URL = "https://cean-test-dev.example.com"
LOG_LEVEL = "debug"
D1_DATABASE = "cean-dev"
R1_BUCKET = "cean-data-dev"

[[env.development.d1_databases]]
binding = "DB"
database_name = "cean-dev"
database_id = "YOUR_DEV_DB_ID"

[[env.development.r2_buckets]]
binding = "STORAGE"
bucket_name = "cean-data-dev"

# ============================================================================
# STAGING ENVIRONMENT
# ============================================================================
[env.staging]
name = "cean-test-staging"
route = "*/cean-test-staging.example.com/*"
zone_id = "ZONE_ID_STAGING"  # Replace with your zone
account_id = "ACCOUNT_ID"

[env.staging.vars]
ENVIRONMENT = "staging"
API_BASE_URL = "https://cean-test-staging.example.com"
LOG_LEVEL = "info"
D1_DATABASE = "cean-staging"
R1_BUCKET = "cean-data-staging"

[[env.staging.d1_databases]]
binding = "DB"
database_name = "cean-staging"
database_id = "YOUR_STAGING_DB_ID"

[[env.staging.r2_buckets]]
binding = "STORAGE"
bucket_name = "cean-data-staging"

# ============================================================================
# PRODUCTION ENVIRONMENT
# ============================================================================
[env.production]
name = "cean-test"  # No suffix for prod
route = "*/cean-test.example.com/*"
zone_id = "ZONE_ID_PROD"  # Replace with your zone
account_id = "ACCOUNT_ID"

[env.production.vars]
ENVIRONMENT = "production"
API_BASE_URL = "https://cean-test.example.com"
LOG_LEVEL = "warn"
D1_DATABASE = "cean-prod"
R1_BUCKET = "cean-data-prod"

[[env.production.d1_databases]]
binding = "DB"
database_name = "cean-prod"
database_id = "YOUR_PROD_DB_ID"

[[env.production.r2_buckets]]
binding = "STORAGE"
bucket_name = "cean-data-prod"

# Analytics for production
[env.production.analytics_engine_datasets]
binding = "ANALYTICS"
```

---

## 📝 Configuration Guide

### Environment Variables

**Available in all environments:**
- `ENVIRONMENT`: dev/staging/production
- `API_BASE_URL`: Worker URL
- `LOG_LEVEL`: debug/info/warn/error
- `D1_DATABASE`: SQLite database name
- `R1_BUCKET`: Object storage bucket

### Database Bindings

**D1 (SQLite):**
```typescript
// In worker code
const db = env.DB;
const result = await db.prepare('SELECT * FROM edge_tasks').all();
```

**R2 (Object Storage):**
```typescript
// In worker code
const bucket = env.STORAGE;
const data = await bucket.get('my-key');
```

---

## 🚀 Deployment Commands

```bash
# Deploy to development
wrangler deploy --env development

# Deploy to staging
wrangler deploy --env staging

# Deploy to production
wrangler deploy --env production

# Promote from staging to production
wrangler deploy --env staging --env production
```

---

## 🔧 Local Development

```bash
# Run with development config
wrangler dev --env development

# Run specific route
wrangler dev --env development --ip 127.0.0.1 --port 8787
```

---

## 📊 Environment Comparison

| Feature | Dev | Staging | Prod |
|---------|-----|---------|------|
| **Log Level** | debug | info | warn |
| **D1 Database** | cean-dev | cean-staging | cean-prod |
| **R2 Bucket** | cean-data-dev | cean-data-staging | cean-data-prod |
| **Health Check** | Automatic | Automatic | Automatic |
| **Cost** | €0 (free tier) | €0 (free tier) | €0 (free tier, 100k req/mo) |

---

## ✅ Verification Checklist

- [ ] Update `ZONE_ID_DEV`, `ZONE_ID_STAGING`, `ZONE_ID_PROD` with your Cloudflare zone IDs
- [ ] Update `YOUR_DEV_DB_ID`, `YOUR_STAGING_DB_ID`, `YOUR_PROD_DB_ID` with actual D1 IDs
- [ ] Run `wrangler deploy --dry-run --env production` to validate config
- [ ] Run `wrangler dev --env development` to test locally

---

## 🔗 References

- [Wrangler Configuration](https://developers.cloudflare.com/workers/wrangler/configuration/)
- [D1 Bindings](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/)
- [R2 Bindings](https://developers.cloudflare.com/r2/api/workers/)
