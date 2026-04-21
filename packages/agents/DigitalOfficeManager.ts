import { IAgent, AgentResponse } from './types.js';
import { logInfo, logError, setAgentStatus } from '@packages/utils/logger.js';

/**
 * Email Classification
 */
interface EmailMessage {
  messageId: string;
  from: string;
  to: string[];
  cc?: string[];
  subject: string;
  body: string;
  receivedDate: Date;
  isRead: boolean;
  labels: string[];
}

/**
 * Email Triage Result
 */
interface EmailTriageResult {
  messageId: string;
  from: string;
  subject: string;
  suggestedCategory: 'important' | 'action_required' | 'informational' | 'spam' | 'follow_up';
  priority: 'high' | 'medium' | 'low';
  suggestedLabels: string[];
  automatedAction?: {
    action: 'archive' | 'label' | 'snooze' | 'reply_draft';
    details: string;
  };
  confidenceScore: number; // 0-100
  reasoning: string;
}

/**
 * Inbox Automation Rule
 */
interface AutomationRule {
  id: string;
  name: string;
  trigger: {
    from?: string[];
    subject?: string[];
    keywords?: string[];
    hasAttachment?: boolean;
  };
  action: {
    addLabels?: string[];
    removeLabels?: string[];
    markAsRead?: boolean;
    archive?: boolean;
    moveToFolder?: string;
    snoozeFor?: number; // hours
  };
  enabled: boolean;
}

/**
 * Inbox Summary Report
 */
interface InboxSummaryReport {
  reportDate: Date;
  totalEmails: number;
  unreadCount: number;
  emailsByCategory: Record<string, number>;
  highPriorityCount: number;
  actionRequiredCount: number;
  automationRulesApplied: number;
  suggestedRules: AutomationRule[];
  emailsTriaged: EmailTriageResult[];
}

/**
 * DigitalOfficeManager - Digitális Irodavezető
 * Responsibility: Email triage, inbox automation, smart labeling
 * 
 * Features:
 * - Email classification (important, action-required, spam, etc.)
 * - Priority scoring
 * - Automated rules engine
 * - Smart labeling
 * - Gmail API integration (via GoogleWorkspaceTool)
 * - Configurable workflows
 */
export class DigitalOfficeManager implements IAgent {
  name = 'DigitalOfficeManager';
  role = 'Email Triage & Inbox Automation';
  description = 'Digitális Irodavezető - Triages emails, applies automation rules, prioritizes inbox';
  capabilities = ['email_triage', 'automation_rules', 'priority_scoring', 'smart_labeling', 'workflow_automation'];
  
  private automationRules: AutomationRule[] = [];
  private emailCache: Map<string, EmailTriageResult> = new Map();
  private inboxMetrics = {
    totalProcessed: 0,
    rulesApplied: 0,
    automationSuccesses: 0
  };

  /**
   * Execute email triage workflow
   */
  async execute(task: string, _context?: unknown): Promise<AgentResponse> {
    setAgentStatus(this.name, 'working', task.slice(0, 50));
    const startTime = Date.now();

    try {
      logInfo(this.name, `Starting email triage: ${task.slice(0, 40)}`);

      // Step 1: Initialize automation rules
      this.initializeAutomationRules();

      // Step 2: Fetch emails (mock)
      const emails = await this.fetchEmailsFromGmail();
      logInfo(this.name, `Fetched ${emails.length} emails from inbox`);

      // Step 3: Triage each email
      const triagedEmails = emails.map(email => this.triageEmail(email));

      // Step 4: Apply automation rules
      const rulesApplied = this.applyAutomationRules(emails);
      logInfo(this.name, `Applied ${rulesApplied} automation rule actions`);

      // Step 5: Generate inbox summary
      const summary: InboxSummaryReport = {
        reportDate: new Date(),
        totalEmails: emails.length,
        unreadCount: emails.filter(e => !e.isRead).length,
        emailsByCategory: this.categorizeEmails(triagedEmails),
        highPriorityCount: triagedEmails.filter(t => t.priority === 'high').length,
        actionRequiredCount: triagedEmails.filter(t => t.suggestedCategory === 'action_required').length,
        automationRulesApplied: rulesApplied,
        suggestedRules: this.suggestNewRules(triagedEmails),
        emailsTriaged: triagedEmails.slice(0, 10) // Top 10 for report
      };

      logInfo(this.name, `Inbox summary: ${summary.highPriorityCount} high priority, ${summary.actionRequiredCount} action required`);

      return {
        status: 'success',
        data: summary,
        metadata: {
          emailsProcessed: emails.length,
          unreadCount: summary.unreadCount,
          highPriorityCount: summary.highPriorityCount,
          automationRulesApplied: rulesApplied,
          processingTimeMs: Date.now() - startTime
        }
      };
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError(this.name, `Email triage failed: ${error}`);
      return {
        status: 'error',
        error: error,
        metadata: { emailsProcessed: this.emailCache.size }
      };
    } finally {
      setAgentStatus(this.name, 'idle');
    }
  }

