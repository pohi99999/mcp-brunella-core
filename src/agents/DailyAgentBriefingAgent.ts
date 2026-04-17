/**
 * @fileoverview DailyAgentBriefingAgent — Napi AI Agent Összefoglaló
 *
 * Minden nap 11:00-kor összegyűjti az AI agent ökoszisztéma legfontosabb
 * híreit (GitHub Search API + crawl4ai), LLM segítségével leképezi a
 * Brunella architektúra rétegeire, majd strukturált magyar összefoglalót
 * generál és sqlite-ba menti.
 *
 * Az agent az AIResearchWeeklyAgent mintáját követi, de napi fókusszal
 * és AI-agent-specifikus lekérdezésekkel.
 */

import { promises as fs } from 'node:fs';
import { BaseAgent } from './BaseAgent.js';
import type { AgentContext, AgentResult } from './BaseAgent.js';
import { logError, logInfo, setAgentStatus } from '../utils/logger.js';
import { crawl4aiCrawlHandler } from '../tools/crawl4aiTool.js';
import { writeMarkdownReport } from '../utils/reportWriter.js';
import { generateRouted } from '../core/llm_client.js';

// ── Interfaces ────────────────────────────────────────────────────────────────

/** Configuration parsed from AgentContext */
interface DailyBriefingConfig {
  /** Human-readable title printed in the report header */
  reportTitle: string;
  /** Output directory for markdown reports */
  reportOutputDir: string;
  /** How many days back to look (default 1 for daily) */
  lookbackDays: number;
  /** GitHub Search API queries */
  githubQueries: string[];
  /** Web pages to crawl for additional context */
  sourcePages: DailyBriefingSource[];
  /** Thematic topics to highlight in the LLM prompt */
  topics: string[];
  /** Report tags */
  tags: string[];
  /** Maximum GitHub results per query */
  maxGitHubResults: number;
  /** Maximum excerpt length from crawled pages (chars) */
  maxExcerptLength: number;
}

interface DailyBriefingSource {
  name: string;
  url: string;
}

/** A single signal gathered from GitHub Search API */
interface GitHubSignal {
  title: string;
  url: string;
  fullName: string;
  description: string;
  stars: number;
  updatedAt: string;
  query: string;
  topics: string[];
}

/** A single signal gathered from a crawled web page */
interface WebPageSignal {
  name: string;
  url: string;
  excerpt: string;
  crawledAt: string;
}

/** A single item stored in the briefing report payload */
interface BriefingItem {
  title: string;
  source: string;
  excerpt: string;
  relevance: string;
  brunellaLayers: string[];
  adoptionStatus?: AdoptionStatus;
  adoptionNote?: string;
  url?: string;
  publishedAt?: string;
}

/** Recommended Brunella adoption level for a research signal */
type AdoptionStatus = 'adopt' | 'prototype' | 'watch';

interface AdoptionAssessment {
  status: AdoptionStatus;
  note: string;
}

/** Combined signal fed to the LLM summary builder */
interface CombinedSignals {
  github: GitHubSignal[];
  pages: WebPageSignal[];
}

/** Output of the LLM summary step */
interface BriefingSummary {
  markdown: string;
  usedLLM: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Type guard for unknown → Record<string, unknown> */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Safely coerce an unknown value to string[], falling back to `fallback` */
function asStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  return value.filter((v): v is string => typeof v === 'string');
}

