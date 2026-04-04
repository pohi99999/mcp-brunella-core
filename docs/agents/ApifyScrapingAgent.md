# ApifyScrapingAgent

**Agent Name:** `ApifyScraping`
**Source:** `src/agents/ApifyScrapingAgent.ts`
**Role:** Research & Intelligence — Deep Web Scraper

## Description

Apify platform-alapú professzionális scraping: Google, LinkedIn, e-commerce, trendek

## Capabilities

- `google_search`
- `linkedin_leads`
- `ecommerce_scrape`
- `trend_analysis`
- `social_media`

## Inputs / Outputs

- **Primary input:** Task string + optional context object.
- **Primary output:** Agent result/response object.

## Operational Notes

- Generated automatically by `ProjectConductorAgent` during `conductor sync`.
- `myai/agents/tech_harvester.py` already routes `type: "apify"` sources to `http://localhost:3000/api/agents/ApifyScraping/execute`.
- `myai/config/sources.json` contains enabled Apify sources for Google, LinkedIn, Amazon, and Twitter.
- Missing `APIFY_API_TOKEN` returns a graceful error and keeps the rest of the pipeline alive.

## Usage Example

```ts
const result = await agent.execute('Keress cégeket', {
  capability: 'google',
  query: 'logistics startups 2026',
  limit: 10,
});
```

## Failure Modes

- No `APIFY_API_TOKEN` → error response with setup hint.
- LinkedIn scraping still depends on Apify-side cookies/session state.
- If the Apify actor fails, the caller gets an empty result set or error response, depending on the entry point.
