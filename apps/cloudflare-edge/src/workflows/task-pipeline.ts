import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';
import { parseAiResponse, safeJsonParse } from '@packages/utils/aiHelpers.js';

interface Env {
  DB: D1Database;
  AI: Ai;
  BAS_ANALYTICS: AnalyticsEngineDataset;
  TASK_QUEUE: Queue;
  R2_ARTIFACTS: R2Bucket;
  DEFAULT_CODE_MODEL: string;
  REASONING_MODEL: string;
  FAST_MODEL: string;
}

interface TaskPipelinePayload {
  taskId: string;
  instruction: string;
  type: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
}

export class TaskPipelineWorkflow extends WorkflowEntrypoint<Env> {
  async run(event: WorkflowEvent<TaskPipelinePayload>, step: WorkflowStep) {
    const { taskId, instruction, type, priority } = event.payload;

    // Step 1: AI Analysis — decompose complex tasks
    const analysis = await step.do('analyze-task', async () => {
      const model = priority === 'critical' || type === 'code'
        ? (this.env.REASONING_MODEL || '@cf/deepseek/deepseek-r1-distill-qwen-32b')
        : (this.env.FAST_MODEL || '@cf/microsoft/phi-4');

      try {
        const modelName = typeof model === 'string' ? model : String(model ?? '');
        const aiRaw = await this.env.AI.run(modelName as any, {
            messages: [
            {
              role: 'system',
              content: `You are a task analysis engine. Analyze the task and return a JSON object with:
- "subtasks": array of subtask descriptions (max 5)
- "estimatedComplexity": "simple" | "medium" | "complex"
- "requiredAgents": array of agent types needed ("developer", "researcher", "devops", "browser", "general")
- "riskLevel": "low" | "medium" | "high"
Respond with ONLY valid JSON.`,
            },
            { role: 'user', content: `Task type: ${type}\nInstruction: ${instruction}` },
          ],
          max_tokens: 500,
          });

          const { text: responseText } = parseAiResponse(aiRaw);
          const parsed = safeJsonParse(responseText, {
            subtasks: [instruction],
            estimatedComplexity: 'simple',
            requiredAgents: ['general'],
            riskLevel: 'low',
          });

          return parsed;
      } catch {
        return {
          subtasks: [instruction],
          estimatedComplexity: 'simple',
          requiredAgents: ['general'],
          riskLevel: 'low',
        };
      }
    });

    // Step 2: Update task status in D1
    await step.do('update-status-analyzing', async () => {
      await this.env.DB.prepare(
        'UPDATE tasks SET status = ?, metadata = ? WHERE id = ?'
      ).bind('analyzing', JSON.stringify({ ...analysis, pipeline: true }), taskId).run();
    });

    // Step 3: Enqueue subtasks if complex
    const subtaskResults = await step.do('dispatch-subtasks', async () => {
      if (analysis.subtasks.length <= 1) {
        return { dispatched: 0, mode: 'direct' };
      }

      for (const subtask of analysis.subtasks) {
        await this.env.TASK_QUEUE.send({
          taskId: `${taskId}_sub_${Date.now()}`,
          instruction: subtask,
          type,
          priority,
          parentTaskId: taskId,
          createdAt: new Date().toISOString(),
        });
      }

      return { dispatched: analysis.subtasks.length, mode: 'parallel' };
    });

    // Step 4: Record analytics
    await step.do('record-analytics', async () => {
      if (this.env.BAS_ANALYTICS) {
        this.env.BAS_ANALYTICS.writeDataPoint({
          blobs: [taskId, type, analysis.estimatedComplexity, priority],
          doubles: [analysis.subtasks.length, subtaskResults.dispatched],
          indexes: ['task_pipeline'],
        });
      }
    });

    // Step 5: Store analysis artifact in R2
    await step.do('store-artifact', async () => {
      if (this.env.R2_ARTIFACTS) {
        await this.env.R2_ARTIFACTS.put(
          `pipeline/${taskId}/analysis.json`,
          JSON.stringify({ analysis, subtaskResults, timestamp: new Date().toISOString() }),
          { httpMetadata: { contentType: 'application/json' } }
        );
      }
    });

    // Step 6: Final status update
    await step.do('finalize', async () => {
      await this.env.DB.prepare(
        'UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?'
      ).bind(
        subtaskResults.dispatched > 0 ? 'dispatched' : 'ready',
        Date.now(),
        taskId
      ).run();
    });

    return {
      taskId,
      analysis,
      subtaskResults,
      completedAt: new Date().toISOString(),
    };
  }
}

