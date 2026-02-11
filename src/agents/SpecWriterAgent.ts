// FILE: src/agents/SpecWriterAgent.ts
// PURPOSE: Automatically generates EPP v2 compliant tracks from creative ideas
// VERSION: 2.0 (EPP v2 Protocol)
// UPDATED: 2026-02-11 - 3-stage LLM pipeline + Ollama qwen2.5-coder

import { BaseAgent, type AgentContext, type AgentResult } from './BaseAgent.js';
import { generateResponse } from '../core/llm_client.js';
import { logInfo, logError, setAgentStatus } from '../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';

// ════════════════════════════════════════════════════════════════
// TYPES & INTERFACES
// ════════════════════════════════════════════════════════════════

/**
 * Structured requirements JSON from Stage 1
 */
interface RequirementsJson {
    title: string;
    description: string;
    priority: 'P0' | 'P1' | 'P2';
    estimated_hours: number;
    phases: Array<{
        name: string;
        tasks: Array<{
            task: string;
            estimate_minutes: number;
        }>;
    }>;
    integrations: {
        dashboard: string;
        cli: string;
    };
}

// ════════════════════════════════════════════════════════════════
// AGENT IMPLEMENTATION
// ════════════════════════════════════════════════════════════════

/**
 * SpecWriterAgent v2.0 - EPP v2 Track Generator
 *
 * FEATURES:
 * - 3-stage LLM pipeline (qwen2.5-coder:latest)
 * - EPP v2 compliant track.md generation
 * - Dashboard + CLI integration checklist
 * - Automatic TODO breakdown
 * - conductor/tracks/ structure
 *
 * INPUT: Creative idea (2-5 sentences, natural language, magyar OK)
 * OUTPUT: Professional track.md (EPP v2, 7 Arany Szabály)
 */
export class SpecWriterAgent extends BaseAgent {
    name = 'SpecWriter';
    role = 'EPP v2 Track Generator';
    description = 'Generates EPP v2 compliant tracks from creative ideas using 3-stage LLM pipeline.';
    capabilities = ['track_generation', 'epp_v2_compliance', 'requirement_extraction', 'todo_breakdown'];

    private readonly TRACKS_DIR = path.join(process.cwd(), 'conductor', 'tracks');

    async executeTask(context: AgentContext): Promise<AgentResult> {
        const task = (context.task || '').toLowerCase();
        const taskDesc = context.task?.slice(0, 80) || 'track generation';
        setAgentStatus(this.name, 'working', taskDesc);

        try {
            // Route to appropriate handler
            if (this.isTrackGenerationTask(task)) {
                return await this.generate3StageTrack(context);
            }

            if (this.isListTracksTask(task)) {
                return await this.listTracks();
            }

            // Default: 3-stage track generation
            return await this.generate3StageTrack(context);

        } catch (error: any) {
            logError(this.name, `Error: ${error.message}`);
            return {
                success: false,
                message: `SpecWriter error: ${error.message}`,
                metadata: { error: error.message, stack: error.stack }
            };
        } finally {
            setAgentStatus(this.name, 'idle');
        }
    }

    private isTrackGenerationTask(task: string): boolean {
        const keywords = ['track', 'generate', 'create', 'új', 'írj', 'készíts', 'generálj'];
        return keywords.some(kw => task.includes(kw));
    }

    private isListTracksTask(task: string): boolean {
        const keywords = ['list', 'show', 'tracks', 'listázd', 'mutasd'];
        return keywords.some(kw => task.includes(kw)) && task.includes('track');
    }

