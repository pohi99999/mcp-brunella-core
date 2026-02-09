// FILE: src/agents/codeReview.ts
// PURPOSE: Code Review engine for Developer Agent 3.0 (P4)
// VERSION: 3.0

import { logInfo, logError } from '../utils/logger.js';
import { generateResponse } from '../core/llm_client.js';
import fs from 'fs/promises';
import path from 'path';

// ==================== Types ====================

export type ReviewSeverity = 'critical' | 'warning' | 'info' | 'suggestion';

export interface ReviewFinding {
    severity: ReviewSeverity;
    line?: number;
    endLine?: number;
    message: string;
    rule?: string;
    suggestion?: string;
}

export interface ReviewResult {
    filePath: string;
    fileName: string;
    language: string;
    findings: ReviewFinding[];
    summary: string;
    score: number; // 0-100
    reviewedAt: number;
    stats: {
        critical: number;
        warning: number;
        info: number;
        suggestion: number;
        total: number;
    };
}

export interface RefactorResult {
    filePath: string;
    originalCode: string;
    refactoredCode: string;
    changes: string[];
    instruction: string;
    refactoredAt: number;
}

// ==================== Constants ====================

const REVIEW_SYSTEM_PROMPT = `You are an expert code reviewer for the Brunella Agent System (TypeScript/Node.js/React).

Analyze the code and provide a structured review as JSON. Focus on:
1. **Critical** issues: Security vulnerabilities, data loss risks, crashes
2. **Warnings**: Performance problems, memory leaks, incorrect logic
3. **Info**: Code style, best practice violations
4. **Suggestions**: Improvements, cleaner patterns, better abstractions

Project conventions to check:
- ESM imports with .js extensions
- No \`any\` types (use \`unknown\`)
- Use logger.ts (logInfo/logError), NEVER console.log
- Proper error handling with try/catch
- Agents must implement IAgent interface

Respond ONLY with valid JSON in this format:
{
  "findings": [
    { "severity": "critical|warning|info|suggestion", "line": 10, "message": "Description", "rule": "RULE_ID", "suggestion": "How to fix" }
  ],
  "summary": "Brief overall assessment",
  "score": 85
}`;

const REFACTOR_SYSTEM_PROMPT = `You are an expert TypeScript/JavaScript refactoring specialist.
Given code and a refactoring instruction, apply ONLY the requested changes.
Maintain all existing functionality. Return ONLY the refactored code, nothing else.
Follow BAS conventions: ESM .js imports, no any, logger.ts instead of console.log.`;

const LANGUAGE_MAP: Record<string, string> = {
    '.ts': 'typescript',
    '.tsx': 'typescript-react',
    '.js': 'javascript',
    '.jsx': 'javascript-react',
    '.py': 'python',
    '.json': 'json',
    '.md': 'markdown',
    '.css': 'css',
    '.html': 'html',
    '.sql': 'sql',
};

// ==================== Code Review Engine ====================

/**
 * CodeReviewEngine provides LLM-powered code review and refactoring.
 */
export class CodeReviewEngine {
    private llmProvider: string;
    private llmModel: string;
    private reviewHistory: ReviewResult[] = [];
    private maxHistory = 50;

    constructor(
        provider = process.env.LLM_PROVIDER || 'github',
        model = 'gpt-4o'
    ) {
        this.llmProvider = provider;
        this.llmModel = model;
    }

