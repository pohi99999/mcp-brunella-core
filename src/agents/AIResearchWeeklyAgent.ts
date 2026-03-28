import { BaseAgent, type AgentContext, type AgentResult } from './BaseAgent.js';
import { generateRouted } from '../core/llm_client.js';
import { crawl4aiCrawlHandler } from '../tools/crawl4aiTool.js';
import { writeMarkdownReport } from '../utils/reportWriter.js';
import { logInfo, logWarn, logError, setAgentStatus } from '../utils/logger.js';
import type { CrawlResult } from '../utils/pythonBridge.js';

interface WeeklyResearchSource {
  name: string;
  url: string;
}

interface GitHubRepoSignal {
  kind: 'github_repo';
  query: string;
  fullName: string;
  description: string;
  url: string;
  stars: number;
  language: string;
  updatedAt: string;
}

interface WebPageSignal {
  kind: 'web_page';
  source: string;
  title: string;
  url: string;
  summary: string;
  excerpt: string;
  status: 'success' | 'blocked' | 'failed';
}

type WeeklyResearchSignal = GitHubRepoSignal | WebPageSignal;

interface WeeklyResearchConfig {
  reportDate: string;
  reportTitle: string;
  reportType: string;
  outputDir: string;
  lookbackDays: number;
  githubQueries: string[];
  sourcePages: WeeklyResearchSource[];
  maxGitHubResults: number;
  maxExcerptLength: number;
  topics: string[];
  tags: string[];
}

interface WeeklyResearchSummary {
  markdown: string;
  usedFallback: boolean;
  provider?: string;
  model?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const items = value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean);
  return items.length > 0 ? items : fallback;
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength).trim()}…`;
}

function normalizeDate(date = new Date()): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function subtractDays(date: Date, days: number): string {
  const copy = new Date(date);
  copy.setDate(copy.getDate() - days);
  return normalizeDate(copy);
}

function cleanMarkdown(value: string): string {
  const trimmed = value.trim();
  const fenced = trimmed.match(/^```(?:markdown)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) {
    return fenced[1].trim();
  }

  return trimmed;
}

function parseConfig(context: AgentContext): WeeklyResearchConfig {
  const topLevelContext = isRecord(context) ? context : {};
  const nestedContext = isRecord(topLevelContext.context) ? topLevelContext.context : {};
  const metadata = { ...nestedContext, ...topLevelContext };
  const lookbackDays = typeof metadata.lookbackDays === 'number' && Number.isFinite(metadata.lookbackDays)
    ? Math.max(1, Math.floor(metadata.lookbackDays))
    : 7;
  const reportDate = typeof metadata.reportDate === 'string' && metadata.reportDate.trim()
    ? metadata.reportDate.trim()
    : normalizeDate();
  const reportTitle = typeof metadata.reportTitle === 'string' && metadata.reportTitle.trim()
    ? metadata.reportTitle.trim()
    : 'Heti AI Ökoszisztéma Figyelő';
  const reportType = typeof metadata.reportType === 'string' && metadata.reportType.trim()
    ? metadata.reportType.trim()
    : 'weekly_ai_ecosystem_watch';
  const outputDir = typeof metadata.reportOutputDir === 'string' && metadata.reportOutputDir.trim()
    ? metadata.reportOutputDir.trim()
    : 'docs/001_Jelentés';
  const maxGitHubResults = typeof metadata.maxGitHubResults === 'number' && Number.isFinite(metadata.maxGitHubResults)
    ? Math.max(1, Math.floor(metadata.maxGitHubResults))
    : 4;
  const maxExcerptLength = typeof metadata.maxExcerptLength === 'number' && Number.isFinite(metadata.maxExcerptLength)
    ? Math.max(800, Math.floor(metadata.maxExcerptLength))
    : 3500;

  const defaultQueries = [
    'topic:ai-agent sort:updated stars:>50',
    'topic:agentic sort:updated stars:>50',
    'topic:mcp sort:updated stars:>50',
    'browser automation playwright agent sort:updated stars:>25',
  ];

  const defaultSourcePages: WeeklyResearchSource[] = [
    { name: 'GitHub Changelog', url: 'https://github.blog/changelog/' },
    { name: 'Chrome DevTools - What\'s New', url: 'https://developer.chrome.com/docs/devtools/whatsnew/' },
    { name: 'Google AI Blog', url: 'https://blog.google/technology/ai/' },
    { name: 'Microsoft AI Foundry', url: 'https://www.microsoft.com/en-us/ai/ai-foundry' },
    { name: 'LangChain Blog', url: 'https://blog.langchain.dev/' },
    { name: 'Anthropic News', url: 'https://www.anthropic.com/news' },
    { name: 'OpenAI News', url: 'https://openai.com/news/' },
  ];

  const githubQueries = asStringArray(metadata.githubQueries, defaultQueries);
  const parsedSourcePages = Array.isArray(metadata.sourcePages)
    ? metadata.sourcePages
        .map((entry): WeeklyResearchSource | null => {
          if (!isRecord(entry)) return null;
          const name = typeof entry.name === 'string' ? entry.name.trim() : '';
          const url = typeof entry.url === 'string' ? entry.url.trim() : '';
          return name && url ? { name, url } : null;
        })
        .filter((entry): entry is WeeklyResearchSource => entry !== null)
    : [];
  const sourcePages = parsedSourcePages.length > 0 ? parsedSourcePages : defaultSourcePages;

  const topics = asStringArray(metadata.topics, [
    'GitHub open source AI agent framework updates',
    'Chrome DevTools / browser automation updates',
    'Google AI / Gemini updates',
    'Azure AI Foundry updates',
    'AI agent ecosystem experiments and releases',
  ]);
  const tags = asStringArray(metadata.tags, [
    'weekly',
    'ai',
    'research',
    'agents',
    'foundry',
  ]);

  return {
    reportDate,
    reportTitle,
    reportType,
    outputDir,
    lookbackDays,
    githubQueries,
    sourcePages,
    maxGitHubResults,
    maxExcerptLength,
    topics,
    tags,
  };
}

