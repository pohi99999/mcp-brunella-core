import { StudioSupervisorAgent } from '../agents/StudioSupervisorAgent.js';
import { captureValidationResult, requireString, type SkillParams } from './skill-helpers.js';
import type { BrunellaSkill } from './skill.interface.js';

function validateStudioOrchestrationSkill(params: SkillParams) {
  return captureValidationResult(() => {
    requireString(params, 'inputDir', 'inputDir');
  });
}

export const StudioOrchestrationSkill: BrunellaSkill = {
  name: 'studio-orchestration',
  description: 'Vegigfuttatja a Brunella Studio promo pipeline fo fazisait ingesttol a QC-ig.',
  version: '1.0.0',
  category: 'studio',
  tools: ['studio_media_ingest_directory', 'studio_timeline_plan', 'studio_audio_plan', 'studio_render_execute', 'studio_qc_run'],
  agents: ['StudioSupervisor', 'MediaIngest', 'StoryCut', 'AudioMix', 'ColorPrep', 'QcRender'],
  validate(params: SkillParams): boolean {
    return validateStudioOrchestrationSkill(params).valid;
  },
  getValidationResult: validateStudioOrchestrationSkill,
  async execute(params: SkillParams): Promise<unknown> {
    const agent = new StudioSupervisorAgent();
    return agent.executeTask({ task: 'full pipeline', payload: params });
  },
};

export default StudioOrchestrationSkill;
