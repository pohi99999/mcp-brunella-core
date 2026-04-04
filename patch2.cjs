const fs = require('fs');

const file = 'src/agents/EnterpriseOrchestratorAgent.ts';
let content = fs.readFileSync(file, 'utf8');

const searchStore = `  private async storeExecutionHistory(
    event: EnterpriseEvent,
    response: EnterpriseAgentResponse
  ): Promise<void> {
    try {
      // TODO: Implement LanceDB storage
      logInfo(this.name, \`Would store execution history for event \${event.id}\`);
    } catch (error) {
      logError(this.name, \`Failed to store execution history: \${error}\`);
    }
  }`;

const replaceStore = `  private async storeExecutionHistory(
    event: EnterpriseEvent,
    response: EnterpriseAgentResponse
  ): Promise<void> {
    try {
      await lanceDBClient.addData('enterprise_events', {
        id: event.id,
        module: event.module,
        type: event.type,
        status: response.status,
        timestamp: new Date().toISOString(),
        error: response.error || null,
        data: JSON.stringify(response.data)
      });
      logInfo(this.name, \`Stored execution history for event \${event.id}\`);
    } catch (error) {
      logError(this.name, \`Failed to store execution history: \${error}\`);
    }
  }`;

content = content.replace(searchStore, replaceStore);

fs.writeFileSync(file, content);