    /**
     * Review a single file
     */
    async reviewFile(filePath: string): Promise<ReviewResult> {
        logInfo('CodeReview', `Reviewing: ${filePath}`);

        const absolutePath = path.isAbsolute(filePath)
            ? filePath
            : path.resolve(process.cwd(), filePath);

        // Read file
        let code: string;
        try {
            code = await fs.readFile(absolutePath, 'utf-8');
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            throw new Error(`Cannot read file: ${msg}`);
        }

        const ext = path.extname(absolutePath);
        const language = LANGUAGE_MAP[ext] || 'unknown';
        const fileName = path.basename(absolutePath);

        // Build prompt
        const prompt = `Review this ${language} file (${fileName}):\n\n\`\`\`${language}\n${code}\n\`\`\``;
        const fullPrompt = `System Prompt: ${REVIEW_SYSTEM_PROMPT}\n\nUser Prompt: ${prompt}`;

        // Call LLM
        const rawResponse = await generateResponse(fullPrompt, this.llmProvider, this.llmModel);

        // Parse LLM response
        const parsed = this.parseReviewResponse(rawResponse);

        const result: ReviewResult = {
            filePath: absolutePath,
            fileName,
            language,
            findings: parsed.findings,
            summary: parsed.summary,
            score: parsed.score,
            reviewedAt: Date.now(),
            stats: this.calculateStats(parsed.findings),
        };

        // Store in history
        this.reviewHistory.unshift(result);
        if (this.reviewHistory.length > this.maxHistory) {
            this.reviewHistory = this.reviewHistory.slice(0, this.maxHistory);
        }

        logInfo('CodeReview', `Review complete: ${fileName} — score ${result.score}/100, ${result.stats.total} findings`);
        return result;
    }

    /**
     * Review code string directly (without file)
     */
    async reviewCode(code: string, language = 'typescript', fileName = 'inline'): Promise<ReviewResult> {
        logInfo('CodeReview', `Reviewing inline code (${language})`);

        const prompt = `Review this ${language} code:\n\n\`\`\`${language}\n${code}\n\`\`\``;
        const fullPrompt = `System Prompt: ${REVIEW_SYSTEM_PROMPT}\n\nUser Prompt: ${prompt}`;

        const rawResponse = await generateResponse(fullPrompt, this.llmProvider, this.llmModel);
        const parsed = this.parseReviewResponse(rawResponse);

        const result: ReviewResult = {
            filePath: '<inline>',
            fileName,
            language,
            findings: parsed.findings,
            summary: parsed.summary,
            score: parsed.score,
            reviewedAt: Date.now(),
            stats: this.calculateStats(parsed.findings),
        };

        this.reviewHistory.unshift(result);
        return result;
    }

    /**
     * Refactor a file with a specific instruction
     */
    async refactorFile(filePath: string, instruction: string): Promise<RefactorResult> {
        logInfo('CodeReview', `Refactoring: ${filePath} — "${instruction.slice(0, 60)}"`);

        const absolutePath = path.isAbsolute(filePath)
            ? filePath
            : path.resolve(process.cwd(), filePath);

        const originalCode = await fs.readFile(absolutePath, 'utf-8');
        const ext = path.extname(absolutePath);
        const language = LANGUAGE_MAP[ext] || 'typescript';

        const prompt = `Refactor this ${language} code:\n\n\`\`\`${language}\n${originalCode}\n\`\`\`\n\nInstruction: ${instruction}`;
        const fullPrompt = `System Prompt: ${REFACTOR_SYSTEM_PROMPT}\n\nUser Prompt: ${prompt}`;

        const rawResponse = await generateResponse(fullPrompt, this.llmProvider, this.llmModel);

        // Extract code from markdown code block if present
        const refactoredCode = this.extractCode(rawResponse);

        // Compute change summary
        const changes = this.computeChangeSummary(originalCode, refactoredCode);

        const result: RefactorResult = {
            filePath: absolutePath,
            originalCode,
            refactoredCode,
            changes,
            instruction,
            refactoredAt: Date.now(),
        };

        logInfo('CodeReview', `Refactoring complete: ${changes.length} change(s)`);
        return result;
    }

    /**
     * Get review history
     */
    getHistory(limit = 20): ReviewResult[] {
        return this.reviewHistory.slice(0, limit);
    }

