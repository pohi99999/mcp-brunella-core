import { logWarn } from './logger.js';

const validators: { name: string; check: () => boolean; hint: string }[] = [
  {
    name: 'ANYTHINGLLM_API_KEY',
    check: () => !!process.env.ANYTHINGLLM_API_KEY,
    hint: 'Set ANYTHINGLLM_API_KEY for AnythingLLM workspace/chat API.',
  },
  {
    name: 'N8N_TEST_USER',
    check: () => !!process.env.N8N_TEST_USER,
    hint: 'Set N8N_TEST_USER for n8n sandbox access.',
  },
  {
    name: 'N8N_TEST_PASSWORD',
    check: () => !!process.env.N8N_TEST_PASSWORD,
    hint: 'Set N8N_TEST_PASSWORD for n8n sandbox access.',
  },
  {
    name: 'N8N_TEST_URL',
    check: () => !!process.env.N8N_TEST_URL,
    hint: 'Set N8N_TEST_URL for n8n sandbox access.',
  },
  {
    name: 'N8N_API_KEY',
    check: () => !!process.env.N8N_API_KEY,
    hint: 'Set N8N_API_KEY for n8n API mode (create_workflow, rename_workflow).',
  },
  {
    name: 'GOOGLE_API_KEY',
    check: () => !!process.env.GOOGLE_API_KEY,
    hint: 'Set GOOGLE_API_KEY for Robotkéz Browser-Use mód (Gemini).',
  },
];

export function validateSecrets(): void {
  if (process.env.BRUNELLA_SKIP_SECRETS_CHECK === '1') return;
  for (const v of validators) {
    if (!v.check()) {
      logWarn('System', `Missing config: ${v.name}. ${v.hint}`);
    }
  }
}
