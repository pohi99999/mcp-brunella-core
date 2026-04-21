import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { swarmManager } from '@packages/agents/AgentManager.js';
import { chromium } from 'playwright';
import { exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { config } from '@packages/utils/index.js';
import { addToIndex } from '@packages/utils/rag.js';
import { logDebug } from '@packages/utils/logger.js';

async function runRefinerSafe(content: string, source: string): Promise<any> {
    const pythonPath = path.resolve(config.workspaceRoot, '.venv/Scripts/python.exe');
    const root = config.workspaceRoot.replace(/\\/g, '/');
    const tempIn = path.join(config.systemLogDir, `ref_in_${Date.now()}.json`);
    const tempPy = path.join(config.systemLogDir, `ref_run_${Date.now()}.py`);
    
    try {
        await fs.writeFile(tempIn, JSON.stringify({ content, source }), 'utf-8');
        const pyCode = `
import sys, json, os
sys.path.append('${root}')
from myai.refiner_logic import refiner
try:
    with open('${tempIn.replace(/\\/g, '/')}', 'r', encoding='utf-8') as f:
        payload = json.load(f)
    result = refiner.process_data(payload)
    print(json.dumps(result) if result else json.dumps({"status": "REJECTED"}))
except Exception as e:
    print(json.dumps({"status": "ERROR", "error": str(e)}))
`;
        await fs.writeFile(tempPy, pyCode, 'utf-8');

        return new Promise((resolve) => {
            exec(`"${pythonPath}" "${tempPy}"`, async (error, stdout, stderr) => {
                await fs.unlink(tempIn).catch((e: unknown) => {
                    logDebug('runRefinerSafe: Failed to delete temp input file (non-fatal)', e);
                });
                await fs.unlink(tempPy).catch((e: unknown) => {
                    logDebug('runRefinerSafe: Failed to delete temp Python file (non-fatal)', e);
                });
                try {
                    const parsed = stdout.trim() ? JSON.parse(stdout) : { status: "EMPTY", stderr };
                    resolve(parsed);
                } catch (error: unknown) {
                    // Non-critical: JSON parse failure is handled by returning PARSE_ERROR status
                    resolve({ status: "PARSE_ERROR", stdout, stderr });
                }
            });
        });
    } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        return { status: "IO_ERROR", error: err.message };
    }
}

export function registerSwarmTools(server: McpServer) {
  server.tool("swarm_ingest", "Browse -> Refine -> Knowledge Store.", {
      url: z.string().url(),
  }, async ({ url }) => {
      let browserInstance;
      try {
        browserInstance = await chromium.launch({ headless: true });
        const page = await browserInstance.newPage();
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        const rawContent = await page.evaluate(() => document.body.innerText);
        const title = await page.title();
        await browserInstance.close();

        const refined = await runRefinerSafe(rawContent, url);
        if (!refined || refined.status === 'REJECTED' || refined.status === 'ERROR' || refined.status === 'PARSE_ERROR') {
            return { content: [{ type: "text", text: `Rejected. Debug: ${JSON.stringify(refined)}` }] };
        }

        const kbDir = path.join(config.workspaceRoot, '07_KNOWLEDGE_BASE', 'swarm_ingested');
        if (!(await fs.stat(kbDir).catch(() => false))) await fs.mkdir(kbDir, { recursive: true });
        const fileName = `${Date.now()}.md`;
        const filePath = path.join(kbDir, fileName);
        const md = `# ${title}\n\n**Source:** ${url}\n\n${refined.clean_content}`;
        await fs.writeFile(filePath, md, 'utf-8');
        try {
          await addToIndex(path.join('07_KNOWLEDGE_BASE', 'swarm_ingested', fileName), md);
        } catch (error: unknown) {
          // Non-critical: RAG indexing failure doesn't stop the ingest operation
          const err = error instanceof Error ? error : new Error(String(error));
          logDebug('swarm_ingest', `RAG indexing failed (non-critical): ${err.message}`);
        }

        return { content: [{ type: "text", text: `Success: ${title}\nSaved: ${fileName}` }] };
      } catch (error: unknown) {
        if (browserInstance) await browserInstance.close();
        const err = error instanceof Error ? error : new Error(String(error));
        return { isError: true, content: [{ type: "text", text: `Failed: ${err.message}` }] };
      }
  });

  // swarm_dispatch: kolónia indítása feladattal
  server.tool(
    'swarm_dispatch',
    'Triád swarm kolónia indítása feladattal. Competitive bidding alapján a legalkalmasabb agent veszi át a feladatot.',
    {
      task: z.string().describe('A végrehajtandó feladat leírása'),
      colonyId: z.string().optional().describe('Kolónia azonosítója (alapértelmezett: triad-default)'),
      requiredCapabilities: z.array(z.string()).optional().describe('Szükséges képességek szűréséhez'),
    },
    async ({ task, colonyId = 'triad-default', requiredCapabilities = [] }) => {
      try {
        const colony = swarmManager.getColony(colonyId);
        if (!colony) {
          return { isError: true, content: [{ type: 'text' as const, text: `Colony not found: ${colonyId}` }] };
        }
        if (colony.status === 'paused') {
          return { isError: true, content: [{ type: 'text' as const, text: `Colony ${colonyId} is paused (Phoenix failover active)` }] };
        }

        const swarmTask = {
          taskId: swarmManager.nextTaskId(),
          task,
          requiredCapabilities,
          priority: 1,
        };

        const result = await swarmManager.submitTask(colonyId, swarmTask);
        if (!result) {
          return { isError: true, content: [{ type: 'text' as const, text: 'No bids received — no available agents in colony' }] };
        }

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ status: result.status, result: result.result, durationMs: result.durationMs }, null, 2)
          }]
        };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return { isError: true, content: [{ type: 'text' as const, text: `swarm_dispatch error: ${msg}` }] };
      }
    }
  );

  // swarm_status: aktív kolóniák listázása
  server.tool(
    'swarm_status',
    'Összes swarm kolónia és azok állapotának lekérdezése.',
    {},
    async () => {
      const colonies = swarmManager.listColonies().map(c => ({
        colonyId: c.swarmId,
        name: c.name,
        status: c.status,
        agentCount: c.agents.size,
        leaderId: c.leaderId,
        metrics: c.metrics,
      }));
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ colonies, total: colonies.length }, null, 2) }]
      };
    }
  );
}

