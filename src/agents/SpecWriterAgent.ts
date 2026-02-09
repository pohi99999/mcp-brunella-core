// FILE: src/agents/SpecWriterAgent.ts
// PURPOSE: Automatically generates specification documents from conversations

import { BaseAgent, type AgentContext, type AgentResult } from './BaseAgent.js';
import { generateResponse } from '../core/llm_client.js';
import { logInfo, logError, setAgentStatus } from '../utils/logger.js';
import { approveSpec as approveSpecStatus, rejectSpec as rejectSpecStatus, getSpecStatus, type SpecStatus } from './specStatus.js';
import fs from 'fs/promises';
import path from 'path';

export class SpecWriterAgent extends BaseAgent {
    name = 'SpecWriter';
    role = 'Specification Generator';
    description = 'Generates specification documents from chat conversations and feature requests.';
    capabilities = ['spec_generation', 'requirement_analysis', 'track_creation'];

    private readonly TRACKS_DIR = path.join(process.cwd(), 'conductor', 'tracks');

    async executeTask(context: AgentContext): Promise<AgentResult> {
        const task = (context.task || '').toLowerCase();
        setAgentStatus(this.name, 'working', context.task || 'spec generation');

        try {
            // Route to appropriate handler
            if (this.isSpecGenerationTask(task)) {
                return await this.generateSpec(context);
            }

            if (this.isTrackCreationTask(task)) {
                return await this.createTrack(context);
            }

            if (this.isSpecApprovalTask(task)) {
                return await this.approveSpec(context);
            }

            if (this.isSpecRejectionTask(task)) {
                return await this.rejectSpec(context);
            }

            // Default: generate spec from conversation
            return await this.generateSpec(context);

        } catch (error: any) {
            logError(this.name, `Error: ${error.message}`);
            return {
                success: false,
                message: `SpecWriter error: ${error.message}`,
                metadata: { error: error.message }
            };
        } finally {
            setAgentStatus(this.name, 'idle');
        }
    }

    private isSpecGenerationTask(task: string): boolean {
        const keywords = ['spec', 'specification', 'generate', 'create spec', 'write spec', 'specifikáció'];
        return keywords.some(kw => task.includes(kw));
    }

    private isTrackCreationTask(task: string): boolean {
        const keywords = ['track', 'create track', 'new track', 'létrehozz track'];
        return keywords.some(kw => task.includes(kw));
    }

    private isSpecApprovalTask(task: string): boolean {
        const keywords = ['approve', 'jóváhagy', 'activate', 'elfogad'];
        return keywords.some(kw => task.includes(kw));
    }

    private isSpecRejectionTask(task: string): boolean {
        const keywords = ['reject', 'elutasít', 'deny', 'visszautasít'];
        return keywords.some(kw => task.includes(kw));
    }

    /**
     * Generate specification from conversation or feature description
     */
    private async generateSpec(context: AgentContext): Promise<AgentResult> {
        logInfo(this.name, 'Generating specification...');

        const metadata = (context.metadata || {}) as Record<string, any>;
        const featureDescription = metadata.featureDescription || context.task || 'New feature';
        const conversationHistory = metadata.conversationHistory || '';

        const systemPrompt = `You are a senior software architect writing a technical specification document.

Your task: Analyze the feature request and conversation history, then generate a comprehensive spec.md file.

FORMAT (Markdown):

# [Feature Name]

## Összefoglaló
[1-2 mondatban a feature célja]

## Jelenlegi Állapot
- ✅ [Mit van már implementálva]
- ❌ [Mi hiányzik]

## Követelmények

### Funkcionális Követelmények
1. [FR1: Konkrét funkció leírás]
2. [FR2: ...]

### Nem-Funkcionális Követelmények
1. [NFR1: Performance, security, stb.]

## Architektúra

### Komponensek
- **ComponentA** (\`path/to/file.ts\`) - Leírás
- **ComponentB** (\`path/to/file2.ts\`) - Leírás

### Adatfolyam
\`\`\`
[Diagram vagy leírás]
\`\`\`

## Implementációs Terv

### Fázis 1: [Név]
- [ ] Task 1
- [ ] Task 2

### Fázis 2: [Név]
- [ ] Task 3

## Függőségek
- [Package vagy komponens amit használni fog]

## Tesztelési Stratégia
1. Unit tesztek: [Mit tesztelünk]
2. Integration tesztek: [Mit tesztelünk]

## Biztonsági Megfontolások
- [Security concerns]

## Estimált Erőforrások
- Időigény: [low/medium/high]
- Üzleti érték: [low/medium/high]

---

**IMPORTANT RULES:**
- Write in Hungarian (magyar nyelven)
- Be specific and technical
- Include file paths where code changes will happen
- Break down into actionable tasks
- Consider edge cases and error handling
`;

        const combinedPrompt = `${systemPrompt}

---

Feature Request:
${featureDescription}

Conversation History:
${conversationHistory}

Generate a comprehensive specification document following the format above.`;

        try {
            const specMarkdown = await generateResponse(combinedPrompt, 'github', 'gpt-4o');

            return {
                success: true,
                message: 'Specification generated successfully',
                data: {
                    spec: specMarkdown,
                    preview: specMarkdown.slice(0, 500) + '...'
                }
            };
        } catch (error: any) {
            logError(this.name, `LLM error: ${error.message}`);
            return {
                success: false,
                message: `Failed to generate spec: ${error.message}`
            };
        }
    }