async function fetchGitHubQueryResults(query: string, maxResults: number): Promise<GitHubRepoSignal[]> {
  const url = new URL('https://api.github.com/search/repositories');
  url.searchParams.set('q', query);
  url.searchParams.set('sort', 'updated');
  url.searchParams.set('order', 'desc');
  url.searchParams.set('per_page', String(maxResults));

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'Brunella-AIResearchWeekly',
      ...(process.env.GITHUB_PAT || process.env.GITHUB_TOKEN
        ? { Authorization: `Bearer ${process.env.GITHUB_PAT || process.env.GITHUB_TOKEN}` }
        : {}),
    },
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    throw new Error(`GitHub search failed (${response.status} ${response.statusText})`);
  }

  const payload: unknown = await response.json();
  if (!isRecord(payload) || !Array.isArray(payload.items)) {
    return [];
  }

  return payload.items
    .slice(0, maxResults)
    .map((item): GitHubRepoSignal | null => {
      if (!isRecord(item)) {
        return null;
      }

      const fullName = typeof item.full_name === 'string' ? item.full_name : '';
      const description = typeof item.description === 'string' ? item.description : '';
      const htmlUrl = typeof item.html_url === 'string' ? item.html_url : '';
      const updatedAt = typeof item.updated_at === 'string' ? item.updated_at : '';
      const stars = typeof item.stargazers_count === 'number' ? item.stargazers_count : 0;
      const language = typeof item.language === 'string' ? item.language : 'unknown';

      if (!fullName || !htmlUrl) {
        return null;
      }

      return {
        kind: 'github_repo',
        query,
        fullName,
        description,
        url: htmlUrl,
        stars,
        language,
        updatedAt,
      };
    })
    .filter((item): item is GitHubRepoSignal => item !== null);
}

async function fetchPageSignal(source: WeeklyResearchSource, maxExcerptLength: number): Promise<WebPageSignal> {
  try {
    const result = await crawl4aiCrawlHandler({ url: source.url });
    if (!result.success || !result.data) {
      return {
        kind: 'web_page',
        source: source.name,
        title: source.name,
        url: source.url,
        summary: result.error || 'A crawl4ai nem adott vissza érvényes választ.',
        excerpt: '',
        status: 'failed',
      };
    }

    const crawl = result.data as CrawlResult;
    const title = crawl.title?.trim() || source.name;
    const summary = crawl.description?.trim() || 'Nincs külön leírás.';
    const excerptSource = crawl.markdown?.trim() || crawl.description?.trim() || '';
    const excerpt = truncate(excerptSource, maxExcerptLength);

    return {
      kind: 'web_page',
      source: source.name,
      title,
      url: crawl.url || source.url,
      summary,
      excerpt,
      status: crawl.status,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      kind: 'web_page',
      source: source.name,
      title: source.name,
      url: source.url,
      summary: errorMessage,
      excerpt: '',
      status: 'failed',
    };
  }
}

