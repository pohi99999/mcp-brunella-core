import { readFileSync } from 'fs';
import path from 'path';
// @ts-ignore
import YAML from 'yaml';
import { logInfo, logError, logWarn } from '../utils/logger.js';

export interface JulesConfig {
  version: string;
  workflows: JulesWorkflow[];
  automationRules?: JulesAutomationRule[];
}

export interface JulesWorkflow {
  name: string;
  description?: string;
  trigger: string;
  steps: JulesStep[];
  schedule?: string;
}

export interface JulesStep {
  name: string;
  action: string;
  config?: Record<string, unknown>;
}

export interface JulesAutomationRule {
  id: string;
  name: string;
  description?: string;
  trigger: string;
  criteria?: Record<string, unknown>;
  actions: JulesAction[];
  schedule?: string;
  enabled: boolean;
}

export interface JulesAction {
  type: string;
  target: string;
  params?: Record<string, unknown>;
}

export class JulesConfigParser {
  private configPath: string;
  private config: JulesConfig | null = null;

  constructor(configPath: string = '.jules.yml') {
    this.configPath = path.resolve(process.cwd(), configPath);
  }

  /**
   * Load and parse Jules config file
   */
  load(): JulesConfig {
    try {
      logInfo('JulesParser', `Loading config from ${this.configPath}`);
      const content = readFileSync(this.configPath, 'utf-8');
      this.config = YAML.parse(content) as JulesConfig;

      logInfo('JulesParser', `Loaded ${this.config?.workflows?.length || 0} workflows`);
      return this.config!;
    } catch (error) {
      logError('JulesParser', `Failed to load config: ${error}`);
      throw error;
    }
  }

  /**
   * Get all automation rules that can be converted to scheduled tasks
   */
  getAutomationRules(): JulesAutomationRule[] {
    if (!this.config) {
      this.load();
    }

    const rules = this.config?.automationRules || [];
    return rules.filter((r) => r.enabled !== false);
  }

  /**
   * Get workflows that match a trigger
   */
  getWorkflowsByTrigger(trigger: string): JulesWorkflow[] {
    if (!this.config) {
      this.load();
    }

    return this.config?.workflows?.filter((w) => w.trigger === trigger) || [];
  }

  /**
   * Convert Jules automation rule to scheduled task spec
   */
  ruleToScheduledTask(rule: JulesAutomationRule): ScheduledTaskSpec {
    const cronExpression = rule.schedule || '0 0 * * *'; // Default: daily at midnight

    return {
      title: rule.name,
      prompt: rule.description || `Run automation: ${rule.name}`,
      cron_expression: cronExpression,
      handler: 'jules_automation',
      metadata: {
        source: 'jules_config',
        ruleId: rule.id,
        trigger: rule.trigger,
        actions: rule.actions,
      },
    };
  }

  /**
   * Convert all automation rules to scheduled tasks
   */
  toScheduledTasks(): ScheduledTaskSpec[] {
    return this.getAutomationRules().map((rule) => this.ruleToScheduledTask(rule));
  }
}

export interface ScheduledTaskSpec {
  title: string;
  prompt: string;
  cron_expression: string;
  handler: string;
  metadata?: Record<string, unknown>;
}
