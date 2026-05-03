import { AudioMixAgent } from '../agents/AudioMixAgent.js';
import { captureValidationResult, requireString, type SkillParams } from './skill-helpers.js';
import type { BrunellaSkill } from './skill.interface.js';

function validateAudioPostSkill(params: SkillParams) {
  return captureValidationResult(() => {
    requireString(params, 'timelinePlanPath', 'timelinePlanPath');
    requireString(params, 'musicTrackPath', 'musicTrackPath');
  });
}

export const AudioPostSkill: BrunellaSkill = {
  name: 'audio-post',
  description: 'Beat mapet, ducking tervet es mix cue-kat keszit a promo rough-cuthoz.',
  version: '1.0.0',
  category: 'studio',
  tools: ['studio_audio_plan'],
  agents: ['AudioMix'],
  validate(params: SkillParams): boolean {
    return validateAudioPostSkill(params).valid;
  },
  getValidationResult: validateAudioPostSkill,
  async execute(params: SkillParams): Promise<unknown> {
    const agent = new AudioMixAgent();
    return agent.executeTask({ task: 'audio-plan', payload: params });
  },
};

export default AudioPostSkill;