    /**
     * 3-STAGE LLM PIPELINE - EPP v2 Track Generation
     *
     * Stage 1: Requirement Extraction (idea → structured JSON)
     * Stage 2: Track Generation (JSON → track.md markdown)
     * Stage 3: Validation & File Write (EPP v2 compliance check)
     */
    private async generate3StageTrack(context: AgentContext): Promise<AgentResult> {
        logInfo(this.name, '🚀 Starting 3-stage track generation...');

        const metadata = (context.metadata || {}) as Record<string, any>;
        const idea = metadata.idea || context.task || '';

        if (!idea) {
            return {
                success: false,
                message: 'Missing idea in context.metadata.idea or context.task'
            };
        }

        try {
            // ────────────────────────────────────────────────────────────
            // STAGE 1: Requirement Extraction
            // ────────────────────────────────────────────────────────────
            logInfo(this.name, '📊 Stage 1/3: Requirement extraction...');
            const requirementsJson = await this.stage1_extractRequirements(idea);
            logInfo(this.name, `✅ Stage 1 complete: ${requirementsJson.title}`);

            // ────────────────────────────────────────────────────────────
            // STAGE 2: Track Markdown Generation
            // ────────────────────────────────────────────────────────────
            logInfo(this.name, '📝 Stage 2/3: Generating track.md...');
            const trackMarkdown = await this.stage2_generateTrackMarkdown(requirementsJson);
            logInfo(this.name, `✅ Stage 2 complete: ${trackMarkdown.length} chars`);

            // ────────────────────────────────────────────────────────────
            // STAGE 3: Validation & File Write
            // ────────────────────────────────────────────────────────────
            logInfo(this.name, '✔️ Stage 3/3: Validating EPP v2 compliance...');
            const validationResult = await this.stage3_validateAndWrite(requirementsJson, trackMarkdown);

            if (!validationResult.success) {
                return validationResult;
            }

            const trackData = validationResult.data as { trackId: string; trackPath: string; trackFile: string };
            logInfo(this.name, `✨ Track generated: ${trackData.trackId}`);

            return {
                success: true,
                message: `✅ Track generated successfully: ${trackData.trackId}`,
                data: {
                    trackId: trackData.trackId,
                    trackPath: trackData.trackPath,
                    trackFile: trackData.trackFile,
                    trackMarkdown,
                    requirements: requirementsJson,
                    preview: trackMarkdown.slice(0, 500) + '...'
                }
            };
        } catch (error: any) {
            logError(this.name, `3-stage pipeline error: ${error.message}`);
            return {
                success: false,
                message: `Failed to generate track: ${error.message}`,
                metadata: { error: error.message, stack: error.stack }
            };
        }
    }

    // ════════════════════════════════════════════════════════════════
    // STAGE 1: REQUIREMENT EXTRACTION
    // ════════════════════════════════════════════════════════════════