function buildFallbackMarkdown(config: WeeklyResearchConfig, signals: WeeklyResearchSignal[]): string {
  const githubSignals = signals.filter((signal): signal is GitHubRepoSignal => signal.kind === 'github_repo');
  const pageSignals = signals.filter((signal): signal is WebPageSignal => signal.kind === 'web_page');

  const lines: string[] = [
    `# ${config.reportTitle}`,
    '',
    `**Dátum:** ${config.reportDate}`,
    `**Időszak:** ${subtractDays(new Date(config.reportDate), config.lookbackDays)} – ${config.reportDate}`,
    '',
    '## Vezető összefoglaló',
    '',
    `A heti automatikus kutatás ${signals.length} jelet gyűjtött össze ${config.githubQueries.length} GitHub keresésből és ${pageSignals.length} forráspage-ből.`,
    '',
    '## Talált újdonságok',
    '',
  ];

  if (githubSignals.length > 0) {
    lines.push('### GitHub / open source', '');
    for (const signal of githubSignals.slice(0, 8)) {
      lines.push(`- **${signal.fullName}** (${signal.language}, ${signal.stars} csillag)`);
      lines.push(`  - Miért érdekes: ${truncate(signal.description || 'Nincs leírás.', 220)}`);
      lines.push(`  - Forrás: ${signal.url}`);
    }
    lines.push('');
  }

  if (pageSignals.length > 0) {
    lines.push('### Chrome / Google / Foundry / agent framework oldalak', '');
    for (const signal of pageSignals) {
      lines.push(`- **${signal.source}**`);
      lines.push(`  - Állapot: ${signal.status}`);
      lines.push(`  - Rövid összefoglaló: ${truncate(signal.summary, 220)}`);
      if (signal.excerpt) {
        lines.push(`  - Kivonat: ${truncate(signal.excerpt, 240)}`);
      }
      lines.push(`  - Forrás: ${signal.url}`);
    }
    lines.push('');
  }

  lines.push(
    '## Brunella-hasznosítási javaslatok',
    '',
    '- Frissíthető a Researcher/MarketIntel szolgáltatásainak forráslistája a talált trendek alapján.',
    '- A Chrome DevTools és browser automation frissítésekből érdemes automatizált regressziós teszt csomagot frissíteni.',
    '- A GitHub open source találatokból külön monitoring lista készíthető a BAS kompatibilis agent frameworköknek.',
    '',
    '## Következő heti figyelőlista',
    '',
    '- Ugyanezeket a forrásokat érdemes újra lekérni és a változásokat diffelni.',
    '- Ha valamelyik forrás új release-t hoz, azonnal külön taskot kell nyitni a Brunella integrációs lehetőségekre.',
    '',
  );

  return lines.join('\n');
}

async function buildMarkdownSummary(config: WeeklyResearchConfig, signals: WeeklyResearchSignal[]): Promise<WeeklyResearchSummary> {
  const payload = {
    date: config.reportDate,
    lookbackDays: config.lookbackDays,
    topics: config.topics,
    githubQueries: config.githubQueries,
    signals: signals.map((signal) => signal.kind === 'github_repo'
      ? {
          kind: signal.kind,
          query: signal.query,
          fullName: signal.fullName,
          description: signal.description,
          url: signal.url,
          stars: signal.stars,
          language: signal.language,
          updatedAt: signal.updatedAt,
        }
      : {
          kind: signal.kind,
          source: signal.source,
          title: signal.title,
          url: signal.url,
          summary: signal.summary,
          excerpt: signal.excerpt,
          status: signal.status,
        }),
  };

  const prompt = `
Te a Brunella heti AI ökoszisztéma kutató ügynöke vagy.

Feladat:
- A megadott jelzésekből készíts magyar nyelvű, letisztult markdown riportot.
- Csak a megadott adatokra támaszkodj; ha valami nem bizonyított, írd le hogy "nem megerősített".
- Minden fontos megállapítás mellé adj egy rövid "Miért fontos a Brunella számára" részt.
- A riport legyen konkrét, gyakorlati és cselekvésorientált.

Kötelező szekciók:
# ${config.reportTitle}
## Vezető összefoglaló
## Talált újdonságok
### GitHub / open source
### Chrome DevTools / böngésző automatizálás
### Google / Foundry
### AI agent frameworkök
## Brunella-hasznosítási javaslatok
## Következő heti figyelőlista

Jelzések JSON:
${JSON.stringify(payload, null, 2)}

Kimenet:
- Csak markdown, magyarázat nélkül.
- Ne használj code fence-et.
- Minimum 5, maximum 10 konkrét javaslatot adj.
`.trim();

  try {
    const routed = await generateRouted(prompt, 'weekly ai ecosystem report synthesis');
    const markdown = cleanMarkdown(routed.response);
    return {
      markdown: markdown.startsWith('#') ? markdown : `# ${config.reportTitle}\n\n${markdown}`,
      usedFallback: false,
      provider: routed.decision.model.provider,
      model: routed.decision.model.name,
    };
  } catch (error) {
    logWarn('AIResearchWeeklyAgent', `LLM összegzés sikertelen, fallback riport készül: ${error}`);
    return {
      markdown: buildFallbackMarkdown(config, signals),
      usedFallback: true,
    };
  }
}

