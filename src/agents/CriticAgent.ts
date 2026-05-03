/**
 * CriticAgent — Quality review agent for multi-agent outputs
 * 
 * Reviews other agents' output before returning to user.
 * Catches: logical errors, missing information, inconsistencies,
 * hallucinations, risky suggestions.
 * 
 * Part of the Critic Pattern in multi-agent orchestration:
 *   Manager → Specialist → Critic → User
 */

import { BaseAgent, type AgentResult, type AgentContext } from './BaseAgent.js';
import { logInfo, logWarn } from '../utils/logger.js';
import { quickReviewOutput } from '../core/criticQuickReview.js';

export interface CriticReview {
  approved: boolean;
  qualityScore: number;        // 0-1
  issues: CriticIssue[];
  suggestions: string[];
  revisedOutput?: string;      // If critic rewrites the output
}

export interface CriticIssue {
  severity: 'critical' | 'warning' | 'info';
  category: 'logic_error' | 'missing_info' | 'inconsistency' | 'risk' | 'quality' | 'hallucination';
  description: string;
  location?: string;
}

export class CriticAgent extends BaseAgent {
  readonly name = 'CriticAgent';
  readonly description = 'Quality review agent for multi-agent outputs';
  readonly role = 'QA_Critic';
  readonly capabilities = ['review_output', 'quality_check', 'risk_assessment', 'consistency_check'];

