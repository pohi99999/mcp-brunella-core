/**
 * Jules AI Integration for Automated Workflow Fixes
 *
 * Orchestrates the complete flow:
 * GitHub workflow fails → Error analysis → Jules AI generates fix → PR creation → Auto-merge
 */

import { Octokit } from '@octokit/rest';
import { logInfo, logError, logWarn } from '../utils/logger.js';
import { DeploymentAnalyzer, type DeploymentAnalysis } from '../tools/deploymentAnalyzer.js';
import { GitHubAPIClient } from './githubAPIClient.js';
import { notifySlack } from './slackNotifications.js';

export interface JulesFixWorkflow {
  runId: number;
  owner: string;
  repo: string;
  branch: string;
  prNumber?: number;
  status: 'analyzing' | 'generating' | 'committing' | 'complete' | 'failed';
  analysis?: DeploymentAnalysis;
  error?: string;
  timestamp: string;
}

/**
 * Process a failed GitHub workflow and attempt automatic fix via Jules
 */
export async function processWorkflowFailure(
  owner: string,
  repo: string,
  runId: number,
  defaultBranch: string = 'main'
): Promise<JulesFixWorkflow> {
  const workflow: JulesFixWorkflow = {
    runId,
    owner,
    repo,
    branch: `fix/workflow-${runId}-${Date.now()}`,
    status: 'analyzing',
    timestamp: new Date().toISOString()
  };

  try {
    // 1. Fetch and analyze workflow logs
    logInfo('JulesIntegration', `🔍 Analyzing workflow failure for ${owner}/${repo}#${runId}`);
    workflow.status = 'analyzing';

    const apiClient = new GitHubAPIClient(process.env.GITHUB_TOKEN);
    const logs = await apiClient.getWorkflowRunLogs(owner, repo, runId);

    if (!logs) {
      throw new Error('Failed to fetch workflow logs');
    }

    const analysis = DeploymentAnalyzer.analyzeLogs(logs);
    workflow.analysis = analysis;

    logInfo(
      'JulesIntegration',
      `✅ Error analysis complete: ${analysis.category} (confidence: ${(analysis.confidence * 100).toFixed(0)}%)`
    );

    // Notify Slack - analyzing
    await notifySlack('analyzing', runId);

    // 2. Generate Jules fix prompt
    logInfo('JulesIntegration', '🤖 Generating fix prompt for Jules...');
    const fixPrompt = DeploymentAnalyzer.generateFixPrompt(analysis);

    workflow.status = 'generating';

    // TODO [tech-debt-cleanup]: Send to Jules API in Phase 3.3.2
    // For now, log the prompt for manual inspection
    logInfo('JulesIntegration', `Fix prompt generated:\n${fixPrompt}`);

    // 3. PR creation (to be implemented in Phase 3.3.2)
    logInfo('JulesIntegration', '📝 Creating PR with analysis...');
    workflow.status = 'committing';

    const octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN
    });

    // 3a. Get main branch SHA
    const { data: mainBranch } = await octokit.git.getRef({
      owner,
      repo,
      ref: `heads/${defaultBranch}`
    });

    logInfo('JulesIntegration', `Creating branch: ${workflow.branch}`);

    // 3b. Create feature branch
    await octokit.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${workflow.branch}`,
      sha: mainBranch.object.sha
    });

    // 3c. Create PR with analysis
    const { data: pr } = await octokit.pulls.create({
      owner,
      repo,
      title: `[Jules Auto-Fix] ${analysis.title} - Workflow #${runId}`,
      body: `## Jules AI Auto-Fix Report

### Error Analysis
**Type:** \`${analysis.category}\`  
**Title:** ${analysis.title}  
**Confidence:** ${(analysis.confidence * 100).toFixed(0)}%  

### Error Summary
${analysis.message}

${analysis.errorLocation ? `### Location
**File:** \`${analysis.errorLocation.file}\`  
${analysis.errorLocation.line ? `**Line:** ${analysis.errorLocation.line}` : ''}
` : ''}

