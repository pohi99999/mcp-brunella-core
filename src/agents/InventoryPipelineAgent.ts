import { BaseAgent, AgentContext, AgentResult } from './BaseAgent.js';
import { agentManager } from './AgentManager.js';
import { logInfo, logError, logWarn } from '../utils/logger.js';
import { ensureError } from '../utils/ensureError.js';
import { AgentStateMachine, type StateNode, type Transition } from '../core/agentStateMachine.js';

export type InventoryPipelineState = 
  | 'IDLE' 
  | 'CALCULATING_SAFETY_STOCK' 
  | 'FORECASTING_DEMAND' 
  | 'GENERATING_PURCHASE_ORDERS' 
  | 'DONE' 
  | 'ERROR';

const STATES: StateNode<InventoryPipelineState>[] = [
  { name: 'IDLE' },
  { name: 'CALCULATING_SAFETY_STOCK' },
  { name: 'FORECASTING_DEMAND' },
  { name: 'GENERATING_PURCHASE_ORDERS' },
  { name: 'DONE' },
  { name: 'ERROR' },
];

const TRANSITIONS: Transition<InventoryPipelineState>[] = [
  { from: 'IDLE', to: 'CALCULATING_SAFETY_STOCK', event: 'start' },
  { from: 'CALCULATING_SAFETY_STOCK', to: 'FORECASTING_DEMAND', event: 'calcDone' },
  { from: 'FORECASTING_DEMAND', to: 'GENERATING_PURCHASE_ORDERS', event: 'forecastDone' },
  { from: 'GENERATING_PURCHASE_ORDERS', to: 'DONE', event: 'poDone' },
  { from: 'CALCULATING_SAFETY_STOCK', to: 'ERROR', event: 'error' },
  { from: 'FORECASTING_DEMAND', to: 'ERROR', event: 'error' },
  { from: 'GENERATING_PURCHASE_ORDERS', to: 'ERROR', event: 'error' },
];

/**
 * InventoryPipelineAgent - Koordinálja a készletgazdálkodási folyamatokat.
 * Statisztikai számítások -> Kereslet előrejelzés -> Beszerzési javaslatok.
 */
export class InventoryPipelineAgent extends BaseAgent {
  name = 'InventoryPipeline';
  role = 'Készletgazdálkodási koordinátor';
  description = 'Végigvezeti a rendszert a készletoptimalizálási folyamaton: ROP/SS kalkuláció és PO generálás.';
  capabilities = ['inventory-optimization-orchestration', 'replenishment-pipeline'];

  async executeTask(context: AgentContext): Promise<AgentResult> {
    const task = typeof context.task === 'string' ? context.task : 'Run full inventory optimization pipeline';
    const taskId = `inv-pipe-${Date.now()}`;
    logInfo(this.name, `Starting inventory pipeline: ${taskId}`);

    const machine = new AgentStateMachine<InventoryPipelineState>(
      STATES,
      TRANSITIONS,
      'IDLE',
      taskId
    );

    try {
      // 1. Safety Stock & ROP Calculation
      await machine.transition('start');
      logInfo(this.name, 'Step 1: Calculating Safety Stock and Reorder Points...');
      const ssResult = await agentManager.delegate('SafetyStockAgent', JSON.stringify({ action: 'calculate-all' })) as AgentResult;
      if (!ssResult.success) throw new Error(`Safety Stock calculation failed: ${ssResult.message}`);

      // 2. Demand Forecasting (Optional/Future integration)
      await machine.transition('calcDone');
      logInfo(this.name, 'Step 2: Forecasting demand (skipping for now, pending DemandForecastAgent integration)...');
      // const forecastResult = await agentManager.delegate('DemandForecastAgent', ...);
      await machine.transition('forecastDone');

      // 3. Purchase Order Generation
      logInfo(this.name, 'Step 3: Generating Purchase Orders for items below ROP...');
      const poResult = await agentManager.delegate('PurchaseOrderAgent', JSON.stringify({ action: 'generate-all' })) as AgentResult;
      if (!poResult.success) throw new Error(`PO Generation failed: ${poResult.message}`);

      await machine.transition('poDone');
      return {
        success: true,
        message: 'A készletoptimalizálási pipeline sikeresen lefutott.',
        data: {
          safety_stock: ssResult.data,
          purchase_orders: poResult.data
        }
      };

    } catch (error: unknown) {
      const err = ensureError(error);
      logError(this.name, `Pipeline error: ${err.message}`);
      try { await machine.transition('error'); } catch {
        // Silently ignore state transition errors during error handling
      }
      return { success: false, message: `Pipeline hiba: ${err.message}` };
    }
  }
}
