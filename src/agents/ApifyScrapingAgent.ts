import { IAgent, AgentResponse } from './types.js';
import { logInfo, logError, logWarn, setAgentStatus } from '../utils/logger.js';
import { ApifyClient } from 'apify-client';

/**
 * SearchResult - Google/Bing keresési eredmény
 */
export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  position?: number;
}

/**
 * LeadResult - LinkedIn/B2B lead adat
 */
export interface LeadResult {
  name: string;
  title?: string;
  company?: string;
  url: string;
  location?: string;
  email?: string;
}

/**
 * ProductResult - E-commerce termék adat
 */
export interface ProductResult {
  name: string;
  price?: string;
  currency?: string;
  url: string;
  imageUrl?: string;
  rating?: number;
  reviews?: number;
}

/**
 * TrendResult - Trend/Social media adat
 */
export interface TrendResult {
  topic: string;
  source: string;
  volume?: number;
  sentiment?: string;
  url?: string;
  timestamp?: string;
}

/**
 * ApifyScrapingAgent - Professional Web Scraping via Apify Platform
 * 
 * Apify platformon futó "actor"-okat használ (Google, LinkedIn, Amazon, Twitter).
 * Ha nincs APIFY_API_TOKEN → graceful fallback warning.
 */
type ApifyContext = Record<string, unknown>;

type ApifyResultItem = Record<string, unknown>;

type ApifyGoogleItem = ApifyResultItem & {
  title?: unknown;
  url?: unknown;
  description?: unknown;
  snippet?: unknown;
};

type ApifyLinkedInItem = ApifyResultItem & {
  fullName?: unknown;
  name?: unknown;
  headline?: unknown;
  title?: unknown;
  company?: unknown;
  url?: unknown;
  location?: unknown;
  email?: unknown;
};

type ApifyEcommerceItem = ApifyResultItem & {
  title?: unknown;
  name?: unknown;
  price?: unknown;
  url?: unknown;
  thumbnailImage?: unknown;
  image?: unknown;
  stars?: unknown;
  rating?: unknown;
  reviews?: unknown;
  reviewsCount?: unknown;
};

type ApifyTrendItem = ApifyResultItem & {
  retweetCount?: unknown;
  likeCount?: unknown;
  sentiment?: unknown;
  url?: unknown;
  createdAt?: unknown;
};