  /**
   * Initialize built-in automation rules
   */
  private initializeAutomationRules(): void {
    this.automationRules = [
      {
        id: 'rule-1-newsletters',
        name: 'Auto-label newsletters',
        trigger: {
          keywords: ['newsletter', 'unsubscribe', 'promotional'],
          from: ['marketing@', 'news@']
        },
        action: {
          addLabels: ['Newsletter'],
          markAsRead: false
        },
        enabled: true
      },
      {
        id: 'rule-2-urgent',
        name: 'Flag urgent messages',
        trigger: {
          keywords: ['URGENT', 'ASAP', 'critical', 'emergency']
        },
        action: {
          addLabels: ['Urgent', 'Action Required']
        },
        enabled: true
      },
      {
        id: 'rule-3-notifications',
        name: 'Auto-archive notifications',
        trigger: {
          from: ['noreply@', 'notifications@'],
          keywords: ['notification', 'alert']
        },
        action: {
          addLabels: ['Notifications'],
          archive: false, // Don't auto-archive, just label
          snoozeFor: 7 * 24 // Re-appear in 7 days
        },
        enabled: true
      },
      {
        id: 'rule-4-invoices',
        name: 'Auto-label invoices',
        trigger: {
          keywords: ['invoice', 'receipt', 'bill', 'payment'],
          subject: ['invoice', 'receipt']
        },
        action: {
          addLabels: ['Finance', 'Invoices']
        },
        enabled: true
      },
      {
        id: 'rule-5-meetings',
        name: 'Auto-label meeting requests',
        trigger: {
          keywords: ['meeting', 'calendar', 'schedule', 'appointment'],
          subject: ['meeting', 'calendar', 'invitation']
        },
        action: {
          addLabels: ['Meetings', 'Calendar']
        },
        enabled: true
      }
    ];

    logInfo(this.name, `Initialized ${this.automationRules.filter(r => r.enabled).length} automation rules`);
  }

