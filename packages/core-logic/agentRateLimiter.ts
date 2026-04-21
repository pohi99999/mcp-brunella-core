import { logInfo } from '@packages/utils/logger.js';

export class AgentRateLimiter {
  private counters = new Map<string, number[]>();
  
  canExecute(agentName: string, limits = { perMinute: 30, perHour: 200 }): boolean {
    const now = Date.now();
    const history = this.counters.get(agentName) ?? [];
    
    const recentMinute = history.filter(t => now - t < 60_000);
    const recentHour   = history.filter(t => now - t < 3_600_000);
    
    if (recentMinute.length >= limits.perMinute) {
      logInfo('RateLimit', `${agentName} per minute limit (${limits.perMinute}) reached`);
      return false;
    }
    if (recentHour.length >= limits.perHour) {
      logInfo('RateLimit', `${agentName} per hour limit (${limits.perHour}) reached`);
      return false;
    }
    
    this.counters.set(agentName, [...recentHour, now]);
    return true;
  }
}

export const agentRateLimiter = new AgentRateLimiter();

