import { QcRenderAgent } from '../agents/QcRenderAgent.js';
import { captureValidationResult, requireString, type SkillParams } from './skill-helpers.js';
import type { BrunellaSkill } from './skill.interface.js';

function validateDeliverySkill(params: SkillParams) {
  return captureValidationResult(() => {
    requireString(params, 'projectName', 'projectName');
    requireString(params, 'timelinePlanPath', 'timelinePlanPath');
  });
}

export const DeliverySkill: BrunellaSkill = {
  name: 'delivery',
  description: 'Baseline FFmpeg render es QC delivery presetekkel.',
  version: '1.0.0',
  category: 'studio',
  tools: ['studio_render_execute', 'studio_qc_run', 'studio_render_presets'],
  agents: ['QcRender', 'ColorPrep'],
  validate(params: SkillParams): boolean {
    return validateDeliverySkill(params).valid;
  },
  getValidationResult: validateDeliverySkill,
  async execute(params: SkillParams): Promise<unknown> {
    const agent = new QcRenderAgent();
    return agent.executeTask({ task: 'render', payload: params });
  },
};

export default DeliverySkill;
