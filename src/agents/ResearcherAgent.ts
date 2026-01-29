import { IAgent } from './types.js';
import { Logger } from '../utils/logger.js';
import { chromium } from 'playwright';
import { agentManager } from './AgentManager.js';

export class ResearcherAgent implements IAgent {
    name = "Researcher";
    role = "Harvester";
    description = "Browses the web to gather raw information.";
    capabilities = ["browse", "search", "extract"];
    
    private logger: Logger;

    constructor() {
        this.logger = new Logger('researcher.log');
    }

    async execute(task: string, context?: any): Promise<any> {
        this.logger.info(`Researching: ${task}`);

        // Simple URL handling for now
        let url = "";
        if (task.startsWith("http")) {
            url = task;
        } else if (context?.url) {
            url = context.url;
        } else {
            // TODO: Search Google if not a direct URL (future)
            return { status: "error", error: "Task must be a URL for now." };
        }

        try {
            const rawData = await this.scrape(url);
            
            // Forward to DataScientist (The "Refiner")
            const refiner = agentManager.getAgent("DataScientist");
            if (refiner) {
                this.logger.info("Handing over to DataScientist...");
                const refined = await refiner.execute("refine:", { content: rawData.content, source: url });
                return { status: "success", data: refined };
            } else {
                return { status: "success", data: rawData, note: "Refiner not found, returning raw data." };
            }

        } catch (e: any) {
            return { status: "error", error: e.message };
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