/** Truncate a string to `maxLength` chars, appending `…` if truncated */
function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength)}…`;
}

/** Format a Date as `YYYY-MM-DD` */
function normalizeDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/** Return `YYYY-MM-DD` string for `date` minus `days` calendar days */
function subtractDays(date: Date, days: number): string {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() - days);
  return normalizeDate(d);
}

/** Strip fenced code block markers from an LLM response */
function cleanMarkdown(value: string): string {
  return value
    .replace(/^```(?:markdown)?\n?/i, '')
    .replace(/\n?```$/i, '')
    .trim();
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function inferBrunellaLayers(text: string): string[] {
  const normalized = text.toLowerCase();
  const layers = new Set<string>();

  if (/(memory|memoria|vector|embedding|rag|knowledge)/i.test(normalized)) {
    layers.add('memoria');
  }
  if (/(webhook|api|integration|gateway|tool|route|connector|mcp)/i.test(normalized)) {
    layers.add('nexus');
  }
  if (/(dashboard|ui|frontend|browser|panel|ux|interface)/i.test(normalized)) {
    layers.add('interface');
  }
  if (/(workflow|orchestration|pipeline|multi-agent|agentic|schedule|conductor)/i.test(normalized)) {
    layers.add('conductor');
  }
  if (/(factory|generate|automation|deploy|publish|build)/i.test(normalized)) {
    layers.add('fabrica');
  }
  if (/(llm|prompt|reasoning|model|release|benchmark|research|analysis)/i.test(normalized)) {
    layers.add('cortex');
  }

  return layers.size > 0 ? Array.from(layers) : ['cortex'];
}

function assessBrunellaAdoption(signal: GitHubSignal): AdoptionAssessment {
  const fingerprint = [
    signal.title,
    signal.fullName,
    signal.description,
    signal.query,
    signal.topics.join(' '),
  ].join(' ').toLowerCase();

  if (/(skill[- ]optimizer|tool guidance|guidance benchmark)/i.test(fingerprint)) {
    return {
      status: 'adopt',
      note: 'Közvetlenül hasznos a skill / MCP útmutatók és tool-használat benchmarkolására.',
    };
  }

  if (/(zt[- ]agentshield|chaeos-env|solace-agent-mesh|auto-review-claudemcp)/i.test(fingerprint)) {
    return {
      status: 'prototype',
      note: 'Jó prototípus-jelölt: execution-boundary védelem, fault injection, event-driven orchestration vagy PR-review automatizálás.',
    };
  }

  if (/(ai-agent-pulse|polis|multi-agent-shogun|agentic-reasoning-lab|agentic-ai-systems|neuroops|aura-cli)/i.test(fingerprint)) {
    return {
      status: 'watch',
      note: 'Érdemes figyelni, de jelenleg inkább referencia és inspiráció a Brunella számára.',
    };
  }

  return {
    status: 'watch',
    note: 'Általános piaci jelzés; most nincs közvetlen beépítési út.',
  };
}

function buildAdoptionBlock(githubSignals: GitHubSignal[]): string {
  const notes = githubSignals
    .map((signal) => ({ signal, adoption: assessBrunellaAdoption(signal) }))
    .filter(({ adoption }) => adoption.status !== 'watch');

  if (notes.length === 0) {
    return '';
  }

  const lines = ['## Brunella adoption shortlist', ''];
  for (const { signal, adoption } of notes) {
    lines.push(`- **${signal.title}** — ${adoption.status.toUpperCase()}: ${adoption.note}`);
  }
  lines.push('');
  return lines.join('\n');
}

function buildBriefingItems(
  githubSignals: GitHubSignal[],
  pageSignals: WebPageSignal[],
): BriefingItem[] {
  const githubItems = githubSignals.map((signal) => {
    const layers = inferBrunellaLayers(
      [signal.title, signal.fullName, signal.description, signal.query, signal.topics.join(' ')].join(' '),
    );
    const adoption = assessBrunellaAdoption(signal);

    return {
      title: signal.title || signal.fullName,
      source: 'GitHub',
      url: signal.url || undefined,
      excerpt: signal.description || 'Nincs leírás.',
      relevance: `Lekérdezés: ${signal.query} · ${signal.stars} csillag · ${
        signal.topics.length > 0 ? signal.topics.join(', ') : 'nincs topic'
      }`,
      brunellaLayers: uniqueStrings(layers),
      adoptionStatus: adoption.status,
      adoptionNote: adoption.note,
      publishedAt: signal.updatedAt || undefined,
    };
  });

  const pageItems = pageSignals
    .filter((signal) => signal.excerpt.length > 0)
    .map((signal) => ({
      title: signal.name,
      source: signal.name,
      url: signal.url,
      excerpt: signal.excerpt,
      relevance: 'Crawl4AI kivonat a napi briefinghez.',
      brunellaLayers: uniqueStrings(inferBrunellaLayers(`${signal.name} ${signal.excerpt}`)),
      publishedAt: signal.crawledAt,
    }));

  return [...githubItems, ...pageItems];
}

/**
 * Parse the agent context into a strongly-typed DailyBriefingConfig.
 * All fields have safe defaults so the agent runs even with an empty context.
 */
function parseConfig(context: AgentContext): DailyBriefingConfig {
  const raw = isRecord(context.context) ? context.context : {};
  const merged = { ...raw, ...context } as Record<string, unknown>;

  return {
    reportTitle: typeof merged.reportTitle === 'string'
      ? merged.reportTitle
      : 'Napi AI Agent Összefoglaló',

    reportOutputDir: typeof merged.reportOutputDir === 'string'
      ? merged.reportOutputDir
      : 'docs/001_Jelentés/briefing',

    lookbackDays: typeof merged.lookbackDays === 'number'
      ? merged.lookbackDays
      : 1,

    githubQueries: asStringArray(merged.githubQueries, [
      'AI agent framework release',
      'autonomous agent architecture 2025',
      'multi-agent system orchestration',
      'LLM tool use agent benchmark',
      'agent memory planning reasoning',
      'event-driven multi-agent orchestration',
      'tool use security agent',
      'LLM agent fault injection',
      'SDK CLI MCP guidance optimization',
      'code review GitHub PR agent',
    ]),

    sourcePages: Array.isArray(merged.sourcePages)
      ? (merged.sourcePages as DailyBriefingSource[])
      : [
          { name: 'LangChain Blog', url: 'https://blog.langchain.dev/' },
          { name: 'Anthropic News', url: 'https://www.anthropic.com/news' },
          { name: 'OpenAI News', url: 'https://openai.com/news/' },
          { name: 'Google AI Blog', url: 'https://blog.google/technology/ai/' },
          { name: 'Microsoft AI Foundry', url: 'https://www.microsoft.com/en-us/ai/ai-foundry' },
        ],

    topics: asStringArray(merged.topics, [
      'AI agent framework frissítések',
      'Multi-agent orchestráció fejlemények',
      'LLM tool use és reasoning előrelépések',
      'Agentic workflow minták',
      'AI agent memory és tervezés',
      'Tool security és execution boundary',
      'Guidance quality és skill optimalizálás',
      'Fault injection és benchmark',
    ]),

    tags: asStringArray(merged.tags, ['daily', 'ai-agents', 'briefing', 'research']),

    maxGitHubResults: typeof merged.maxGitHubResults === 'number'
      ? merged.maxGitHubResults
      : 5,

    maxExcerptLength: typeof merged.maxExcerptLength === 'number'
      ? merged.maxExcerptLength
      : 3000,
  };
}

/**
 * Fetch GitHub repository search results for a given query.
 * Uses GH_TOKEN / GITHUB_PAT / GITHUB_TOKEN from environment.
 *
 * @param query - GitHub search query string
 * @param maxResults - Maximum number of results to return
 * @returns Array of GitHubSignal objects
 */
async function fetchGitHubQueryResults(
  query: string,
  maxResults: number,
): Promise<GitHubSignal[]> {
  const token =
    process.env.GH_TOKEN ??
    process.env.GITHUB_PAT ??
    process.env.GITHUB_TOKEN ??
    '';

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'Brunella-DailyAgentBriefing',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const encoded = encodeURIComponent(query);
  const url = `https://api.github.com/search/repositories?q=${encoded}&sort=updated&per_page=${maxResults}`;

  try {
    const res = await fetch(url, { headers });
    if (!res.ok) {
      logError('DailyAgentBriefingAgent', `GitHub API error ${res.status} for query: ${query}`);
      return [];
    }

    const data = (await res.json()) as {
      items?: Array<{
        full_name?: string;
        html_url?: string;
        description?: string | null;
        stargazers_count?: number;
        updated_at?: string;
        name?: string;
        topics?: string[];
      }>;
    };

    return (data.items ?? []).slice(0, maxResults).map((item) => ({
      title: item.name ?? item.full_name ?? 'Ismeretlen',
      url: item.html_url ?? '',
      fullName: item.full_name ?? '',
      description: truncate(item.description ?? '', 200),
      stars: item.stargazers_count ?? 0,
      updatedAt: item.updated_at ?? '',
      query,
      topics: item.topics ?? [],
    }));
  } catch (err) {
    logError('DailyAgentBriefingAgent', `GitHub fetch failed for query "${query}": ${err}`);
    return [];
  }
}