type ApifyDatasetListResponse = {
  items?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function readResultItems(items: unknown): ApifyResultItem[] {
  return Array.isArray(items) ? items.filter(isRecord) : [];
}

function normalizeContext(context?: Record<string, unknown>): ApifyContext {
  return isRecord(context)
    ? {
        capability: context.capability,
        query: context.query,
        url: context.url,
        limit: context.limit,
      }
    : {};
}

function normalizeArrayResult(result: unknown): unknown[] {
  return Array.isArray(result) ? result : [];
}

function extractFirstUrl(text: string): string | undefined {
  return text.match(/https?:\/\/[^\s]+/)?.[0];
}

export class ApifyScrapingAgent implements IAgent {
  name = 'ApifyScraping';
  role = 'Research & Intelligence — Deep Web Scraper';
  description = 'Apify platform-alapú professzionális scraping: Google, LinkedIn, e-commerce, trendek';
  capabilities = ['google_search', 'linkedin_leads', 'ecommerce_scrape', 'trend_analysis', 'social_media'];

  private client: ApifyClient | null = null;
  private isAvailable = false;

  async initialize(): Promise<void> {
    // Support both APIFY_API_TOKEN and APIFY_TOKEN for backward compatibility
    const token = process.env.APIFY_API_TOKEN ?? process.env.APIFY_TOKEN;
    
    if (!token || token === 'your_apify_token_here') {
      logWarn(this.name, 'APIFY_API_TOKEN (vagy APIFY_TOKEN) nincs beállítva - Apify funkciók nem elérhetők');
      logWarn(this.name, 'Szerezz API kulcsot: https://console.apify.com/account/integrations');
      this.isAvailable = false;
      return;
    }

    try {
      this.client = new ApifyClient({ token });
      this.isAvailable = true;
      logInfo(this.name, 'Apify kliens inicializálva sikeresen');
    } catch (error) {
      logError(this.name, `Apify inicializálás hiba: ${error instanceof Error ? error.message : String(error)}`);
      this.isAvailable = false;
    }
  }

  /**
   * runActor - Apify actor futtatás polling-gal
   */
  private async runActor<T extends ApifyResultItem = ApifyResultItem>(
    actorId: string,
    input: Record<string, unknown>,
    _timeoutMs = 60000,
  ): Promise<T[]> {
    if (!this.client || !this.isAvailable) {
      throw new Error('Apify kliens nem inicializált - APIFY_API_TOKEN hiányzik');
    }

    logInfo(this.name, `Actor futtatás: ${actorId}`);
    
    const run = await this.client.actor(actorId).call(input);
    
    // Dataset items lekérése
    const datasetResult: ApifyDatasetListResponse = await this.client.dataset(run.defaultDatasetId).listItems();
    const safeItems = readResultItems(datasetResult.items);

    logInfo(this.name, `Actor befejezve: ${safeItems.length} eredmény`);
    return safeItems as T[];
  }

  /**
   * googleSearch - Google keresés Apify-on keresztül
   */
  async googleSearch(query: string, limit = 10): Promise<SearchResult[]> {
    try {
      const items = await this.runActor<ApifyGoogleItem>('apify/google-search-scraper', {
        queries: query,
        maxResultsPerPage: limit,
        languageCode: 'hu', // Magyar eredmények preferálása
      });

      return items.map((item, index) => ({
        title: readText(item.title) ?? '',
        url: readText(item.url) ?? '',
        snippet: readText(item.description) ?? readText(item.snippet) ?? '',
        position: index + 1,
      }));
    } catch (error) {
      logError(this.name, `Google search hiba: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * linkedinLeads - LinkedIn profil/cég adatok
   */
  async linkedinLeads(searchUrl: string, limit = 10): Promise<LeadResult[]> {
    try {
      logWarn(this.name, 'LinkedIn scraping cookie-t igényel - lásd Apify dokumentáció');
      
      const items = await this.runActor<ApifyLinkedInItem>('apify/linkedin-profile-scraper', {
        startUrls: [{ url: searchUrl }],
        maxItems: limit,
      });

      return items.map((item) => ({
        name: readText(item.fullName) ?? readText(item.name) ?? 'Névtelen',
        title: readText(item.headline) ?? readText(item.title),
        company: readText(item.company),
        url: readText(item.url) ?? searchUrl,
        location: readText(item.location),
        email: readText(item.email),
      }));
    } catch (error) {
      logError(this.name, `LinkedIn leads hiba: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * ecommerceProducts - Amazon/e-commerce termékek
   */
  async ecommerceProducts(startUrl: string, limit = 20): Promise<ProductResult[]> {
    try {
      const items = await this.runActor<ApifyEcommerceItem>('apify/amazon-crawler', {
        startUrls: [{ url: startUrl }],
        maxItems: limit,
      });

      return items.map((item) => ({
        name: readText(item.title) ?? readText(item.name) ?? 'Névtelen termék',
        price: isRecord(item.price) ? readText(item.price.value) ?? String(item.price.value ?? '') : readText(item.price),
        currency: isRecord(item.price) ? readText(item.price.currency) ?? 'USD' : 'USD',
        url: readText(item.url) ?? startUrl,
        imageUrl: readText(item.thumbnailImage) ?? readText(item.image),
        rating: readNumber(item.stars) ?? readNumber(item.rating),
        reviews: readNumber(item.reviews) ?? readNumber(item.reviewsCount),
      }));
    } catch (error) {
      logError(this.name, `E-commerce scrape hiba: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * trendData - Twitter/Social media trendek
   */
  async trendData(topic: string, source = 'twitter', limit = 50): Promise<TrendResult[]> {
    try {
      const items = await this.runActor<ApifyTrendItem>('apify/twitter-scraper', {
        searchTerms: [topic],
        maxItems: limit,
      });

      return items.map((item) => ({
        topic: topic,
        source: source,
        volume: readNumber(item.retweetCount) ?? readNumber(item.likeCount),
        sentiment: readText(item.sentiment),
        url: readText(item.url),
        timestamp: readText(item.createdAt),
      }));
    } catch (error) {
      logError(this.name, `Trend data hiba: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * execute - IAgent standard interfész
   * 
   * Task parsing:
   * - "google: <query>" → googleSearch
   * - "linkedin: <url>" → linkedinLeads  
   * - "amazon: <url>" → ecommerceProducts
   * - "twitter: <topic>" → trendData
   * 
   * Context:
   * - capability: string (override auto-detect)
   * - query: string
   * - url: string
   * - limit: number
   */
  async execute(task: string, context?: Record<string, unknown>): Promise<AgentResponse> {
    setAgentStatus(this.name, 'working', task.slice(0, 60));

    try {
      // Inicializálás ha még nem történt meg
      if (this.client === null) {
        await this.initialize();
      }

      // Ha nincs Apify token
      if (!this.isAvailable) {
        return {
          status: 'error',
          error: 'APIFY_API_TOKEN nincs beállítva - Apify funkciók nem elérhetők',
          message: 'Szerezz API kulcsot: https://console.apify.com/account/integrations (Free tier: $5/hó)',
        };
      }

      // Capability auto-detect vagy explicit context
      const ctx = normalizeContext(context);
      const capability = readText(ctx.capability);
      const taskLower = task.toLowerCase();

      let result: unknown;
      let resultType: string;

      // Google Search
      if (capability === 'google' || taskLower.includes('google') || taskLower.includes('keress')) {
        const query = readText(ctx.query) ?? task.replace(/google:?/i, '').trim();
        const limit = readNumber(ctx.limit) ?? 10;
        result = await this.googleSearch(query, limit);
        resultType = 'google_search';
      }
      // LinkedIn Leads
      else if (capability === 'linkedin' || taskLower.includes('linkedin') || taskLower.includes('lead')) {
        const url = readText(ctx.url) ?? extractFirstUrl(task) ?? '';
        const limit = readNumber(ctx.limit) ?? 10;
        result = await this.linkedinLeads(url, limit);
        resultType = 'linkedin_leads';
      }
      // E-commerce
      else if (capability === 'ecommerce' || taskLower.includes('amazon') || taskLower.includes('termék')) {
        const url = readText(ctx.url) ?? extractFirstUrl(task) ?? '';
        const limit = readNumber(ctx.limit) ?? 20;
        result = await this.ecommerceProducts(url, limit);
        resultType = 'ecommerce_products';
      }
      // Twitter Trends
      else if (capability === 'twitter' || taskLower.includes('twitter') || taskLower.includes('trend')) {
        const topic = readText(ctx.query) ?? task.replace(/twitter:?/i, '').trim();
        const limit = readNumber(ctx.limit) ?? 50;
        result = await this.trendData(topic, 'twitter', limit);
        resultType = 'trend_data';
      }
      // Alapértelmezett: Google search
      else {
        const query = readText(ctx.query) ?? task;
        const limit = readNumber(ctx.limit) ?? 10;
        result = await this.googleSearch(query, limit);
        resultType = 'google_search';
      }

      const resultItems = normalizeArrayResult(result);
      logInfo(this.name, `Sikeres scraping: ${resultType}, ${resultItems.length} eredmény`);

      return {
        status: 'success',
        data: result,
        metadata: {
          type: resultType,
          count: resultItems.length,
        },
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logError(this.name, errorMsg);
      
      return {
        status: 'error',
        error: errorMsg,
      };
    } finally {
      setAgentStatus(this.name, 'idle');
    }
  }
}

export default ApifyScrapingAgent;