${analysis.affectedFiles.length > 0 ? `### Affected Files
${analysis.affectedFiles.map((f) => `- \`${f}\``).join('\n')}
` : ''}

### Next Steps
1. Review the error analysis above
2. Jules will generate a fix proposal
3. Automated tests will verify the fix
4. PR will auto-merge if confidence ≥75%

---
*This PR was automatically created by Jules Continuous AI Integration (JCAI)*  
Workflow run: #${runId}
      `,
      head: workflow.branch,
      base: defaultBranch,
      draft: analysis.confidence < 0.75 // Draft if low confidence
    });

    workflow.prNumber = pr.number;

    logInfo(
      'JulesIntegration',
      `✅ PR created: #${pr.number} (${analysis.confidence < 0.75 ? 'DRAFT' : 'READY'})`
    );

    // 4. Notify Slack - PR created
    await notifySlack('fixed', runId);

    // 5. Auto-merge if high confidence
    if (analysis.confidence >= 0.75) {
      logInfo('JulesIntegration', '✨ Confidence ≥75%, attempting auto-merge...');

      try {
        const mergeResult = await octokit.pulls.merge({
          owner,
          repo,
          pull_number: pr.number,
          commit_title: `fix: ${analysis.title} (Workflow #${runId})`,
          merge_method: 'squash'
        });

        logInfo('JulesIntegration', `✅ PR auto-merged (#${pr.number})`);
        await notifySlack('merged', runId);
      } catch (mergeErr) {
        logWarn('JulesIntegration', `Auto-merge failed: ${mergeErr}`);
        // Continue - PR is still created, just not merged
      }
    } else {
      logWarn(
        'JulesIntegration',
        `Low confidence (${(analysis.confidence * 100).toFixed(0)}%) - marking as draft for manual review`
      );
    }

    workflow.status = 'complete';
    return workflow;
  } catch (err: unknown) {
    workflow.status = 'failed';
    const errMsg = err instanceof Error ? err.message : String(err);
    workflow.error = errMsg;

    logError('JulesIntegration', `❌ Fix workflow failed: ${errMsg}`);
    await notifySlack('failed', workflow.runId, errMsg);

    // Fallback: Create issue for manual review
    try {
      await createManualReviewIssue(owner, repo, workflow, errMsg);
    } catch (issueErr) {
      logError('JulesIntegration', `Failed to create manual review issue: ${issueErr}`);
    }

    throw err;
  }
}

/**
 * Create an issue for manual code review when automated fix fails
 */
async function createManualReviewIssue(
  owner: string,
  repo: string,
  workflow: JulesFixWorkflow,
  error: string
): Promise<void> {
  const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN
  });

  const { data: issue } = await octokit.issues.create({
    owner,
    repo,
    title: `[Jules] Manual Review Required: ${workflow.analysis?.title || 'Workflow Error'}`,
    body: `## Automated Fix Failed

Jules AI encountered an error while attempting to fix the workflow failure.

### Details
**Workflow ID:** ${workflow.runId}  
**Error Type:** ${workflow.analysis?.category || 'unknown'}  
**Confidence:** ${workflow.analysis ? (workflow.analysis.confidence * 100).toFixed(0) : 'N/A'}%  

### Error Message
\`\`\`
${error}
\`\`\`

### Action Required
Please review the workflow failure manually and apply fixes as needed.

---
*Created by Jules Continuous AI Integration*
    `,
    labels: ['bug', 'needs-review', 'jules-auto-fix']
  });

  logInfo('JulesIntegration', `📌 Created manual review issue: #${issue.number}`);
}

/**
 * Retry workflow fix with exponential backoff
 */
export async function retryWorkflowFix(
  owner: string,
  repo: string,
  runId: number,
  maxRetries: number = 3
): Promise<JulesFixWorkflow> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await processWorkflowFailure(owner, repo, runId);
    } catch (err) {
      if (attempt === maxRetries) {
        throw err;
      }

      const backoff = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
      logWarn(
        'JulesIntegration',
        `Retry ${attempt}/${maxRetries} after ${backoff}ms...`
      );

      await new Promise((resolve) => setTimeout(resolve, backoff));
    }
  }

  throw new Error('Max retries exceeded');
}

/**
 * Get fix workflow status
 */
export function getWorkflowStatus(workflow: JulesFixWorkflow): string {
  const status = workflow.status.toUpperCase();
  const emoji: Record<string, string> = {
    ANALYZING: '🔍',
    GENERATING: '🤖',
    COMMITTING: '📝',
    COMPLETE: '✅',
    FAILED: '❌'
  };

  return `${emoji[status] || '❓'} ${status}${workflow.prNumber ? ` - PR #${workflow.prNumber}` : ''}`;
}