/**
 * Crawl a single web page and return a WebPageSignal with an excerpt.
 *
 * @param source - Source name + URL
 * @param maxExcerptLength - Maximum chars to include in excerpt
 * @returns WebPageSignal (excerpt may be empty string if crawl fails)
 */
async function fetchPageSignal(
  source: DailyBriefingSource,
  maxExcerptLength: number,
): Promise<WebPageSignal> {
  const crawledAt = new Date().toISOString();
  try {
    const result = await crawl4aiCrawlHandler({ url: source.url });
    const raw = typeof result === 'string'
      ? result
      : (result as { markdown?: string; content?: string }).markdown
        ?? (result as { markdown?: string; content?: string }).content
        ?? '';
    return {
      name: source.name,
      url: source.url,
      excerpt: truncate(raw, maxExcerptLength),
      crawledAt,
    };
  } catch (err) {
    logError('DailyAgentBriefingAgent', `Page crawl failed for ${source.url}: ${err}`);
    return { name: source.name, url: source.url, excerpt: '', crawledAt };
  }
}

/**
 * Build a fallback markdown summary without LLM when model routing is unavailable.
 * Groups GitHub results by query and appends page excerpts.
 */
function buildFallbackMarkdown(
  config: DailyBriefingConfig,
  signals: CombinedSignals,
  reportDate: string,
): string {
  const lines: string[] = [
    `# ${config.reportTitle} — ${reportDate}`,
    '',
    '> ⚠️ Ez egy automatikus összefoglaló (LLM elemzés nélkül).',
    '',
    '## GitHub találatok',
    '',
  ];

  if (signals.github.length === 0) {
    lines.push('_Nem érkezett GitHub eredmény._', '');
  } else {
    for (const sig of signals.github) {
      lines.push(`### [${sig.title}](${sig.url})`);
      lines.push(`- **Leírás:** ${sig.description || '(nincs leírás)'}`);
      lines.push(`- **Csillagok:** ${sig.stars} ⭐`);
      lines.push(`- **Frissítve:** ${sig.updatedAt}`);
      lines.push(`- **Lekérdezés:** \`${sig.query}\``);
      lines.push('');
    }
  }

  const adoptionBlock = buildAdoptionBlock(signals.github);
  if (adoptionBlock) {
    lines.push(adoptionBlock.trim(), '');
  }

  lines.push('## Forrásoldal kivonatok', '');
  for (const page of signals.pages) {
    if (!page.excerpt) continue;
    lines.push(`### ${page.name}`);
    lines.push(`_${page.url}_`);
    lines.push('');
    lines.push(truncate(page.excerpt, 800));
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Build a structured markdown summary using LLM routing.
 * Falls back to `buildFallbackMarkdown` if the LLM call fails.
 *
 * @param config - Parsed briefing config
 * @param signals - Combined GitHub + page signals
 * @param reportDate - ISO date string (`YYYY-MM-DD`)
 * @returns BriefingSummary with the markdown content and whether LLM was used
 */
async function buildMarkdownSummary(
  config: DailyBriefingConfig,
  signals: CombinedSignals,
  reportDate: string,
): Promise<BriefingSummary> {
  const githubBlock = signals.github
    .map(
      (s) =>
        `- **${s.title}** (${s.stars}⭐): ${s.description}\n  URL: ${s.url}\n  Frissítve: ${s.updatedAt}`,
    )
    .join('\n');

  const pagesBlock = signals.pages
    .filter((p) => p.excerpt)
    .map((p) => `### ${p.name}\n${truncate(p.excerpt, 1500)}`)
    .join('\n\n');

  const prompt = `
Te egy AI agent ökoszisztéma elemző vagy. Ma ${reportDate} van.

Az alábbi nyers adatokat gyűjtöttem:

## GitHub találatok
${githubBlock || '(nincs adat)'}

## Brunella adoption shortlist
${buildAdoptionBlock(signals.github) || '(nincs azonnali átültetési jel)'}

## Forrásoldal kivonatok
${pagesBlock || '(nincs adat)'}

## Feladatod
Készíts strukturált, magyar nyelvű napi összefoglalót az alábbi formátumban:

1. **Rövid áttekintés** (3-5 mondat)
2. **Legfontosabb AI agent fejlemények** (felsorolás linkekkel)
3. **Brunella architektúra relevanciák** — az alábbi rétegek mindegyikéhez adj egy bekezdést, ha releváns:
   - cortex (LLM reasoning, promptok)
   - memoria (tudásbázis, vektortár)
   - corpus (adatpipeline)
   - nexus (integrációk, API-k)
   - fabrica (agent factory)
   - interface (UI/dashboard)
   - conductor (orchestráció, ütemezés)
4. **Brunella adoption notes** — a legértékesebb elemeket címkézd adopt / prototype / watch szerint, és mondd meg röviden, miért.
5. **Ajánlott következő lépések** Brunella számára (max 3 pont)

Légy tömör, informatív, és mindig hivatkozz az eredeti forrásokra ahol lehetséges.
  `.trim();

  try {
    const response = await generateRouted(prompt, 'daily ai agent briefing synthesis');
    const markdown = cleanMarkdown(
      typeof response === 'string' ? response : (response as { content?: string }).content ?? '',
    );

    if (!markdown) {
      return {
        markdown: buildFallbackMarkdown(config, signals, reportDate),
        usedLLM: false,
      };
    }

    return { markdown, usedLLM: true };
  } catch (err) {
    logError('DailyAgentBriefingAgent', `LLM summary failed, using fallback: ${err}`);
    return {
      markdown: buildFallbackMarkdown(config, signals, reportDate),
      usedLLM: false,
    };
  }
}

// ── Agent class ───────────────────────────────────────────────────────────────

/**
 * DailyAgentBriefingAgent
 *
 * Scheduled at 11:00 AM daily (cron: `0 11 * * *`).
 * Collects AI agent news from GitHub and web pages, synthesises a
 * Hungarian-language markdown briefing, persists it and optionally copies
 * it to the desktop.
 */
export class DailyAgentBriefingAgent extends BaseAgent {
  public readonly name = 'DailyAgentBriefing';
  public readonly role = 'Napi AI Agent Összefoglaló Kutató';
  public readonly description = 'Napi, ismétlődő kutató-felderítő ügynök, amely GitHub Search API és webcrawling segítségével összegyűjti az AI agent ökoszisztéma napi híreit, és strukturált magyar összefoglalót generál a Brunella architektúra rétegeihez.';

  /**
   * Execute the daily briefing pipeline.
   *
   * Steps:
   * 1. Parse config from AgentContext
   * 2. Set agent status to 'working'
   * 3. Collect GitHub signals (parallel queries)
   * 4. Collect web page signals (parallel crawls)
   * 5. Deduplicate GitHub signals by fullName+query
   * 6. Build LLM-powered markdown summary (fallback if LLM unavailable)
   * 7. Write markdown report to disk
   * 8. Optionally copy report to desktop
   * 9. Return structured AgentResult
   */
  async executeTask(context: AgentContext): Promise<AgentResult> {
    const config = parseConfig(context);
    const reportDate = normalizeDate(new Date());

    setAgentStatus(this.name, 'working', `Napi összefoglaló generálás: ${reportDate}`);

    logInfo('DailyAgentBriefingAgent', `Starting daily briefing for ${reportDate}`);

    try {
      // ── 1. Collect GitHub signals ───────────────────────────────────────────
      logInfo('DailyAgentBriefingAgent', `Fetching GitHub signals (${config.githubQueries.length} queries)...`);
      const githubResultSets = await Promise.all(
        config.githubQueries.map((q) =>
          fetchGitHubQueryResults(q, config.maxGitHubResults),
        ),
      );
      const rawGithubSignals = githubResultSets.flat();

      // Deduplicate by fullName+query to avoid identical entries from overlapping queries
      const seen = new Set<string>();
      const githubSignals: GitHubSignal[] = [];
      for (const sig of rawGithubSignals) {
        const key = `${sig.fullName}::${sig.query}`;
        if (!seen.has(key)) {
          seen.add(key);
          githubSignals.push(sig);
        }
      }
      logInfo('DailyAgentBriefingAgent', `GitHub signals collected: ${githubSignals.length} (deduplicated from ${rawGithubSignals.length})`);

      // ── 2. Collect web page signals ─────────────────────────────────────────
      logInfo('DailyAgentBriefingAgent', `Crawling ${config.sourcePages.length} source pages...`);
      const pageSignals = await Promise.all(
        config.sourcePages.map((src) => fetchPageSignal(src, config.maxExcerptLength)),
      );
      const successfulPages = pageSignals.filter((p) => p.excerpt.length > 0);
      logInfo('DailyAgentBriefingAgent', `Page signals collected: ${successfulPages.length}/${config.sourcePages.length} succeeded`);

      // ── 3. Build markdown summary ───────────────────────────────────────────
      const signals: CombinedSignals = { github: githubSignals, pages: pageSignals };
      const summary = await buildMarkdownSummary(config, signals, reportDate);
      logInfo('DailyAgentBriefingAgent', `Summary built (usedLLM=${summary.usedLLM})`);

      // ── 4. Calculate period window ──────────────────────────────────────────
      const periodStart = subtractDays(new Date(reportDate), config.lookbackDays);
      const items = buildBriefingItems(githubSignals, pageSignals);

      // ── 5. Write markdown report to disk ────────────────────────────────────
      const sources = [
        ...githubSignals.map((s) => s.url).filter(Boolean),
        ...config.sourcePages.map((s) => s.url),
      ];

      const reportPath = await writeMarkdownReport(
        {
          title: config.reportTitle,
          date: reportDate,
          generatedAt: new Date().toISOString(),
          generatedBy: this.name,
          reportType: 'daily_agent_briefing',
          periodStart,
          periodEnd: reportDate,
          sources,
          tags: config.tags,
          extra: {
            githubSignalsCount: githubSignals.length,
            pageSignalsCount: pageSignals.length,
            briefingItemsCount: items.length,
            usedLLM: summary.usedLLM,
          },
        },
        summary.markdown,
        config.reportOutputDir,
        `${reportDate}.md`,
      );

      logInfo('DailyAgentBriefingAgent', `Report written to: ${reportPath}`);

      // ── 6. Optional desktop copy (non-critical) ─────────────────────────────
      const desktopPath =
        process.env.BRUNELLA_BRIEFING_DESKTOP_PATH ??
        `E:\\OneDrive\\Desktop\\${reportDate}.md`;
      try {
        await fs.copyFile(reportPath, desktopPath);
        logInfo('DailyAgentBriefingAgent', `Összefoglaló másolva: ${desktopPath}`);
      } catch (copyErr) {
        logInfo(
          'DailyAgentBriefingAgent',
          `Asztali másolás nem sikerült (nem kritikus): ${copyErr}`,
        );
      }

      return {
        success: true,
        message: `Napi AI agent összefoglaló elkészült: ${reportDate}`,
        data: {
          reportPath,
          reportDate,
          periodStart,
          periodEnd: reportDate,
          githubSignalsCount: githubSignals.length,
          pageSignalsCount: pageSignals.length,
          briefingItemsCount: items.length,
          items,
          usedLLM: summary.usedLLM,
        },
        metadata: {
          agentName: this.name,
          reportType: 'daily_agent_briefing',
          tags: config.tags,
        },
        contextUsed: config.githubQueries,
      };
    } catch (error) {
      logError('DailyAgentBriefingAgent', `Briefing generation failed: ${error}`);
      return {
        success: false,
        message: `Napi AI agent összefoglaló hiba: ${String(error)}`,
        metadata: {
          agentName: this.name,
          reportType: 'daily_agent_briefing',
          tags: config.tags,
        },
      };
    } finally {
      setAgentStatus(this.name, 'idle', `Összefoglaló lezárva: ${reportDate}`);
    }
  }
}
