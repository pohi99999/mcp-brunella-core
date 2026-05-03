export * from './config.js';
export * from './contracts.js';
export * from './errors.js';
export * from './gatewayAdapter.js';
export * from './policyTranslator.js';
export {
  OpenClawTaskDispatcher,
  buildEvidenceFromGatewayResponse,
} from './dispatcher.js';
export type {
  OpenClawApprovalService,
  OpenClawTaskDispatcherOptions,
} from './dispatcher.js';

import { Logger } from '../../utils/logger.js';
import { createOpenClawStatusSnapshot, loadOpenClawConfig, snapshotOpenClawConfig, type OpenClawConfigLoaderOptions } from './config.js';
import { OpenClawConfig, OpenClawRuntimeSnapshot, OpenClawRuntimeSnapshotSchema } from './contracts.js';
import { OpenClawApprovalService, OpenClawTaskDispatcher, type OpenClawTaskDispatcherOptions } from './dispatcher.js';
import { HttpOpenClawGatewayAdapter, type OpenClawGatewayAdapterOptions } from './gatewayAdapter.js';

export interface OpenClawRuntimeFactoryOptions extends OpenClawConfigLoaderOptions {
  config?: OpenClawConfig;
  gatewayOptions?: OpenClawGatewayAdapterOptions;
  dispatcherOptions?: Omit<OpenClawTaskDispatcherOptions, 'config' | 'gateway' | 'approvalService'>;
  approvalService?: OpenClawApprovalService;
  logger?: Logger;
}

export interface OpenClawRuntimeBundle {
  config: OpenClawConfig;
  gateway: HttpOpenClawGatewayAdapter;
  dispatcher: OpenClawTaskDispatcher;
  snapshot(): OpenClawRuntimeSnapshot;
}

export function createOpenClawRuntime(options: OpenClawRuntimeFactoryOptions = {}): OpenClawRuntimeBundle {
  const config = options.config ?? loadOpenClawConfig({ env: options.env });
  const logger = options.logger ?? options.dispatcherOptions?.logger ?? new Logger('OpenClawRuntime');
  const gateway = new HttpOpenClawGatewayAdapter(config, {
    fetchImpl: options.gatewayOptions?.fetchImpl,
    logger: options.gatewayOptions?.logger ?? logger,
  });
  const dispatcher = new OpenClawTaskDispatcher({
    config,
    gateway,
    approvalService: options.approvalService,
    logger: options.dispatcherOptions?.logger ?? logger,
  });

  return {
    config,
    gateway,
    dispatcher,
    snapshot(): OpenClawRuntimeSnapshot {
      return OpenClawRuntimeSnapshotSchema.parse({
        config: snapshotOpenClawConfig(config),
        status: createOpenClawStatusSnapshot(config),
      });
    },
  };
}
