# External Knowledge Pipeline MVP

## Purpose

This document describes the first safe integration slice for staged external knowledge ingestion in Brunella.

The goal is to make external web and YouTube knowledge usable **without** allowing raw internet content to flow directly into long-term reusable memory.

## Architectural rule

External content must move through these stages:

1. `raw` source capture
2. `screened` source normalization + chunking
3. `provisional` knowledge card creation
4. governance review queue
5. `canonical` promotion
6. canonical-only retrieval indexing

Raw or screened source text must **not** be indexed directly into canonical RAG retrieval.

## Implemented surfaces

### Service layer

- `src/server/services/externalKnowledgeService.ts`
  - SQLite schema bootstrap for staged sources, chunks, and knowledge cards
  - web ingest
  - YouTube transcript ingest
  - provisional card creation
  - governance review queue
  - canonical promotion
  - keyword + semantic search over knowledge cards

### REST API

- `POST /api/v1/knowledge/sources/web`
- `POST /api/v1/knowledge/sources/youtube`
- `POST /api/v1/knowledge/cards`
- `GET /api/v1/knowledge/review-queue`
- `POST /api/v1/knowledge/cards/:cardId/promote`
- `GET /api/v1/knowledge/search`
- `GET /api/v1/knowledge/health`

### MCP tools

- `source_ingest_web`
- `source_ingest_youtube`
- `knowledge_create_card`
- `governance_review_queue`
- `knowledge_promote`
- `knowledge_card_search`

### CLI surface

- `brunella knowledge beolvas-web <url>`
- `brunella knowledge beolvas-youtube <url> --transcript-file <path>`
- `brunella knowledge kartya --source-ids ... --summary ... --claims ...`
- `brunella knowledge sor`
- `brunella knowledge keres <query>`
- `brunella knowledge promotal <cardId> --reviewer <name>`

## Data model

### `external_knowledge_sources`

Stores the original source record:

- source type (`web` or `youtube`)
- lifecycle state (`raw`, `screened`, `deprecated`)
- URL
- author / channel
- language
- raw and normalized text
- metadata JSON
- dedupe hash

### `external_knowledge_chunks`

Stores chunked source text for staging and later synthesis.

### `knowledge_cards`

Stores reusable knowledge items:

- title
- lifecycle state (`provisional`, `canonical`, `deprecated`)
- summary
- claims
- evidence
- tags / entities
- source references
- score set
- confidence
- reviewer note and promotion metadata

## Promotion rules in the MVP

The MVP is intentionally conservative.

- Only `provisional` cards can be promoted.
- Promotion requires a reviewer identity.
- Single-source promotion additionally requires an explicit reviewer note.
- Promotion triggers canonical RAG indexing under the `knowledge_card:<id>` prefix.

## Search behavior

The search endpoint and MCP tool query **knowledge cards**, not raw source rows.

The implementation merges:

- SQLite keyword matching on title + summary
- semantic retrieval via existing RAG search

Only `canonical` cards are returned by default. `provisional` cards are opt-in.

## Current limitations

This MVP deliberately does **not** implement:

- NotebookLM briefing ingest
- automatic claim verification
- trust/freshness policy enforcement beyond stored score metadata
- reranker integration
- dashboard panel
- automatic multi-agent synthesis pipeline

## Recommended next steps

1. Add NotebookLM briefing ingest as a staged connector.
2. Add automated claim verification helpers.
3. Add richer score policies for trust/freshness/novelty thresholds.
4. Add dashboard review queue visibility.
5. Add a dedicated librarian/critic agent once the service contracts are stable.
