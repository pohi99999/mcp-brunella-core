import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { chromium } from 'playwright';
import { config } from '../config/index.js';
import { addDocumentToIndex } from '../utils/rag.js';

// Dynamic imports for Node.js modules
let fs: typeof import('fs/promises') | null = null;
let path: typeof import('path') | null = null;
let child_process: typeof import('child_process') | null = null;

async function ensureModules() {
    if (typeof process !== 'undefined' && process.versions?.node) {
        if (!fs) fs = (await import('fs/promises')).default || await import('fs/promises');
        if (!path) path = (await import('path')).default || await import('path');
        if (!child_process) child_process = (await import('child_process')).default || await import('child_process');
    }
}

async function runRefinerSafe(content: string, source: string): Promise<any> {
    await ensureModules();
    if (!fs || !path || !child_process) return { status: "ENV_ERROR", error: "Node environment required" };

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
            child_process!.exec(`"${pythonPath}" "${tempPy}"`, async (error, stdout, stderr) => {
                await fs!.unlink(tempIn).catch(() => {});
                await fs!.unlink(tempPy).catch(() => {});
                try {
                    const parsed = stdout.trim() ? JSON.parse(stdout) : { status: "EMPTY", stderr };
                    resolve(parsed);
                } catch (e) {
                    resolve({ status: "PARSE_ERROR", stdout, stderr });
                }
            });
        });
    } catch (e: any) {
        return { status: "IO_ERROR", error: e.message };
    }
}

export async function registerSwarmTools(server: McpServer) {
  await ensureModules();

  server.tool("swarm_ingest", "Browse -> Refine -> Knowledge Store.", {
      url: z.string().url(),
  }, async ({ url }) => {
      if (!fs || !path) return { isError: true, content: [{ type: "text", text: "Tool not supported in this environment" }] };

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
        try { await addDocumentToIndex(path.join('07_KNOWLEDGE_BASE', 'swarm_ingested', fileName), md); } catch {}

        return { content: [{ type: "text", text: `Success: ${title}\nSaved: ${fileName}` }] };
      } catch (error: any) {
        if (browserInstance) await browserInstance.close();
        return { isError: true, content: [{ type: "text", text: `Failed: ${error.message}` }] };
      }
  });
}
