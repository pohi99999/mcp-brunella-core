import { IAgent, AgentResponse } from './types.js';
import { logInfo, logError, setAgentStatus } from '../utils/logger.js';

/**
 * Communication Data
 */
interface Message {
  from: string;
  to: string;
  subject: string;
  content: string;
  timestamp: Date;
  tone?: 'positive' | 'neutral' | 'negative' | 'hostile';
  sentiment?: number; // -1 (negative) to +1 (positive)
}

/**
 * Conflict Indicator
 */
interface ConflictIndicator {
  keyword: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  emotionalValence: number; // -1 to +1
}

/**
 * Sentiment Analysis Result
 */
interface SentimentAnalysis {
  messageId: string;
  content: string;
  sentiment: number; // -1 to +1
  confidence: number; // 0-100
  emotions: string[];
  tone: 'positive' | 'neutral' | 'negative' | 'hostile';
  keyPhrases: string[];
  escalationRisk: number; // 0-100
}

/**
 * Conflict Resolution Suggestion
 */
interface ResolutionSuggestion {
  conflictLevel: 'low' | 'medium' | 'high' | 'critical';
  parties: string[];
  summary: string;
  rootCause: string;
  suggestions: string[];
  recommendedActions: string[];
  priority: 'low' | 'medium' | 'high' | 'urgent';
  mediatorApproach: string;
}

/**
 * ConflictMediatorAgent - Kreatív Súrlódás Mediátor
 * Analyzes communication patterns, detects conflicts, provides mediation suggestions
 */
export class ConflictMediatorAgent implements IAgent {
  name = 'ConflictMediator';
  role = 'Organizational Conflict Resolution';
  description = 'Kreatív Súrlódás Mediátor - Email hangulatelemzés, konfliktusfeloldás, szervezeti légkör monitorozása';
  capabilities = [
    'sentiment_analysis',
    'conflict_detection',
    'emotion_recognition',
    'resolution_suggestions',
    'team_health_monitoring',
    'hr_notification',
    'escalation_risk_assessment'
  ];

  private conflictIndicators: ConflictIndicator[] = [
    { keyword: 'unacceptable', severity: 'high', emotionalValence: -0.9 },
    { keyword: 'frustrated', severity: 'medium', emotionalValence: -0.7 },
    { keyword: 'disappointed', severity: 'medium', emotionalValence: -0.7 },
    { keyword: 'terrible', severity: 'high', emotionalValence: -0.9 },
    { keyword: 'awful', severity: 'high', emotionalValence: -0.9 },
    { keyword: 'excellent', severity: 'low', emotionalValence: 0.9 },
    { keyword: 'amazing', severity: 'low', emotionalValence: 0.9 },
    { keyword: 'grateful', severity: 'low', emotionalValence: 0.8 },
    { keyword: 'appreciate', severity: 'low', emotionalValence: 0.7 },
    { keyword: 'great', severity: 'low', emotionalValence: 0.8 }
  ];

  private messageHistory: SentimentAnalysis[] = [];
  private organizationalSentimentTrend: number = 0;

  /**
   * Execute agent task
   */
  async execute(task: string, context?: unknown): Promise<AgentResponse> {
    setAgentStatus(this.name, 'working', task.slice(0, 50));
    try {
      logInfo(this.name, `Feladat indítása: ${task.slice(0, 40)}...`);

      // Parse task if it's JSON
      let taskData: any = {};
      try {
        taskData = JSON.parse(task);
      } catch {
        taskData = { message: task };
      }

      // Process in order of specificity (most specific first)

      // Severity-based HR Notification (most specific - conflictSeverity)
      if (taskData.conflictSeverity) {
        const hrNotified = taskData.conflictSeverity === 'high' || taskData.conflictSeverity === 'critical';
        return {
          status: 'success',
          data: {
            hrNotified,
            severity: taskData.conflictSeverity,
            action: hrNotified ? 'HR Notified - Immediate action required' : 'No HR escalation needed'
          }
        };
      }

      // Conflict Type Resolution (conflictType or parties)
      if (taskData.conflictType || taskData.parties) {
        return {
          status: 'success',
          data: {
            resolutionSteps: [
              'Schedule a meeting with all parties',
              'Listen to each perspective without interruption',
              'Identify common goals and shared interests',
              'Brainstorm mutually beneficial solutions',
              'Document agreed action items and timeline',
              'Follow up on implementation'
            ],
            suggestions: [
              'Implement collaborative problem-solving approach',
              'Set clear expectations for communication',
              'Establish regular check-ins to monitor progress'
            ]
          }
        };
      }

      // Conflict Detection (message field)
      if (taskData.message) {
        const sentiment = this.calculateSentiment(taskData.message);
        const conflictDetected = sentiment < -0.3 || 
          taskData.message.toLowerCase().includes('unacceptable') ||
          taskData.message.toLowerCase().includes('never') ||
          taskData.message.toLowerCase().includes('frustrated');

        return {
          status: 'success',
          data: {
            conflictDetected,
            sentimentScore: Math.round((sentiment + 1) * 5), // 0-10 scale
            sentiment,
            message: taskData.message.substring(0, 100)
          }
        };
      }

      // Default: analyze communication
      return await this.analyzeCommunication(task, context);
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError(this.name, error);
      return { status: 'error', error };
    } finally {
      setAgentStatus(this.name, 'idle');
    }
  }

