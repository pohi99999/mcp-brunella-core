import { BaseAgent, type AgentContext, type AgentResult } from './BaseAgent.js';
import { ingestMediaDirectory } from '../tools/mediaAnalysisTool.js';

function payloadOf(context: AgentContext): Record<string, unknown> {
  return typeof context.payload === 'object' && context.payload !== null ? context.payload : {};
}

export class MediaIngestAgent extends BaseAgent {
  name = 'MediaIngest';
  role = 'Studio media ingest specialist';
  description = 'Normalizes source footage into an auditable Brunella Studio ingest manifest.';
  capabilities = ['studio-ingest', 'media-analysis', 'proxy-generation'];

  async executeTask(context: AgentContext): Promise<AgentResult> {
    const payload = payloadOf(context);
    const inputDir = typeof payload.inputDir === 'string' ? payload.inputDir : undefined;
    if (!inputDir) {
      throw new Error('MediaIngestAgent: inputDir kotelezo.');
    }

    const result = await ingestMediaDirectory({
      inputDir,
      projectName: typeof payload.projectName === 'string' ? payload.projectName : undefined,
      generateProxies: typeof payload.generateProxies === 'boolean' ? payload.generateProxies : false,
    });
    return {
      success: true,
      message: `Ingest kesz: ${result.assets.length} asset, projekt=${result.projectName}`,
      data: result,
      metadata: { assetCount: result.assets.length, manifestPath: result.manifestPath },
    };
  }
}

export default MediaIngestAgent;