  async executeTask(context: AgentContext): Promise<AgentResult> {
    const input = context.task || '';
    const startTime = Date.now();
    logInfo('CriticAgent', `Reviewing output (${input.length} chars)...`);

    try {
      const review = this.reviewOutput(input, context);
      const durationMs = Date.now() - startTime;

      const statusParts: string[] = [];
      if (review.issues.length > 0) {
        const criticals = review.issues.filter(i => i.severity === 'critical').length;
        const warnings = review.issues.filter(i => i.severity === 'warning').length;
        if (criticals > 0) statusParts.push(`🔴 ${criticals} kritikus`);
        if (warnings > 0) statusParts.push(`🟡 ${warnings} figyelmeztetés`);
      }

      const resultMessage = review.approved
        ? `✅ Jóváhagyva (minőség: ${(review.qualityScore * 100).toFixed(0)}%)${statusParts.length > 0 ? ` — ${statusParts.join(', ')}` : ''}`
        : `❌ Elutasítva — ${statusParts.join(', ')}${review.suggestions.length > 0 ? `. Javaslat: ${review.suggestions[0]}` : ''}`;

      logInfo('CriticAgent', `Review done in ${durationMs}ms: ${resultMessage}`);

      return {
        success: true,
        message: resultMessage,
        metadata: {
          review,
          durationMs,
        },
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      logWarn('CriticAgent', `Review failed: ${error}`);
      return {
        success: false,
        message: `Critic hiba: ${error}`,
        metadata: { error },
      };
    }
  }

  /**
   * Review agent output for quality issues.
   * Uses heuristic checks — can be enhanced with LLM review for critical tasks.
   */
  reviewOutput(output: string, context?: AgentContext): CriticReview {
    const issues: CriticIssue[] = [];
    const suggestions: string[] = [];
    let qualityScore = 0.8; // baseline

    // 1. Empty/minimal output check
    if (!output || output.trim().length === 0) {
      issues.push({
        severity: 'critical',
        category: 'missing_info',
        description: 'Üres válasz — nem tartalmaz hasznos információt',
      });
      qualityScore -= 0.5;
    } else if (output.trim().length < 20) {
      issues.push({
        severity: 'warning',
        category: 'quality',
        description: 'Nagyon rövid válasz — lehet, hogy nem teljes',
      });
      qualityScore -= 0.15;
    }

    // 2. Error message leak check
    const errorPatterns = [
      /error:\s/i, /exception:\s/i, /stack\s?trace/i,
      /at\s+\w+\s*\(/i, /undefined is not/i, /cannot read propert/i,
      /ENOENT/i, /ECONNREFUSED/i, /ETIMEDOUT/i,
    ];
    for (const pattern of errorPatterns) {
      if (pattern.test(output)) {
        issues.push({
          severity: 'warning',
          category: 'quality',
          description: `Nyers hibaüzenet jelent meg a válaszban (pattern: ${pattern.source})`,
        });
        suggestions.push('A hibaüzeneteket felhasználóbarát formára kell alakítani');
        qualityScore -= 0.1;
        break;
      }
    }

    // 3. Sensitive data leak check
    const sensitivePatterns = [
      /(?:api[_\s]?key|secret|password|token|credential)\s*[:=]\s*['"]?\S{8,}/i,
      /ghp_[a-zA-Z0-9]{36}/,              // GitHub PAT
      /sk-[a-zA-Z0-9]{32,}/,              // OpenAI key
      /cfut_[a-zA-Z0-9]{20,}/,            // Cloudflare tunnel token
      /AIza[a-zA-Z0-9_-]{35}/,            // Google API key
    ];
    for (const pattern of sensitivePatterns) {
      if (pattern.test(output)) {
        issues.push({
          severity: 'critical',
          category: 'risk',
          description: 'Potenciális titok/credential szivárgás a válaszban!',
        });
        suggestions.push('AZONNAL távolítsd el a titkos kulcsokat a válaszból');
        qualityScore -= 0.4;
        break;
      }
    }

    // 4. Hallucination indicators
    const hallucinationPatterns = [
      /sajnos nem tudom|nem áll rendelkezésemre|mint AI|I apologize/i,
      /as an AI|I don't have access|I cannot/i,
    ];
    for (const pattern of hallucinationPatterns) {
      if (pattern.test(output) && context?.swarm?.activeAgent !== 'conversation') {
        issues.push({
          severity: 'info',
          category: 'hallucination',
          description: 'AI limitáció-jelző kifejezés — ellenőrizd, hogy a válasz releváns-e',
        });
        qualityScore -= 0.05;
        break;
      }
    }

    // 5. Consistency check (if task context provided)
    if (context?.task && output.length > 100) {
      const taskKeywords = context.task.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const outputLower = output.toLowerCase();
      const matchingKeywords = taskKeywords.filter(kw => outputLower.includes(kw));
      const relevance = taskKeywords.length > 0 ? matchingKeywords.length / taskKeywords.length : 1;

      if (relevance < 0.2) {
        issues.push({
          severity: 'warning',
          category: 'inconsistency',
          description: `Alacsony relevancia (${(relevance * 100).toFixed(0)}%) — a válasz nem tűnik kapcsolódónak a feladathoz`,
        });
        suggestions.push('Ellenőrizd, hogy a válasz tényleg a kért feladatra vonatkozik-e');
        qualityScore -= 0.15;
      }
    }

    // 6. Length/completeness heuristic
    if (output.length > 5000) {
      issues.push({
        severity: 'info',
        category: 'quality',
        description: 'Nagyon hosszú válasz — a felhasználó számára nehezen emészthető lehet',
      });
      suggestions.push('Fontold meg a válasz összefoglalását vagy strukturálását');
      qualityScore -= 0.05;
    }

    // 7. Hungarian language check (for user-facing content)
    const hungarianIndicators = /[áéíóöőúüű]/i;
    const englishOnlyPattern = /^[a-zA-Z0-9\s.,!?;:'"()\-\n\r\t{}[\]/*+=#@$%&|<>]+$/;
    if (output.length > 100 && englishOnlyPattern.test(output) && !hungarianIndicators.test(output)) {
      issues.push({
        severity: 'warning',
        category: 'quality',
        description: 'A válasz kizárólag angolul van — a felhasználó magyar válaszra számít',
      });
      suggestions.push('Fordítsd le a választ magyarra vagy adj magyar összefoglalót');
      qualityScore -= 0.1;
    }

    qualityScore = Math.max(0, Math.min(1, qualityScore));

    const criticalCount = issues.filter(i => i.severity === 'critical').length;
    const approved = criticalCount === 0 && qualityScore >= 0.4;

    return {
      approved,
      qualityScore,
      issues,
      suggestions,
    };
  }

  /**
   * Quick review — lightweight check for non-critical tasks.
   */
  quickReview(output: string): { ok: boolean; score: number; reason?: string } {
    return quickReviewOutput(output);
  }
}