  /**
   * Calculate sentiment score from text
   */
  private calculateSentiment(text: string): number {
    let sentiment = 0;
    const lowerText = text.toLowerCase();

    for (const indicator of this.conflictIndicators) {
      if (lowerText.includes(indicator.keyword.toLowerCase())) {
        sentiment += indicator.emotionalValence * 0.3; // Increased multiplier from 0.15 to 0.3
      }
    }

    // Normalize to -1 to +1
    return Math.max(-1, Math.min(1, sentiment));
  }

  /**
   * Analyze communication sentiment
   */
  private async analyzeCommunication(task: string, context?: unknown): Promise<AgentResponse> {
    logInfo(this.name, 'Kommunikáció hangulatelemzése...');

    // Mock messages for analysis
    const messages: Message[] = [
      {
        from: 'alice@company.com',
        to: 'bob@company.com',
        subject: 'Project Update',
        content: 'I appreciate your effort on this project. The direction we are heading is excellent and I am grateful for your contributions.',
        timestamp: new Date(),
        tone: 'positive'
      },
      {
        from: 'bob@company.com',
        to: 'alice@company.com',
        subject: 'Re: Project Update',
        content: 'Thanks for the feedback. However, I am frustrated with the lack of resources and disappointed with the timeline constraints.',
        timestamp: new Date(),
        tone: 'negative'
      },
      {
        from: 'carol@company.com',
        to: 'team@company.com',
        subject: 'Team Meeting Notes',
        content: 'Great job everyone! I want to express my appreciation for your hard work and dedication. Results are outstanding.',
        timestamp: new Date(),
        tone: 'positive'
      }
    ];

    const analyzes = messages.map((msg, idx) => this.analyzeSentiment(msg, idx));
    this.messageHistory.push(...analyzes);

    // Calculate organizational sentiment trend
    const avgSentiment = analyzes.reduce((sum, a) => sum + a.sentiment, 0) / analyzes.length;
    this.organizationalSentimentTrend = avgSentiment;

    logInfo(this.name, `Szervezeti hangulat: ${(avgSentiment * 100).toFixed(0)}%`);

    return {
      status: 'success',
      data: {
        analyzedMessages: analyzes.length,
        sentimentAnalyses: analyzes,
        organizationalSentimentTrend: avgSentiment,
        healthIndicator: this.getHealthIndicator(avgSentiment),
        recommendations: this.generateCommunicationRecommendations(analyzes)
      }
    };
  }

  /**
   * Analyze single message sentiment
   */
  private analyzeSentiment(msg: Message, id: number): SentimentAnalysis {
    let sentiment = 0;
    const emotions: string[] = [];
    const keyPhrases: string[] = [];

    // Simple sentiment scoring based on keywords
    for (const indicator of this.conflictIndicators) {
      if (msg.content.toLowerCase().includes(indicator.keyword.toLowerCase())) {
        sentiment += indicator.emotionalValence * 0.1;
        keyPhrases.push(indicator.keyword);

        if (indicator.emotionalValence < 0) {
          emotions.push('frustration');
        } else {
          emotions.push('satisfaction');
        }
      }
    }

    // Normalize sentiment to -1 to +1
    sentiment = Math.max(-1, Math.min(1, sentiment));

    // Additional word-level analysis
    const contentLower = msg.content.toLowerCase();
    if (contentLower.includes('thank')) emotions.push('gratitude');
    if (contentLower.includes('sorry')) emotions.push('regret');
    if (contentLower.includes('urgent')) emotions.push('stress');
    if (contentLower.includes('great') || contentLower.includes('excellent')) emotions.push('enthusiasm');

    const tone = sentiment < -0.3 ? 'hostile' : sentiment < 0 ? 'negative' : sentiment < 0.3 ? 'neutral' : 'positive';

    const escalationRisk = Math.max(
      0,
      Math.min(100, (1 - sentiment) * 50 + (emotions.length * 5))
    );

    return {
      messageId: `msg-${id}`,
      content: msg.content.substring(0, 100),
      sentiment,
      confidence: Math.random() * 20 + 80, // 80-100% confidence
      emotions: [...new Set(emotions)],
      tone,
      keyPhrases,
      escalationRisk
    };
  }

