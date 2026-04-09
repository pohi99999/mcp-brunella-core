import { eventStore } from './eventStore.js';
import { fireHooks } from './hookEngine.js';
import { randomUUID } from 'crypto';

export interface BASCommand {
  id: string;
  type: string;
  payload: unknown;
  toEvent: (result: unknown) => any;
}

export class CommandBus {
  private handlers: Record<string, (cmd: BASCommand) => Promise<unknown>> = {};

  register(type: string, handler: (cmd: BASCommand) => Promise<unknown>) {
    this.handlers[type] = handler;
  }

  async dispatch(command: BASCommand) {
    if (!this.handlers[command.type]) {
      throw new Error(`No handler registered for command: ${command.type}`);
    }
    
    // Execute handler
    const result = await this.handlers[command.type](command);
    
    // Store event
    await eventStore.append(command.toEvent(result));
    
    // Fire hook
    await fireHooks(`${command.type}:completed` as any, result);
    
    return result;
  }
}

export const commandBus = new CommandBus();