  /**
   * Fetch emails from Gmail (mock)
   */
  private async fetchEmailsFromGmail(): Promise<EmailMessage[]> {
    // Mock email data
    const mockEmails: EmailMessage[] = [
      {
        messageId: 'msg-1',
        from: 'boss@company.com',
        to: ['user@company.com'],
        subject: 'URGENT: Q1 Budget Review Required ASAP',
        body: 'Please review the attached Q1 budget and provide feedback by EOD today. This is critical for our planning.',
        receivedDate: new Date(),
        isRead: false,
        labels: []
      },
      {
        messageId: 'msg-2',
        from: 'marketing@newsletter.com',
        to: ['user@company.com'],
        subject: 'This Week\'s Marketing Newsletter - Feb 2026',
        body: 'Check out this week\'s top marketing insights... [Unsubscribe]',
        receivedDate: new Date(Date.now() - 3600000),
        isRead: false,
        labels: []
      },
      {
        messageId: 'msg-3',
        from: 'invoicing@vendor.hu',
        to: ['accounting@company.com', 'user@company.com'],
        subject: 'Invoice #INV-2024-1234 for Services',
        body: 'Please find attached invoice for February services rendered...',
        receivedDate: new Date(Date.now() - 7200000),
        isRead: true,
        labels: []
      },
      {
        messageId: 'msg-4',
        from: 'noreply@github.com',
        to: ['user@company.com'],
        subject: 'GitHub notification: Pull request #456 needs review',
        body: 'A pull request has been opened for your repository...',
        receivedDate: new Date(Date.now() - 86400000),
        isRead: true,
        labels: []
      },
      {
        messageId: 'msg-5',
        from: 'team@company.com',
        to: ['user@company.com'],
        subject: 'Team meeting tomorrow at 10 AM - Calendar invite',
        body: 'Please calendar block for our weekly team sync at 10 AM EST tomorrow.',
        receivedDate: new Date(Date.now() - 172800000),
        isRead: false,
        labels: []
      }
    ];

    return mockEmails;
  }

  /**
   * Triage individual email
   */
  private triageEmail(email: EmailMessage): EmailTriageResult {
    const keywords = this.extractKeywords(email);
    let category: 'important' | 'action_required' | 'informational' | 'spam' | 'follow_up' = 'informational';
    let priority: 'high' | 'medium' | 'low' = 'low';
    let confidenceScore = 75;

    // Check for urgent/action-required indicators
    if (keywords.some(k => ['urgent', 'asap', 'critical', 'emergency'].includes(k.toLowerCase()))) {
      category = 'action_required';
      priority = 'high';
      confidenceScore = 95;
    } else if (keywords.some(k => ['invoice', 'receipt', 'bill', 'payment'].includes(k.toLowerCase()))) {
      category = 'action_required';
      priority = 'medium';
      confidenceScore = 90;
    } else if (email.from.includes('@company.com') || email.from.includes('boss') || email.from.includes('ceo')) {
      category = 'important';
      priority = 'high';
      confidenceScore = 88;
    } else if (keywords.some(k => ['newsletter', 'promotional', 'unsubscribe'].includes(k.toLowerCase()))) {
      category = 'informational';
      priority = 'low';
      confidenceScore = 85;
    } else if (keywords.some(k => ['notification', 'alert'].includes(k.toLowerCase()))) {
      category = 'informational';
      priority = 'low';
      confidenceScore = 80;
    }

    const suggestedLabels = this.generateLabels(category, keywords);

    const result: EmailTriageResult = {
      messageId: email.messageId,
      from: email.from,
      subject: email.subject,
      suggestedCategory: category,
      priority: priority,
      suggestedLabels: suggestedLabels,
      automatedAction: this.suggestAutomatedAction(category, priority),
      confidenceScore: confidenceScore,
      reasoning: `Email from ${email.from} with keywords: ${keywords.join(', ')}. Categorized as ${category} with ${priority} priority.`
    };

    this.emailCache.set(email.messageId, result);
    return result;
  }

  /**
   * Extract keywords from email
   */
  private extractKeywords(email: EmailMessage): string[] {
    const content = `${email.subject} ${email.body}`.toLowerCase();
    const commonPatterns = [
      'urgent', 'asap', 'critical', 'emergency', 'important',
      'invoice', 'receipt', 'bill', 'payment',
      'newsletter', 'promotional', 'unsubscribe',
      'notification', 'alert',
      'meeting', 'calendar', 'schedule', 'appointment',
      'review', 'approval', 'feedback'
    ];

    return commonPatterns.filter(pattern => content.includes(pattern));
  }

  /**
   * Generate label suggestions
   */
  private generateLabels(category: string, keywords: string[]): string[] {
    const labels = [category.charAt(0).toUpperCase() + category.slice(1)];

    if (keywords.some(k => ['urgent', 'critical'].includes(k))) labels.push('Urgent');
    if (keywords.some(k => ['invoice', 'bill', 'payment'].includes(k))) labels.push('Finance');
    if (keywords.some(k => ['meeting', 'calendar'].includes(k))) labels.push('Meetings');
    if (keywords.some(k => ['review', 'feedback'].includes(k))) labels.push('Review');

    return labels;
  }

