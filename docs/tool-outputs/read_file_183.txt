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
export class ApifyScrapingAgent implements IAgent {
  name = 'ApifyScraping';
  role = 'Research & Intelligence — Deep Web Scraper';
  description = 'Apify platform-alapú professzionális scraping: Google, LinkedIn, e-commerce, trendek';
  capabilities = ['google_search', 'linkedin_leads', 'ecommerce_scrape', 'trend_analysis', 'social_media'];

  private client: ApifyClient | null = null;
  private isAvailable = false;

  async initialize(): Promise<void> {
    const token = process.env.APIFY_API_TOKEN;
    
    if (!token || token === 'your_apify_token_here') {
      logWarn(this.name, 'APIFY_API_TOKEN nincs beállítva - Apify funkciók nem elérhetők');
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
  private async runActor(actorId: string, input: Record<string, unknown>, _timeoutMs = 60000): Promise<unknown[]> {
    if (!this.client || !this.isAvailable) {
      throw new Error('Apify kliens nem inicializált - APIFY_API_TOKEN hiányzik');
    }

    logInfo(this.name, `Actor futtatás: ${actorId}`);
    
    const run = await this.client.actor(actorId).call(input);
    
    // Dataset items lekérése
    const { items } = await this.client.dataset(run.defaultDatasetId).listItems();
    
    logInfo(this.name, `Actor befejezve: ${items.length} eredmény`);
    return items;
  }

  /**
   * googleSearch - Google keresés Apify-on keresztül
   */
  async googleSearch(query: string, limit = 10): Promise<SearchResult[]> {
    try {
      const items = await this.runActor('apify/google-search-scraper', {
        queries: query,
        maxResultsPerPage: limit,
        languageCode: 'hu', // Magyar eredmények preferálása
      });

      return items.map((item: any, index: number) => ({
        title: item.title || '',
        url: item.url || '',
        snippet: item.description || item.snippet || '',
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
      
      const items = await this.runActor('apify/linkedin-profile-scraper', {
        startUrls: [{ url: searchUrl }],
        maxItems: limit,
      });

      return items.map((item: any) => ({
        name: item.fullName || item.name || 'Névtelen',
        title: item.headline || item.title,
        company: item.company,
        url: item.url || searchUrl,
        location: item.location,
        email: item.email,
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
      const items = await this.runActor('apify/amazon-crawler', {
        startUrls: [{ url: startUrl }],
        maxItems: limit,
      });

      return items.map((item: any) => ({
        name: item.title || item.name || 'Névtelen termék',
        price: item.price?.value?.toString() || item.price,
        currency: item.price?.currency || 'USD',
        url: item.url || startUrl,
        imageUrl: item.thumbnailImage || item.image,
        rating: item.stars || item.rating,
        reviews: item.reviews || item.reviewsCount,
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
      const items = await this.runActor('apify/twitter-scraper', {
        searchTerms: [topic],
        maxItems: limit,
      });

      return items.map((item: any) => ({
        topic: topic,
        source: source,
        volume: item.retweetCount || item.likeCount,
        sentiment: item.sentiment,
        url: item.url,
        timestamp: item.createdAt,
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
      const capability = context?.capability as string | undefined;
      const taskLower = task.toLowerCase();

      let result: unknown;
      let resultType: string;

      // Google Search
      if (capability === 'google' || taskLower.includes('google') || taskLower.includes('keress')) {
        const query = (context?.query as string) || task.replace(/google:?/i, '').trim();
        const limit = (context?.limit as number) || 10;
        result = await this.googleSearch(query, limit);
        resultType = 'google_search';
      }
      // LinkedIn Leads
      else if (capability === 'linkedin' || taskLower.includes('linkedin') || taskLower.includes('lead')) {
        const url = (context?.url as string) || task.match(/https?:\/\/[^\s]+/)?.[0] || '';
        const limit = (context?.limit as number) || 10;
        result = await this.linkedinLeads(url, limit);
        resultType = 'linkedin_leads';
      }
      // E-commerce
      else if (capability === 'ecommerce' || taskLower.includes('amazon') || taskLower.includes('termék')) {
        const url = (context?.url as string) || task.match(/https?:\/\/[^\s]+/)?.[0] || '';
        const limit = (context?.limit as number) || 20;
        result = await this.ecommerceProducts(url, limit);
        resultType = 'ecommerce_products';
      }
      // Twitter Trends
      else if (capability === 'twitter' || taskLower.includes('twitter') || taskLower.includes('trend')) {
        const topic = (context?.query as string) || task.replace(/twitter:?/i, '').trim();
        const limit = (context?.limit as number) || 50;
        result = await this.trendData(topic, 'twitter', limit);
        resultType = 'trend_data';
      }
      // Alapértelmezett: Google search
      else {
        const query = (context?.query as string) || task;
        const limit = (context?.limit as number) || 10;
        result = await this.googleSearch(query, limit);
        resultType = 'google_search';
      }

      logInfo(this.name, `Sikeres scraping: ${resultType}, ${(result as unknown[]).length} eredmény`);

      return {
        status: 'success',
        data: result,
        metadata: {
          type: resultType,
          count: (result as unknown[]).length,
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
