import { IAgent } from './types.js';
import { logInfo, logError, setAgentStatus } from '../utils/logger.js';
import { chromium } from 'playwright';
import { agentManager } from './AgentManager.js';

export class ResearcherAgent implements IAgent {
    name = "Researcher";
    role = "Harvester";
    description = "Browses the web to gather raw information. Can search for topics or scrape URLs.";
    capabilities = ["browse", "search", "extract"];

    async execute(task: string, context?: any): Promise<any> {
        const taskDesc = task.length > 80 ? task.slice(0, 77) + '...' : task;
        setAgentStatus(this.name, 'working', taskDesc);
        logInfo(this.name, `Researching: ${task}`);

        let url = "";
        
        // 1. Determine Intent (URL vs Search)
        if (task.startsWith("http")) {
            url = task;
        } else if (context?.url) {
            url = context.url;
        } else {
            // It's a topic -> Search
            logInfo(this.name, `Input is a topic. Searching for: ${task}`);
            try {
                const searchResult = await this.search(task);
                if (!searchResult) {
                    setAgentStatus(this.name, 'idle');
                    return { status: "error", error: "No search results found." };
                }
                url = searchResult;
                logInfo(this.name, `Found relevant URL: ${url}`);
            } catch (e: any) {
                logError(this.name, `Search failed: ${e.message}`);
                setAgentStatus(this.name, 'error');
                return { status: "error", error: `Search failed: ${e.message}` };
            }
        }

        // 2. Scrape & Process
        try {
            const rawData = await this.scrape(url);
            
            // Forward to DataScientist (The "Refiner")
            const refiner = agentManager.getAgent("DataScientist");
            if (refiner) {
                logInfo(this.name, "Handing over to DataScientist...");
                // Pass the original task context + extracted data
                const refined = await refiner.execute("refine:", { 
                    content: rawData.content, 
                    source: url,
                    original_task: task
                });
                setAgentStatus(this.name, 'idle');
                return { status: "success", data: refined, source: url };
            } else {
                setAgentStatus(this.name, 'idle');
                return { status: "success", data: rawData, note: "Refiner not found, returning raw data." };
            }

        } catch (e: any) {
            logError(this.name, e.message);
            setAgentStatus(this.name, 'error');
            return { status: "error", error: e.message };
        } finally {
            setAgentStatus(this.name, 'idle');
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