export class AIResearchWeeklyAgent extends BaseAgent {
  name = 'AIResearchWeekly';
  role = 'Weekly AI Ecosystem Scout';
  description = 'Heti, ismétlődő kutató-felderítő ügynök, amely GitHub, Chrome DevTools, Google, Foundry és az AI agent ökoszisztéma frissítéseit gyűjti össze és markdown riportot ír.';
  capabilities = [
    'web_research',
    'github_signal_collection',
    'official_updates_monitoring',
    'markdown_report_generation',
    'weekly_digest',
  ];

  async executeTask(context: AgentContext): Promise<AgentResult> {
    const task = (context.task || '').trim();
    const config = parseConfig(context);
    const startedAt = new Date().toISOString();

    setAgentStatus(this.name, 'working', task.slice(0, 80) || config.reportTitle);
    logInfo(this.name, `Heti kutatás indítása: ${config.reportDate}`);

    try {
      const githubSignals: GitHubRepoSignal[] = [];
      for (const query of config.githubQueries) {
        try {
          const results = await fetchGitHubQueryResults(query, config.maxGitHubResults);
          githubSignals.push(...results);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          logWarn(this.name, `GitHub keresés sikertelen (${query}): ${message}`);
        }
      }

      const pageSignals = await Promise.all(
        config.sourcePages.map((source) => fetchPageSignal(source, config.maxExcerptLength)),
      );

      const uniqueGithubSignals = githubSignals.filter((signal, index, all) => (
        index === all.findIndex((candidate) => candidate.fullName === signal.fullName && candidate.query === signal.query)
      ));

      const signals: WeeklyResearchSignal[] = [...uniqueGithubSignals, ...pageSignals];
      const summary = await buildMarkdownSummary(config, signals);
      const periodStart = subtractDays(new Date(`${config.reportDate}T12:00:00`), config.lookbackDays);
      const reportPath = await writeMarkdownReport(
        {
          title: config.reportTitle,
          date: config.reportDate,
          generatedAt: startedAt,
          generatedBy: this.name,
          reportType: config.reportType,
          periodStart,
          periodEnd: config.reportDate,
          sources: signals.map((signal) => signal.kind === 'github_repo' ? signal.url : signal.url),
          tags: config.tags,
          extra: {
            lookbackDays: config.lookbackDays,
            githubQueries: config.githubQueries,
            sourcePages: config.sourcePages.map((source) => source.url),
            signalCount: signals.length,
            githubCount: uniqueGithubSignals.length,
            pageCount: pageSignals.length,
            summaryProvider: summary.provider || 'fallback',
            summaryModel: summary.model || 'fallback',
            usedFallback: summary.usedFallback,
          },
        },
        summary.markdown,
        config.outputDir,
        `${config.reportDate}.md`,
      );

      logInfo(this.name, `Heti jelentés elkészült: ${reportPath}`);

      return {
        success: true,
        message: `Heti kutatási jelentés elkészült: ${reportPath}`,
        data: {
          reportPath,
          reportDate: config.reportDate,
          reportTitle: config.reportTitle,
          signalCount: signals.length,
          githubCount: uniqueGithubSignals.length,
          pageCount: pageSignals.length,
          topics: config.topics,
          sources: signals.map((signal) => signal.kind === 'github_repo'
            ? { kind: signal.kind, title: signal.fullName, url: signal.url }
            : { kind: signal.kind, title: signal.title, url: signal.url, status: signal.status }),
          usedFallback: summary.usedFallback,
          summaryProvider: summary.provider || null,
          summaryModel: summary.model || null,
        },
        metadata: {
          reportPath,
          reportDate: config.reportDate,
          reportType: config.reportType,
          lookbackDays: config.lookbackDays,
          sourceCount: signals.length,
          usedFallback: summary.usedFallback,
        },
        contextUsed: signals.map((signal) => signal.kind === 'github_repo' ? signal.fullName : signal.source),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logError(this.name, `Heti kutatás hiba: ${message}`);

      return {
        success: false,
        message: `A heti kutatási riport elkészítése nem sikerült: ${message}`,
      };
    } finally {
      setAgentStatus(this.name, 'idle');
    }
  }
}

export default AIResearchWeeklyAgent;
