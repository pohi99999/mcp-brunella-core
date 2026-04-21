import { BaseAgent, AgentContext, AgentResult } from './BaseAgent.js';
import { logInfo, logError } from '@packages/utils/logger.js';
import { generateResponse } from '@packages/core-logic/llm_client.js';
import { updateBusinessJobStatus, saveStudioProject } from '@packages/utils/db.js';
import { socketService } from './SocketService.js';
import { agentManager } from './AgentManager.js';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';
import { ensureError } from '@packages/utils/ensureError.js';

type JobContext = {
    jobId?: unknown;
};

function readJobId(taskContext: unknown): string | undefined {
    if (typeof taskContext !== 'object' || taskContext === null) {
        return undefined;
    }

    const { jobId } = taskContext as JobContext;
    return typeof jobId === 'string' ? jobId : undefined;
}

export class MarketingDirectorAgent extends BaseAgent {
    name = "Marketing Director";
    description = "Orchestrates marketing campaigns: generates strategy, social posts, video scripts, and triggers landing page development.";
    role = "Chief Marketing Officer";
    capabilities = ["campaign_strategy", "copywriting", "video_scripting", "studio_trigger"];

    private llmProvider = process.env.LLM_PROVIDER || "github"; // Default to GPT-4o for creative tasks

    async executeTask(context: AgentContext): Promise<AgentResult> {
        const { task, context: taskContext } = context;
        const jobId = readJobId(taskContext);
        
        logInfo(this.name, `Starting Campaign Generation: ${task}`);

        try {
            // 1. Generate Action Plan
            socketService.emit('business_job:updated', { jobId, status: 'running', message: 'Marketing Akcióterv készítése...' });
            const actionPlanPrompt = `Te egy profi Marketing Igazgató vagy. A felhasználó a következő terméket/szolgáltatást akarja promótálni:\n\n"${task}"\n\nKészíts egy lépésről-lépésre szóló marketing akciótervet a piacra lépéshez (Célközönség, USP, Csatornák, Hirdetési javaslatok).`;
            const actionPlan = await generateResponse(actionPlanPrompt, this.llmProvider, "gpt-4.1");

            // 2. Generate Social Media Posts
            socketService.emit('business_job:updated', { jobId, status: 'running', message: 'Közösségi média tartalmak írása...' });
            const socialPostsPrompt = `Írj 3 figyelemfelkeltő, konverziófókuszú közösségi média posztot (Facebook, Instagram, LinkedIn) a következő termékhez, használj emojikat és hashtageket:\n\n"${task}"`;
            const socialPosts = await generateResponse(socialPostsPrompt, this.llmProvider, "gpt-4o");

            // 3. Generate Video Script
            socketService.emit('business_job:updated', { jobId, status: 'running', message: 'Promóciós videó forgatókönyv tervezése...' });
            const videoScriptPrompt = `Írj egy 30-60 másodperces, ütős promóciós videó forgatókönyvet (Tiktok/Reels stílusban) a következő termékhez:\n\n"${task}"\nBontsd jelenetekre (Kép / Hang / Felirat).`;
            const videoScript = await generateResponse(videoScriptPrompt, this.llmProvider, "gpt-4o");

            // 4. Generate Landing Page requirements & trigger Studio
            socketService.emit('business_job:updated', { jobId, status: 'running', message: 'Weboldal specifikáció készítése és Studio indítása...' });
            const landingPagePrompt = `A következő termékhez kell egy modern, konverziófókuszú, egyoldalas (One-Pager) Landing Page weboldalt készítenünk:\n\n"${task}"\n\nÍrd meg a pontos struktúrát és a szöveges tartalmat (Hero section, Benefits, Social Proof, CTA), amit a fejlesztő be tud építeni a kódba.`;
            const landingPageSpecs = await generateResponse(landingPagePrompt, this.llmProvider, "gpt-4o");

            // Trigger Studio Project Creation
            const projectId = uuidv4();
            const rootDir = path.join(process.cwd(), 'data', 'studio', projectId);
            await fs.mkdir(rootDir, { recursive: true });

            const projectName = `Campaign_${Date.now().toString().slice(-4)}`;
            const techStack = 'React + Tailwind';

            await saveStudioProject({
                id: projectId,
                name: projectName,
                description: `Marketing Landing Page for: ${task}\n\nSpecs:\n${landingPageSpecs}`,
                tech_stack: techStack,
                root_dir: rootDir
            });

            // Trigger Orchestrator to start the development swarm
            agentManager.queueTask(
                `Készíts egy egyoldalas, modern, látványos marketing weboldalt a következő specifikációk alapján:\n\n${landingPageSpecs}`, 
                'orchestrator', 
                { projectId: projectId, studioMode: true, rootDir }
            );

            // 5. Finalize Job
            const finalResult = {
                actionPlan,
                socialPosts,
                videoScript,
                landingPageSpecs,
                studioProjectId: projectId
            };

            if (jobId) {
                await updateBusinessJobStatus(jobId, 'completed', JSON.stringify(finalResult));
                socketService.emit('business_job:updated', { jobId, status: 'completed' });
            }

            return {
                success: true,
                message: "Marketing Kampány és Weboldal fejlesztés elindítva!",
                data: finalResult
            };

        } catch (error: unknown) {
            const err = ensureError(error);
            logError(this.name, `Failed: ${err.message}`);
            if (jobId) await updateBusinessJobStatus(jobId, 'failed', JSON.stringify({ error: err.message }));
            return { success: false, message: err.message };
        }
    }
}

