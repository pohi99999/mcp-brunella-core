import { logError, logInfo } from "../utils/logger.js";

interface ActionRequest {
  action: string;
  params?: Record<string, any>;
}

export class RobotkezBridge {
  private apiUrl = process.env.PYTHON_API_URL || 'http://127.0.0.1:8000';

  async handleMessage(message: string): Promise<string> {
    logInfo('RobotkezBridge', `Received message: ${message}`);
    
    // In a real implementation, this is where the Orchestrator/LLM would parse
    // the intent and turn it into actionable steps. For now, we do a simple
    // rule-based mapping or fallback.
    
    try {
      if (message.toLowerCase().includes('menj a google') || message.toLowerCase().includes('google.com')) {
        await this.sendAction({ action: 'navigate', params: { url: 'https://www.google.com' } });
        return 'Navigálok a Google-ra.';
      }
      
      // Generic "I received your message"
      return `Megértettem az utasítást: "${message}". Ennek a pontos LLM feldolgozása folyamatban van.`;
    } catch (e: any) {
      logError('RobotkezBridge', `Action failed: ${e.message}`);
      return `Hiba történt az utasítás végrehajtása közben: ${e.message}`;
    }
  }

  async sendAction(request: ActionRequest): Promise<any> {
    const response = await fetch(`${this.apiUrl}/api/robotkez/action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getSnapshot(): Promise<any> {
    const response = await fetch(`${this.apiUrl}/api/robotkez/snapshot`);
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }
}

export const robotkezBridge = new RobotkezBridge();
