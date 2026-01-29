import { IAgent } from './types.js';
import { Logger } from '../utils/logger.js';
import { chromium } from 'playwright';
import { agentManager } from './AgentManager.js';

export class ResearcherAgent implements IAgent {
    name = "Researcher";
    role = "Harvester";
    description = "Browses the web to gather raw information. Can search for topics or scrape URLs.";
    capabilities = ["browse", "search", "extract"];
    
    private logger: Logger;

    constructor() {
        this.logger = new Logger('researcher.log');
    }

    async execute(task: string, context?: any): Promise<any> {
        this.logger.info(`Researching: ${task}`);

        let url = "";
        
        // 1. Determine Intent (URL vs Search)
        if (task.startsWith("http")) {
            url = task;
        } else if (context?.url) {
            url = context.url;
        } else {
            // It's a topic -> Search
            this.logger.info(`Input is a topic. Searching for: ${task}`);
            try {
                const searchResult = await this.search(task);
                if (!searchResult) {
                    return { status: "error", error: "No search results found." };
                }
                url = searchResult;
                this.logger.info(`Found relevant URL: ${url}`);
            } catch (e: any) {
                return { status: "error", error: `Search failed: ${e.message}` };
            }
        }

        // 2. Scrape & Process
        try {
            const rawData = await this.scrape(url);
            
            // Forward to DataScientist (The "Refiner")
            const refiner = agentManager.getAgent("DataScientist");
            if (refiner) {
                this.logger.info("Handing over to DataScientist...");
                // Pass the original task context + extracted data
                const refined = await refiner.execute("refine:", { 
                    content: rawData.content, 
                    source: url,
                    original_task: task
                });
                return { status: "success", data: refined, source: url };
            } else {
                return { status: "success", data: rawData, note: "Refiner not found, returning raw data." };
            }

        } catch (e: any) {
            return { status: "error", error: e.message };
        }
    }

    private async search(query: string): Promise<string | null> {
        const browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();
        try {
            // Use DuckDuckGo HTML version for easier scraping without JS bloat
            const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
            await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
            
            // Extract first result link (class 'result__a')
            const firstLink = await page.evaluate(() => {
                const link = document.querySelector('.result__a') as HTMLAnchorElement;
                return link ? link.href : null;
            });
            
            return firstLink;
        } finally {
            await browser.close();
        }
    }

    private async scrape(url: string) {
        const browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            const content = await page.evaluate(() => document.body.innerText);
            const title = await page.title();
            return { title, content };
        } finally {
            await browser.close();
        }
    }
}