    /**
     * Create a new track with generated spec
     */
    private async createTrack(context: AgentContext): Promise<AgentResult> {
        const metadata = (context.metadata || {}) as Record<string, any>;
        const featureName = metadata.featureName || 'new_feature';
        let spec = metadata.spec;

        if (!spec) {
            // Generate spec first
            const specResult = await this.generateSpec(context);
            if (!specResult.success) {
                return specResult;
            }
            spec = (specResult.data as any)?.spec;
            metadata.spec = spec;
        }

        // Create track directory
        const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
        const trackId = `${this.sanitizeTrackName(featureName)}_${timestamp}`;
        const trackPath = path.join(this.TRACKS_DIR, trackId);

        try {
            await fs.mkdir(trackPath, { recursive: true });
            logInfo(this.name, `Track directory created: ${trackId}`);

            // Write spec.md
            const specPath = path.join(trackPath, 'spec.md');
            await fs.writeFile(specPath, spec, 'utf-8');
            logInfo(this.name, `Spec written: ${specPath}`);

            // Write meta.json
            const meta = {
                id: trackId,
                title: featureName,
                status: 'draft',
                priority: metadata.priority || 'medium',
                created: new Date().toISOString().split('T')[0],
                updated: new Date().toISOString().split('T')[0],
                owner: metadata.owner || 'Developer',
                spec_status: 'pending_approval',
                progress: 0,
                tags: metadata.tags || ['auto-generated'],
                dependencies: [],
                estimated_effort: metadata.effort || 'medium',
                business_value: metadata.value || 'medium'
            };

            const metaPath = path.join(trackPath, 'meta.json');
            await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
            logInfo(this.name, `Meta created: ${metaPath}`);

            return {
                success: true,
                message: `✅ Track created: ${trackId}`,
                data: {
                    trackId,
                    trackPath,
                    specPath,
                    meta
                }
            };
        } catch (error: any) {
            logError(this.name, `Failed to create track: ${error.message}`);
            return {
                success: false,
                message: `Failed to create track: ${error.message}`
            };
        }
    }

    /**
     * Approve a spec and activate the track.
     * Delegates to the central specStatus module (RULE-SF3).
     */
    private async approveSpec(context: AgentContext): Promise<AgentResult> {
        const metadata = (context.metadata || {}) as Record<string, any>;
        const trackId = metadata.trackId;

        if (!trackId) {
            return {
                success: false,
                message: 'Missing trackId in context.metadata'
            };
        }

        try {
            const success = await approveSpecStatus(trackId);
            if (!success) {
                return {
                    success: false,
                    message: `Failed to approve spec for track: ${trackId}`
                };
            }

            logInfo(this.name, `Track ${trackId} approved and activated via specStatus`);

            return {
                success: true,
                message: `✅ Spec approved! Track ${trackId} is now ACTIVE`,
                data: { trackId, status: 'active' }
            };
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            logError(this.name, `Failed to approve spec: ${msg}`);
            return {
                success: false,
                message: `Failed to approve spec: ${msg}`
            };
        }
    }

    /**
     * Reject a spec with an optional reason.
     */
    private async rejectSpec(context: AgentContext): Promise<AgentResult> {
        const metadata = (context.metadata || {}) as Record<string, any>;
        const trackId = metadata.trackId;
        const reason = metadata.reason;

        if (!trackId) {
            return {
                success: false,
                message: 'Missing trackId in context.metadata'
            };
        }

        try {
            const success = await rejectSpecStatus(trackId, reason);
            if (!success) {
                return {
                    success: false,
                    message: `Failed to reject spec for track: ${trackId}`
                };
            }

            logInfo(this.name, `Track ${trackId} spec rejected`);

            return {
                success: true,
                message: `❌ Spec rejected for track ${trackId}${reason ? `: ${reason}` : ''}`,
                data: { trackId, status: 'rejected', reason }
            };
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            logError(this.name, `Failed to reject spec: ${msg}`);
            return {
                success: false,
                message: `Failed to reject spec: ${msg}`
            };
        }
    }

    /**
     * Helper: Sanitize track name for directory
     */
    private sanitizeTrackName(name: string): string {
        return name
            .toLowerCase()
            .replace(/[áàâä]/g, 'a')
            .replace(/[éèêë]/g, 'e')
            .replace(/[íìîï]/g, 'i')
            .replace(/[óòôö]/g, 'o')
            .replace(/[úùûü]/g, 'u')
            .replace(/[^a-z0-9]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '');
    }

    /**
     * List all tracks with their status
     */
    async listTracks(): Promise<AgentResult> {
        try {
            const trackDirs = await fs.readdir(this.TRACKS_DIR, { withFileTypes: true });
            const tracks = [];

            for (const dir of trackDirs.filter(d => d.isDirectory())) {
                const metaPath = path.join(this.TRACKS_DIR, dir.name, 'meta.json');
                try {
                    const meta = JSON.parse(await fs.readFile(metaPath, 'utf-8'));
                    tracks.push(meta);
                } catch {
                    // Skip if meta.json is missing or invalid
                }
            }

            return {
                success: true,
                message: `Found ${tracks.length} tracks`,
                data: { tracks }
            };
        } catch (error: any) {
            return {
                success: false,
                message: `Failed to list tracks: ${error.message}`
            };
        }
    }
}