  /**
   * Suggest automated action
   */
  private suggestAutomatedAction(
    category: 'important' | 'action_required' | 'informational' | 'spam' | 'follow_up',
    priority: 'high' | 'medium' | 'low'
  ): { action: 'archive' | 'label' | 'snooze' | 'reply_draft'; details: string } | undefined {
    if (priority === 'high' && category === 'action_required') {
      return {
        action: 'label',
        details: 'Apply "Urgent Action Required" label and keep in inbox'
      };
    }

    if (category === 'informational' && priority === 'low') {
      return {
        action: 'snooze',
        details: 'Snooze for 24 hours - re-notify if still unread'
      };
    }

    return undefined;
  }

  /**
   * Apply automation rules to emails
   */
  private applyAutomationRules(emails: EmailMessage[]): number {
    let rulesApplied = 0;

    emails.forEach(email => {
      this.automationRules.forEach(rule => {
        if (!rule.enabled) return;

        const triggered = this.checkRuleTrigger(email, rule.trigger);
        if (triggered) {
          // Apply action (in real scenario, would call Gmail API)
          logInfo(this.name, `Applying rule "${rule.name}" to email: ${email.subject}`);
          rulesApplied++;
        }
      });
    });

    this.inboxMetrics.rulesApplied = rulesApplied;
    return rulesApplied;
  }

  /**
   * Check if rule trigger matches email
   */
  private checkRuleTrigger(email: EmailMessage, trigger: any): boolean {
    const content = `${email.subject} ${email.body}`.toLowerCase();

    if (trigger.from) {
      const fromMatches = trigger.from.some((pattern: string) =>
        email.from.toLowerCase().includes(pattern.toLowerCase())
      );
      if (!fromMatches && trigger.from.length > 0) return false;
    }

    if (trigger.keywords) {
      const keywordMatches = trigger.keywords.some((keyword: string) =>
        content.includes(keyword.toLowerCase())
      );
      if (!keywordMatches) return false;
    }

    if (trigger.subject) {
      const subjectMatches = trigger.subject.some((subPattern: string) =>
        email.subject.toLowerCase().includes(subPattern.toLowerCase())
      );
      if (!subjectMatches) return false;
    }

    return true;
  }

  /**
   * Categorize emails
   */
  private categorizeEmails(triagedEmails: EmailTriageResult[]): Record<string, number> {
    const categories: Record<string, number> = {};

    triagedEmails.forEach(email => {
      categories[email.suggestedCategory] = (categories[email.suggestedCategory] || 0) + 1;
    });

    return categories;
  }

  /**
   * Suggest new automation rules based on triaged emails
   */
  private suggestNewRules(triagedEmails: EmailTriageResult[]): AutomationRule[] {
    const suggestions: AutomationRule[] = [];

    // Suggest rule for frequent senders with action_required
    const actionRequiredByFrom: Record<string, number> = {};
    triagedEmails
      .filter(t => t.suggestedCategory === 'action_required')
      .forEach(t => {
        actionRequiredByFrom[t.from] = (actionRequiredByFrom[t.from] || 0) + 1;
      });

    Object.entries(actionRequiredByFrom).forEach(([from, count]) => {
      if (count >= 2) {
        suggestions.push({
          id: `suggested-${Date.now()}-${Math.random()}`,
          name: `Auto-flag action items from ${from}`,
          trigger: { from: [from] },
          action: { addLabels: ['Action Required', 'High Priority'] },
          enabled: false
        });
      }
    });

    return suggestions.slice(0, 3); // Top 3 suggestions
  }
}

/**
 * Export for registry
 */
export const createDigitalOfficeManager = (): DigitalOfficeManager => new DigitalOfficeManager();

export default DigitalOfficeManager;