    /**
     * Stage 1: Extract structured requirements from natural language idea
     * Uses qwen2.5-coder:latest via Ollama
     *
     * @param idea - Natural language idea (2-5 sentences, magyar OK)
     * @returns Structured JSON: { title, description, priority, phases[] }
     */
    private async stage1_extractRequirements(idea: string): Promise<RequirementsJson> {
        const systemPrompt = `You are an expert requirements analyst. Extract structured information from the user's creative idea.

**OUTPUT FORMAT (JSON ONLY):**
{
  "title": "Short descriptive title (English, 4-6 words)",
  "description": "1-2 sentence description (English)",
  "priority": "P0" | "P1" | "P2",
  "estimated_hours": <number>,
  "phases": [
    {
      "name": "Phase 1: Core Implementation",
      "tasks": [
        { "task": "Create agent class", "estimate_minutes": 60 },
        { "task": "Write unit tests", "estimate_minutes": 30 }
      ]
    }
  ],
  "integrations": {
    "dashboard": "Brief dashboard component description",
    "cli": "Brief CLI command description (magyar)"
  }
}

**RULES:**
- Output ONLY valid JSON (no markdown, no extra text)
- priority: P0 (critical), P1 (high), P2 (medium)
- estimated_hours: total implementation time (1-40 hours)
- phases: 2-6 phases, each with 2-8 tasks
- tasks: specific, actionable, with realistic time estimates (15-240 min)
- integrations: MANDATORY (Dashboard + CLI required per EPP v2 Rule #6)`;

        const userPrompt = `Idea:\n${idea}`;

        try {
            const rawResponse = await generateResponse(
                `${systemPrompt}\n\n${userPrompt}`,
                'ollama',
                'qwen2.5-coder:latest'
            );

            if (!rawResponse || typeof rawResponse !== 'string') {
                throw new Error('LLM returned empty or invalid response');
            }

            // Parse JSON from response (handle markdown code blocks if present)
            const jsonMatch = rawResponse.match(/```json\s*([\s\S]*?)\s*```/) || rawResponse.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('LLM did not return valid JSON');
            }

            const jsonString = jsonMatch[1] || jsonMatch[0];
            const parsed = JSON.parse(jsonString) as RequirementsJson;

            // Validation
            if (!parsed.title || !parsed.phases || !parsed.integrations) {
                throw new Error('Missing required fields in extracted requirements');
            }

            return parsed;
        } catch (error: any) {
            logError(this.name, `Stage 1 error: ${error.message}`);
            throw new Error(`Requirement extraction failed: ${error.message}`);
        }
    }

    // ════════════════════════════════════════════════════════════════
    // STAGE 2: TRACK MARKDOWN GENERATION
    // ════════════════════════════════════════════════════════════════

    /**
     * Stage 2: Generate EPP v2 compliant track.md from requirements
     * Uses qwen2.5-coder:latest via Ollama
     *
     * @param requirements - Structured JSON from Stage 1
     * @returns Complete track.md markdown (EPP v2 format)
     */
    private async stage2_generateTrackMarkdown(requirements: RequirementsJson): Promise<string> {
        const today = new Date().toISOString().split('T')[0];
        const trackId = this.generateTrackId(requirements.title, today);

        // Build phases checklist
        const phasesMarkdown = requirements.phases.map((phase, idx) => {
            const tasksList = phase.tasks.map(t => `- [ ] ${t.task} (${t.estimate_minutes} min)`).join('\n');
            return `### Phase ${idx + 1}: ${phase.name}\n${tasksList}`;
        }).join('\n\n');

        const systemPrompt = `You are a technical writer generating an EPP v2 compliant track.md file.

**TEMPLATE (Markdown):**

# ${requirements.title}

**Track ID:** \`${trackId}\`
**Priority:** ${requirements.priority}
**Progress:** 0%
**Created:** ${today}
**Estimated Time:** ${requirements.estimated_hours} hours

---

## 🎯 Cél

${requirements.description}

## 📋 Feladatok (TODO)

${phasesMarkdown}

## ✅ Acceptance Criteria

- [ ] Dashboard integráció kész (${requirements.integrations.dashboard})
- [ ] CLI integráció kész (${requirements.integrations.cli})
- [ ] \`npm test\` - All tests passing (0 errors)
- [ ] \`npm run build\` - Clean build (0 TypeScript errors)
- [ ] EPP v2 compliance: 7 Arany Szabály követve
- [ ] Documentation updated (.ai/claude.md + FOSZAL.md)

## 🔗 Integrációk

### Dashboard
${requirements.integrations.dashboard}

**Component:** \`src/dashboard/components/[ComponentName].tsx\`

### CLI
${requirements.integrations.cli}

**Command:** \`brunella [command-name]\`
**File:** \`src/cli/[commandName]Commands.ts\`

## 📝 Notes

- **EPP v2 Protocol:** This track follows the 7 Arany Szabály (Golden Rules)
- **Testing:** Unit + Integration tests required
- **Documentation:** Update .ai/claude.md work log after completion

---

**Status:** Ready for Implementation ✅
**Next Step:** Begin Phase 1

---

**OUTPUT RULES:**
- Output the COMPLETE track.md file as markdown
- Include ALL sections from template
- Keep the TODO checklist with [ ] unchecked boxes
- Magyar and English mixed OK (magyar for CLI, English for code)
- NO markdown code blocks around output (raw markdown only)
`;

        try {
            const trackMarkdown = await generateResponse(systemPrompt, 'ollama', 'qwen2.5-coder:latest');
            return trackMarkdown.trim();
        } catch (error: any) {
            logError(this.name, `Stage 2 error: ${error.message}`);
            throw new Error(`Track generation failed: ${error.message}`);
        }
    }

    // ════════════════════════════════════════════════════════════════
    // STAGE 3: VALIDATION & FILE WRITE
    // ════════════════════════════════════════════════════════════════

    /**
     * Stage 3: Validate EPP v2 compliance and write track file
     *
     * @param requirements - Structured JSON from Stage 1
     * @param trackMarkdown - Generated markdown from Stage 2
     * @returns AgentResult with track file info
     */
    private async stage3_validateAndWrite(requirements: RequirementsJson, trackMarkdown: string): Promise<AgentResult> {
        // EPP v2 Compliance Checks
        const requiredSections = [
            '## 🎯 Cél',
            '## 📋 Feladatok (TODO)',
            '## ✅ Acceptance Criteria',
            '## 🔗 Integrációk'
        ];

        for (const section of requiredSections) {
            if (!trackMarkdown.includes(section)) {
                logError(this.name, `EPP v2 validation failed: Missing section "${section}"`);
                return {
                    success: false,
                    message: `EPP v2 validation failed: Missing required section "${section}"`
                };
            }
        }

        // Check Dashboard + CLI integration (Rule #6) - must have both subsections
        const hasIntegrationsSection = trackMarkdown.includes('## 🔗 Integrációk');
        const hasDashboardSubsection = trackMarkdown.includes('### Dashboard') || trackMarkdown.includes('**Dashboard:**');
        const hasCLISubsection = trackMarkdown.includes('### CLI') || trackMarkdown.includes('**CLI:**');

        if (!hasIntegrationsSection || !hasDashboardSubsection || !hasCLISubsection) {
            logError(this.name, 'EPP v2 Rule #6 violation: Missing Dashboard or CLI integration subsection');
            return {
                success: false,
                message: 'EPP v2 Rule #6 violation: Both Dashboard and CLI integration subsections are mandatory'
            };
        }

        // Create track directory
        const today = new Date().toISOString().split('T')[0];
        const trackId = this.generateTrackId(requirements.title, today);
        const trackPath = path.join(this.TRACKS_DIR, trackId);

        try {
            await fs.mkdir(trackPath, { recursive: true });
            logInfo(this.name, `Track directory created: ${trackId}`);

            // Write track.md
            const trackFilePath = path.join(trackPath, 'track.md');
            await fs.writeFile(trackFilePath, trackMarkdown, 'utf-8');
            logInfo(this.name, `Track file written: ${trackFilePath}`);

            return {
                success: true,
                message: `Track validated and written: ${trackId}`,
                data: {
                    trackId,
                    trackPath,
                    trackFile: trackFilePath
                }
            };
        } catch (error: any) {
            logError(this.name, `Stage 3 file write error: ${error.message}`);
            return {
                success: false,
                message: `Failed to write track file: ${error.message}`
            };
        }
    }

    // ════════════════════════════════════════════════════════════════
    // HELPER METHODS
    // ════════════════════════════════════════════════════════════════

    /**
     * Generate track ID from title and date
     * Format: {kebab-case-title}-{YYYYMMDD}
     */
    private generateTrackId(title: string, date: string): string {
        const kebab = title
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
        const dateStr = date.replace(/-/g, '');
        return `${kebab}-${dateStr}`;
    }

    /**
     * List all tracks from conductor/tracks/ directory
     * Reads track.md files and extracts metadata
     */
    async listTracks(): Promise<AgentResult> {
        try {
            const trackDirs = await fs.readdir(this.TRACKS_DIR, { withFileTypes: true });
            const tracks = [];

            for (const dir of trackDirs.filter(d => d.isDirectory())) {
                const trackPath = path.join(this.TRACKS_DIR, dir.name, 'track.md');
                try {
                    const trackContent = await fs.readFile(trackPath, 'utf-8');

                    // Extract metadata from track.md (first 20 lines)
                    const lines = trackContent.split('\n').slice(0, 20);
                    const title = lines.find(l => l.startsWith('# '))?.replace('# ', '').trim() || dir.name;
                    const priorityMatch = lines.find(l => l.includes('**Priority:**'));
                    const priority = priorityMatch?.match(/P[0-2]/)?.[0] || 'P2';
                    const progressMatch = lines.find(l => l.includes('**Progress:**'));
                    const progress = parseInt(progressMatch?.match(/\d+/)?.[0] || '0');

                    tracks.push({
                        id: dir.name,
                        title,
                        priority,
                        progress,
                        path: trackPath
                    });
                } catch {
                    // Skip if track.md is missing or invalid
                    logInfo(this.name, `Skipping invalid track: ${dir.name}`);
                }
            }

            return {
                success: true,
                message: `Found ${tracks.length} track(s)`,
                data: { tracks }
            };
        } catch (error: any) {
            logError(this.name, `Failed to list tracks: ${error.message}`);
            return {
                success: false,
                message: `Failed to list tracks: ${error.message}`
            };
        }
    }
}