    /**
     * Get stats across all reviews
     */
    getAggregateStats(): {
        totalReviews: number;
        avgScore: number;
        totalFindings: number;
        bySeverity: Record<ReviewSeverity, number>;
    } {
        const totalReviews = this.reviewHistory.length;
        if (totalReviews === 0) {
            return {
                totalReviews: 0,
                avgScore: 0,
                totalFindings: 0,
                bySeverity: { critical: 0, warning: 0, info: 0, suggestion: 0 },
            };
        }

        const avgScore = Math.round(
            this.reviewHistory.reduce((sum, r) => sum + r.score, 0) / totalReviews
        );

        const bySeverity: Record<ReviewSeverity, number> = { critical: 0, warning: 0, info: 0, suggestion: 0 };
        let totalFindings = 0;

        for (const review of this.reviewHistory) {
            totalFindings += review.stats.total;
            bySeverity.critical += review.stats.critical;
            bySeverity.warning += review.stats.warning;
            bySeverity.info += review.stats.info;
            bySeverity.suggestion += review.stats.suggestion;
        }

        return { totalReviews, avgScore, totalFindings, bySeverity };
    }

    // ==================== Private Helpers ====================

    private parseReviewResponse(raw: string): { findings: ReviewFinding[]; summary: string; score: number } {
        try {
            // Try to extract JSON from the response
            const jsonMatch = raw.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                return {
                    findings: [{ severity: 'info', message: raw.slice(0, 500), rule: 'PARSE_FALLBACK' }],
                    summary: 'Could not parse structured review response',
                    score: 50,
                };
            }

            const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

            const findings: ReviewFinding[] = Array.isArray(parsed.findings)
                ? (parsed.findings as Array<Record<string, unknown>>).map(f => ({
                    severity: (['critical', 'warning', 'info', 'suggestion'].includes(String(f.severity))
                        ? String(f.severity)
                        : 'info') as ReviewSeverity,
                    line: typeof f.line === 'number' ? f.line : undefined,
                    endLine: typeof f.endLine === 'number' ? f.endLine : undefined,
                    message: String(f.message || ''),
                    rule: f.rule ? String(f.rule) : undefined,
                    suggestion: f.suggestion ? String(f.suggestion) : undefined,
                }))
                : [];

            return {
                findings,
                summary: typeof parsed.summary === 'string' ? parsed.summary : 'No summary provided',
                score: typeof parsed.score === 'number' ? Math.max(0, Math.min(100, parsed.score)) : 50,
            };
        } catch {
            return {
                findings: [{ severity: 'info', message: raw.slice(0, 500), rule: 'PARSE_ERROR' }],
                summary: 'Failed to parse LLM review response',
                score: 50,
            };
        }
    }

    private calculateStats(findings: ReviewFinding[]): ReviewResult['stats'] {
        const stats = { critical: 0, warning: 0, info: 0, suggestion: 0, total: findings.length };
        for (const f of findings) {
            if (f.severity in stats) {
                stats[f.severity as keyof typeof stats]++;
            }
        }
        return stats;
    }

    private extractCode(response: string): string {
        // Try markdown code block extraction
        const codeMatch = response.match(/```(?:\w+)?\s*\n([\s\S]*?)```/);
        if (codeMatch) return codeMatch[1].trim();
        return response.trim();
    }

    private computeChangeSummary(original: string, refactored: string): string[] {
        const changes: string[] = [];
        const origLines = original.split('\n');
        const refLines = refactored.split('\n');

        if (origLines.length !== refLines.length) {
            changes.push(`Line count changed: ${origLines.length} → ${refLines.length}`);
        }

        let changedLines = 0;
        const maxLen = Math.max(origLines.length, refLines.length);
        for (let i = 0; i < maxLen; i++) {
            if (origLines[i] !== refLines[i]) changedLines++;
        }

        if (changedLines > 0) {
            changes.push(`${changedLines} line(s) modified`);
        }

        if (changes.length === 0) {
            changes.push('No changes detected');
        }

        return changes;
    }
}

// Singleton
export const codeReviewEngine = new CodeReviewEngine();