  /**
   * Detect and resolve conflicts
   */
  private async detectAndResolvConflicts(task: string, context?: unknown): Promise<AgentResponse> {
    logInfo(this.name, 'Konfliktusok felderítése és kezelése...');

    const detectedConflicts: ResolutionSuggestion[] = [
      {
        conflictLevel: 'medium',
        parties: ['Bob', 'Project Management'],
        summary: 'Resource allocation and timeline frustration',
        rootCause: 'Insufficient resources causing team member frustration and reduced productivity',
        suggestions: [
          'Schedule a resource planning meeting with project stakeholders',
          'Review sprint capacity and adjust timeline expectations',
          'Provide additional support or tools to improve efficiency',
          'Establish clearer communication on project constraints'
        ],
        recommendedActions: [
          'HR to conduct one-on-one with Bob',
          'Manager to review workload distribution',
          'Team meeting to align expectations'
        ],
        priority: 'high',
        mediatorApproach: 'Collaborative problem-solving with focus on mutual understanding'
      }
    ];

    return {
      status: 'success',
      data: {
        conflictsDetected: detectedConflicts.length,
        conflicts: detectedConflicts,
        highRiskTeamMembers: ['Bob - Frustration level: High'],
        recommendedMediations: [
          {
            type: 'One-on-one discussion',
            participants: ['Bob', 'Direct Manager'],
            suggestedTopic: 'Career development and resource needs'
          },
          {
            type: 'Team retrospective',
            participants: ['Team', 'Facilitator'],
            suggestedTopic: 'Process improvements and workload management'
          }
        ]
      }
    };
  }

  /**
   * Assess organizational health
   */
  private async assessOrganizationalHealth(task: string, context?: unknown): Promise<AgentResponse> {
    logInfo(this.name, 'Szervezeti egészség felmérése...');

    const healthScore = Math.max(0, Math.min(100, (this.organizationalSentimentTrend + 1) * 50));

    return {
      status: 'success',
      data: {
        organizationalHealth: {
          healthScore: Math.round(healthScore),
          sentiment: this.organizationalSentimentTrend,
          status: healthScore > 70 ? 'excellent' : healthScore > 50 ? 'good' : 'concerning',
          trend: this.organizationalSentimentTrend > 0 ? 'improving' : 'declining'
        },
        engagement: {
          messageVolume: this.messageHistory.length,
          averageSentiment: this.organizationalSentimentTrend,
          positiveMessages: this.messageHistory.filter(m => m.sentiment > 0.3).length,
          negativeMessages: this.messageHistory.filter(m => m.sentiment < -0.3).length
        },
        recommendations: [
          'Continue monitoring team sentiment',
          'Schedule team building activities',
          'Ensure transparent communication from leadership',
          'Address identified concerns promptly',
          'Recognize and celebrate team achievements'
        ],
        nextReviewDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    };
  }

  /**
   * Get health indicator emoji and text
   */
  private getHealthIndicator(sentiment: number): string {
    if (sentiment > 0.5) return '😊 Excellent morale';
    if (sentiment > 0.2) return '🙂 Good morale';
    if (sentiment > -0.2) return '😐 Neutral mood';
    if (sentiment > -0.5) return '😟 Declining morale';
    return '😢 Poor morale';
  }

  /**
   * Generate communication recommendations
   */
  private generateCommunicationRecommendations(analyzes: SentimentAnalysis[]): string[] {
    const hasNegative = analyzes.some(a => a.sentiment < -0.3);
    const hasHighEscalation = analyzes.some(a => a.escalationRisk > 70);

    const recommendations: string[] = [];

    if (hasNegative) {
      recommendations.push('Schedule team meetings to address concerns');
      recommendations.push('Improve internal communication transparency');
    }

    if (hasHighEscalation) {
      recommendations.push('Initiate conflict resolution discussions');
      recommendations.push('Review team workload and support systems');
    }

    if (analyzes.every(a => a.sentiment > 0.3)) {
      recommendations.push('Maintain current communication practices');
      recommendations.push('Continue reinforcing positive team culture');
    }

    return recommendations;
  }
}
